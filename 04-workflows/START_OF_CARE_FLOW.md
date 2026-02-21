# Start of Care (SOC) Flow

> End-to-end flow from agency creating a task to documents being delivered to the agency.

---

## 1. Trigger

An agency coordinator creates a new Start of Care task for a patient in the agency portal (or the admin webapp creates it on behalf of an agency).

**Preconditions:**
- Patient exists and is in ACTIVE (or ELIGIBLE/ACCEPTED) status
- Patient has at least one active contract with a valid payer
- Patient has a primary language set
- Agency has an SOC task template configured (via `rn_platform_agency_task_template_assoc` with `task_type = 'START_OF_CARE'`)

---

## 2. Step-by-Step Flow

### Step 1: Task Creation (10-Step Pipeline)

**UI Action:** Agency portal → Patient → Create Task → Select SOC template

**API:** `POST /api/rn-platform/tasks` (taskhealth_server2)

**The 10-step creation pipeline:**

1. **Validate inputs** — Check patient, contract, template exist and are valid
2. **Create `patient_task`** — Insert with `task_template_id`, `patient_id`, `patient_contract_id`, `service_code_id`, dates, priority
3. **Create `patient_task_document`** entries — Copy document requirements from template
4. **Create `patient_task_instance`** — Single instance for SOC (non-recurring). Set `is_broadcasting = false`, `is_active = true`
5. **Create `patient_task_instance_document`** entries — Copy from task documents
6. **Create/link certification period** — Find or create `patient_certification_period` with `type = 'START_OF_CARE'`. Link via `certification_period_id` on the task
7. **Create credit reservation** — Insert `task_credit_reservation` with `credits_used` (typically 1 credit = $200). Deduct from `task_credit_agency_balance`
8. **Send push notifications** — `notifyRNOnTaskBroadcast()` sends FCM to eligible RNs
9. **Start broadcasting** — Set `patient_task_instance.is_broadcasting = true`
10. **Emit Socket.IO event** — `TaskBroadcastsUpdated` to relevant channels

**Tables written:**
- `patient_task` (INSERT)
- `patient_task_document` (INSERT, multiple rows)
- `patient_task_instance` (INSERT)
- `patient_task_instance_document` (INSERT, multiple rows)
- `patient_certification_period` (INSERT or UPDATE)
- `task_credit_reservation` (INSERT)
- `task_credit_agency_balance` (UPDATE)

---

### Step 2: Broadcasting

**What happens:** The task instance appears in the "Available Tasks" section of the RN mobile app for all eligible caregivers.

**RN Eligibility Matching (two levels):**

| Level | Used For | Criteria |
|-------|----------|----------|
| **Broad match** | Metrics | Active caregiver + matching certifications |
| **Strict match** | Push notifications | + Language match + Distance filter (haversine) |

**Language matching:** RN must speak at least one of the patient's languages (main or secondary).

**Distance filtering:**
- If `broadcast_distance` is set AND patient has GPS coordinates → only RNs within radius
- If no coordinates → ALL matching RNs get the broadcast
- Default radius: **40 miles** (overridden per county in `rn_platform_county_miles_broadcast_radius`)

**Broadcast tracking:** Each RN who views the broadcast is logged in `patient_task_broadcast_caregiver_engagement`.

---

### Step 3: RN Acceptance (Race-Condition Protected)

**UI Action:** RN mobile app → Available Tasks → Tap "Accept"

**API:** Atomic SQL UPDATE with optimistic locking:
```sql
UPDATE patient_task_instance
SET is_broadcasting = FALSE, caregiver_id = {RN_ID}
WHERE id = {INSTANCE_ID}
  AND is_broadcasting = TRUE
  AND caregiver_id IS NULL
```

**If 0 rows affected:** Return 409 "ALREADY_ASSIGNED" (another RN got it first)

**If 1 row affected:**
- Task instance moves to **Assigned** status
- `caregiver_id` is now set
- Socket.IO event emitted to update all RNs' available task lists

---

### Step 4: RN Schedules Visit

**UI Action:** RN mobile app → My Tasks → Select task → Schedule visit date/time

**What happens:**
1. RN selects a date and time for the patient visit
2. `schedule_date_time` is set on `patient_task_instance`
3. A `visit_instance` is created with:
   - `is_task = true`
   - `start_time` / `end_time` from schedule
   - `patient_id`, `caregiver_id`, `patient_contract_id` from task instance
   - `service_code_id`, `office_id`, `agency_id`
4. `patient_task_instance.visit_instance_id` is set to the new visit
5. Task instance status → **Scheduled**

**Tables written:**
- `visit_instance` (INSERT)
- `patient_task_instance` (UPDATE: visit_instance_id, schedule_date_time)

---

### Step 5: Patient Confirmation (Optional)

Depending on agency settings, the patient may need to confirm the visit:
- SMS or phone confirmation sent
- `patient_confirmed = true`, `patient_confirmed_at` set on task instance
- Status moves from **ScheduledPendingConfirmation** → **Scheduled**

---

### Step 6: RN Visits Patient & Fills Forms

**UI Action:** RN mobile app → Visit → Open document forms

**What happens:**
1. RN arrives at patient's home, clocks in (GPS + time captured)
2. `visit_instance.clockin_time`, `clockin_location`, `clockin_type` are set
3. RN opens each required document (Patient Assessment, CMS-485, POC, etc.)
4. For each document, a `patient_documents_scheduled_visit` record exists (created during task setup)
5. RN answers questions — each answer saved immediately:
   - `POST /caregivers/:id/visit_instances/:id/patient_documents/:documentTypeId/answer`
   - Inserts/updates `patient_documents_answers`
   - For database-linked questions (`nursingQuestionLinked`), also writes to `nursing_question_answer`
6. AI generation available for 26 questions (see [AI_SYSTEM.md](../03-domains/AI_SYSTEM.md))
7. RN completes all required documents

**SOC-specific documents typically required:**
- Patient Assessment (v10, 8 pages)
- CMS-485 (28 fields — mix of AI-generated and database-linked)
- Plan of Care (42 duties in 6 categories)
- Welcome Package
- Emergency Kardex

---

### Step 7: RN Submits Documents

**UI Action:** RN mobile app → Submit button on each document

**Validation before submit:**
- All required fields filled
- No unresolved AI rejections
- Medication profiles and ICD codes validated
- Vital signs within expected ranges

**API:** `POST /caregivers/:id/visit_instances/:id/patient_documents/:documentTypeId`

**What happens per document:**
1. Submission timestamp recorded on `patient_documents_scheduled_visit.submittedAt`
2. **5 invisible auto-generated questions** are computed server-side:
   - Functional Limitations (0-8 flags based on assessment answers)
   - Safety Measures (13 options, auto-selected based on diagnosis/assessment)
   - Activities Permitted (auto vs manual based on conditions)
   - Prognosis (decision tree using 6 boolean flags)
   - Progress Note (narrative generated from structured data)
3. Cross-document data propagation via `nursing_question_answer` (61 DatabaseLinkType values)
4. If `require_ai_review = true`: AI review is triggered (see Step 8)

---

### Step 8: AI Review (If Enabled)

**Trigger:** Document with `require_ai_review = true` is submitted

**What happens:**
1. `patient_document_ai_review` record created with `is_latest = true`
2. AI review runs 20 section-specific rules against the document
3. Rules check: required fields, consistency, medication-diagnosis alignment
4. **Two severity levels:**
   - `HARD` — Must fix before final approval (blocks completion)
   - `SUGGESTED` — Optional improvement (RN can decline)
5. If rejections found:
   - Per-question rejection banners appear in RN app
   - RN fixes issues or declines suggestions, then resubmits
6. If no rejections: Document passes review

**7 Medication-Diagnosis Clusters checked:**
Diabetes, Hypertension, Heart Failure, COPD/Asthma, Thyroid, Pain/Opioids, Anticoagulation

---

### Step 9: PDF Generation

**Trigger:** All documents submitted and AI review passed

**Three PDF pipelines (depending on document type):**

1. **Pipeline 1 (HTML):** Nunjucks templates → `html-to-pdf-lambda` (wkhtmltopdf) → S3
   - Used for: MEDFLYT_PATIENT_ASSESSMENT_HTML, MEDFLYT_PLAN_OF_CARE_HTML, etc.
2. **Pipeline 2 (Legacy PDF fill):** `taskhealth_patient_docs_pdf` → pdftk fills templates → S3
   - Used for: CMS485, OCA960, older document types
3. **Pipeline 3 (MfDocument):** `taskhealth-serverless/generateMfDocument` → Puppeteer → S3
   - Used for: Newer documents with complex layouts

**Agency branding:** PDFs include agency logo and header per `patient_documents_types` display flags.

**Queue:** `patient_document_generation_queue` tracks async generation (status: pending → processing → completed/failed).

---

### Step 10: Document Delivery via SMS

**Trigger:** PDF generated and stored in S3

**What happens:**
1. Document links created in `patient_document_link` with access tokens
2. SMS messages sent to:
   - Patient phone number
   - Caregiver (HHA) phone number
3. SMS via Twilio or Plivo (dual-provider)
4. Delivery status tracked in SMS delivery log
5. Agency can view/download documents in portal Documents tab

---

### Step 11: Task Completion

**What happens:**
1. RN clocks out — `visit_instance.clockout_time`, `clockout_location` set
2. All documents submitted and reviewed → `patient_task_instance.completion_date` set
3. Task instance status → **Completed**
4. Certification period marked as completed: `patient_certification_period.is_completed = true`
5. Visit becomes visible in agency portal with all documents

---

## 3. Decision Points

| Decision | Condition | Branch |
|----------|-----------|--------|
| RN eligible? | Certs + language + distance | Include/exclude from broadcast |
| Multiple RNs accept? | Atomic UPDATE returns 0 rows | 409 ALREADY_ASSIGNED |
| Patient confirms? | Agency setting | ScheduledPendingConfirmation vs Scheduled |
| AI review needed? | `require_ai_review` flag on document type | Review → rejections → resubmit cycle |
| Which PDF pipeline? | Document type prefix | Pipeline 1 (HTML), 2 (Legacy), or 3 (MfDocument) |

---

## 4. Error Handling

| Step | Error | Handling |
|------|-------|---------|
| Task creation | Insufficient credits | Block creation, show "Buy Credits" |
| Broadcasting | No eligible RNs | Task stays in Broadcasting, admin notified |
| RN acceptance | Race condition | 409 ALREADY_ASSIGNED, RN sees updated list |
| Document submission | Validation failure | Red borders + missing field dialog |
| AI review | Review fails | Per-question rejection banners |
| PDF generation | Lambda failure | Queue retries (max_retries), status → failed |
| SMS delivery | Send failure | Status "Failed" in delivery log |

---

## 5. Tables Touched (Summary)

| Table | Operation | Step |
|-------|-----------|------|
| patient_task | INSERT | 1 |
| patient_task_document | INSERT | 1 |
| patient_task_instance | INSERT, UPDATE | 1, 3, 4, 11 |
| patient_task_instance_document | INSERT | 1 |
| patient_certification_period | INSERT/UPDATE | 1, 11 |
| task_credit_reservation | INSERT | 1 |
| task_credit_agency_balance | UPDATE | 1 |
| patient_task_broadcast_caregiver_engagement | INSERT | 2 |
| visit_instance | INSERT, UPDATE | 4, 6, 11 |
| patient_documents_scheduled_visit | UPDATE | 7 |
| patient_documents_answers | INSERT/UPDATE | 6 |
| nursing_question_answer | INSERT/UPDATE | 6, 7 |
| patient_document_ai_review | INSERT | 8 |
| patient_document_generation_queue | INSERT, UPDATE | 9 |
| patient_document_link | INSERT | 10 |

---

## 6. Code Paths

| Step | Repo | Key Files |
|------|------|-----------|
| Task creation | taskhealth_server2 | `src/rn-platform/tasks/createTask.ts` |
| Broadcasting | taskhealth_server2 | `src/rn-platform/tasks/broadcastTask.ts` |
| Push notifications | taskhealth_server2 | `notifyRNOnTaskBroadcast()`, FCM integration |
| RN acceptance | taskhealth_server2 | `src/rn-platform/tasks/acceptBroadcast.ts` |
| Document answers | taskhealth_server2 | `src/rn-platform/documents/` |
| AI generation | taskhealth_server2 | `src/rn-platform/ai/` |
| AI review | taskhealth_server2 | `src/rn-platform/ai-review/` |
| PDF generation | html-to-pdf-lambda, taskhealth_patient_docs_pdf, taskhealth-serverless | Various |
| SMS delivery | taskhealth-serverless | Callbacks Service |
| Socket.IO events | taskhealth-socketio | Event handlers |
