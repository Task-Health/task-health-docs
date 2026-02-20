# Task Lifecycle

> The complete lifecycle of a task from creation through broadcasting, RN assignment, visit execution, document submission, and agency download.

---

## 1. Overview

A **task** in Task Health represents a clinical nursing assessment that needs to be performed for a patient on behalf of a home care agency. Tasks are the central unit of work in the system: they connect a patient, an agency (contract), a set of clinical documents, and an RN who performs the assessment.

### Why Tasks Exist

Agencies (LHCSAs) need clinical nursing assessments done for their patients but outsource this work to Task Health rather than employing their own RNs. The task system manages the entire flow: what needs to be done, who does it, when, and what documents result from it.

### The Three-Level Hierarchy

```
Task Template  (patient_task_template)
    = Reusable blueprint defining a document bundle + settings.
    = Configured once by admins, reused across many tasks.

        |
        v

Task  (patient_task)
    = Assignment linking a patient + contract + template.
    = Can be recurring via repeat_months (cycle period).

        |
        v

Task Instance  (patient_task_instance)
    = One specific occurrence of a task.
    = The entity that gets broadcast, assigned to an RN, scheduled, and completed.
    = A recurring task spawns multiple instances.
```

Each task instance can link to a **visit instance** (`visit_instance`) -- the actual calendar event with a scheduled time, clock-in/out tracking, and GPS location recording.

---

## 2. Entities

### 2.1 Task Template (`patient_task_template`)

A reusable blueprint that defines which documents an RN must complete, the expected duration, priority, and required certifications.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `title` | TEXT NOT NULL | Template name (e.g., "Initial assessment") |
| `agency_id` | INT NOT NULL | FK to `agency(id)` |
| `allowed_certifications` | JSONB NOT NULL | `CaregiverCertification[]` (e.g., `["RN"]`) |
| `duration_minutes` | INT | Expected visit duration |
| `priority` | INT NOT NULL | 1 (highest) to 5 (lowest) |
| `context` | TEXT | CHECK: NULL, `'START_OF_CARE'`, `'REASSESSMENT'` |
| `type` | TEXT | `'START_OF_CARE'` / `'REASSESSMENT'` / `'SUPERVISORY'` -- drives auto-selection from portal |
| `plan_of_care_type_id` | INT | FK to `plan_of_care_type(id)` |
| `created_at` | TIMESTAMPTZ NOT NULL | |
| `removed_at` | TIMESTAMPTZ | Soft delete |

**Junction table: `patient_task_template_document`**

Links templates to their document bundles.

| Column | Type | FK |
|--------|------|-----|
| `task_template_id` | INT NOT NULL | `patient_task_template(id)` |
| `document_id` | INT NOT NULL | `patient_documents_types(id)` |
| UNIQUE(`task_template_id`, `document_id`) | | |

### 2.2 Task (`patient_task`)

An assignment linking a patient, contract (agency), and template. Represents the overall work order.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `agency_id` | INT NOT NULL | FK to `agency(id)` |
| `task_template_id` | INT NOT NULL | FK to `patient_task_template(id)` |
| `patient_id` | INT NOT NULL | FK to `patient(id)` |
| `patient_contract_id` | INT NOT NULL | FK to `contract(id)` -- links to agency |
| `title` | TEXT NOT NULL | |
| `start_date` | DATE NOT NULL | |
| `due_date` | DATE NOT NULL | |
| `priority` | INT NOT NULL | 1-5 |
| `repeat_months` | INT | Cycle period for recurring tasks |
| `is_draft` | BOOLEAN NOT NULL | |
| `caregiver_id` | INT | FK to `caregiver(id)` -- pre-assigned RN |
| `certification_period_id` | INT | FK to `patient_certification_period(id)` |
| `service_code_id` | INT NOT NULL | FK to `service_code(id)` |
| `payroll_code_id` | INT | FK to `payroll_code(id)` |
| `day_time_params` | JSONB | Custom schedule |
| `is_future_assigned` | BOOLEAN NOT NULL | |
| `price` | INT | |
| `canceled_at` | TIMESTAMPTZ | Soft cancel |
| `removed_at` | TIMESTAMPTZ | Soft delete |

**Junction table: `patient_task_document`** -- links a specific task to its document types (copied from template, can be overridden).

### 2.3 Task Instance (`patient_task_instance`)

The individual occurrence of a task -- the entity that gets broadcast to RNs, accepted, scheduled, and completed. A `patient_task` with `repeat_months` can spawn multiple instances (one per cycle).

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `task_id` | INT NOT NULL | FK to `patient_task(id)` -- parent task |
| `patient_id` | INT NOT NULL | FK to `patient(id)` |
| `contract_id` | INT NOT NULL | FK to `contract(id)` |
| `caregiver_id` | INT | FK to `caregiver(id)` -- assigned RN (NULL while broadcasting) |
| `start_date` | DATE NOT NULL | |
| `due_date` | DATE NOT NULL | |
| `duration_minutes` | INT | |
| `completion_date` | DATE | When completed |
| `schedule_date_time` | TIMESTAMPTZ | Scheduled visit time |
| `visit_instance_id` | INT | FK to `visit_instance(id)` -- links to calendar visit |
| `is_broadcasting` | BOOLEAN NOT NULL | Currently being broadcast to RNs |
| `broadcast_distance` | INT | Broadcast radius in meters |
| `patient_confirmed` | BOOLEAN NOT NULL | Patient confirmed the visit |
| `patient_confirmed_at` | TIMESTAMPTZ | |
| `confirmation_type` | TEXT | |
| `is_active` | BOOLEAN NOT NULL | |
| `price` | INT | |
| `service_code_id` | INT NOT NULL | FK to `service_code(id)` |
| `payroll_code_id` | INT | FK to `payroll_code(id)` |
| `agency_note` | TEXT | |
| `canceled_at` | TIMESTAMPTZ | |
| `removed_at` | TIMESTAMPTZ | |

**Junction table: `patient_task_instance_document`** -- links an instance to its specific document types.

### 2.4 Visit Instance (`visit_instance`)

The calendar event -- the actual scheduled time slot when an RN goes to a patient's home. Created only after an RN accepts a broadcast and schedules the visit, NOT at task creation time.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `patient_id` | INT NOT NULL | FK to `patient(id)` |
| `caregiver_id` | INT | FK to `caregiver(id)` |
| `patient_contract_id` | INT | FK to `contract(id)` |
| `start_time` / `end_time` | TIMESTAMP NOT NULL | Scheduled time |
| `start_time_utc` / `end_time_utc` | TIMESTAMPTZ NOT NULL | UTC versions |
| `clockin_time` / `clockout_time` | TIMESTAMP | Actual clock times |
| `clockin_location` / `clockout_location` | JSONB | GPS coordinates |
| `service_code_id` | INT | FK to `service_code(id)` |
| `payroll_code_id` | INT | FK to `payroll_code(id)` |
| `office_id` | INT NOT NULL | FK to `office(id)` |
| `agency_id` | INT NOT NULL | FK to `agency(id)` |
| `timezone` | TEXT NOT NULL | |
| `state` | TEXT NOT NULL | US state |
| `county_name` | TEXT NOT NULL | |
| `missed_visit` | BOOLEAN NOT NULL | |
| `billable` | BOOLEAN NOT NULL | |
| `is_task` | BOOLEAN NOT NULL | Marks task-created visits (vs. manually created) |
| `removed_at` | TIMESTAMPTZ | Soft delete |
| 20+ issue tracking boolean columns | | (e.g., `issue_has_patient_overlap`) |

---

## 3. Task Templates

### 3.1 Complete Template List

| Task Name | Documents | Duration | Priority | Task Type |
|-----------|-----------|----------|----------|-----------|
| Initial assessment | 5 docs | 60 min | 2 | Start of Care |
| Tele-Reassessment | -- | -- | -- | -- |
| Fall Incident | -- | -- | -- | -- |
| Hospitalization | -- | -- | -- | -- |
| In person reassessment | -- | -- | -- | Reassessment |
| Caregiver assessments | -- | -- | -- | -- |
| Interim visit | 5 docs | 60 min | 1 | -- |
| FC-Start of Care | 7 docs | 60 min | 1 | -- |
| General Start of Care | 1 doc | 60 min | 1 | -- |
| General Reassessment | 1 doc | 45 min | 3 | -- |
| FC-reassessment | 5 docs | 60 min | 2 | -- |

### 3.2 Naming Conventions

- **No prefix** (e.g., "Initial assessment") -- standard templates
- **"FC-"** prefix (e.g., "FC-Start of Care", "FC-reassessment") -- Freedom Care agency-specific templates. Freedom Care uses custom template overrides via the `rn_platform_agency_task_template_assoc` table
- **"General"** prefix (e.g., "General Start of Care") -- simplified templates with fewer documents
- **"Tele-"** prefix (e.g., "Tele-Reassessment") -- telehealth/remote assessment templates
- **"In person"** (e.g., "In person reassessment") -- requires physical visit (as opposed to tele)

### 3.3 How Templates Connect to Documents

The `patient_task_template_document` junction table links each template to one or more document types from `patient_documents_types`. When a task is created from a template, the system copies this document list into `patient_task_document` and then into `patient_task_instance_document`.

**Documents available for selection in templates (dropdown when configuring):**
- Patient Assessment
- HOME HEALTH CERTIFICATION AND PLAN OF CARE (CMS-485) MD ORDER
- Emergency Kardex
- Patient Bill of Rights
- Patient Responsibility
- Sleep study form
- Pain Assessment
- Client service agreement
- (and others from the full document list)

### 3.4 Document Naming Conventions (in Document Settings)

When viewing documents in the form builder (`/app/patient-document-settings`):

- **"NEW -"** prefix = production templates currently in use
- **"TEST -"** prefix = test/development templates (for AI verifications, validation testing)
- **"P1 -"** prefix = Phase 1 templates (possibly upcoming or alternate versions)
- **"FC -"** prefix = Freedom Care specific templates
- No prefix = miscellaneous/utility templates

---

## 4. Document Settings Page

Located at `app.taskshealth.com/app/patient-document-settings`.

This admin page has four tabs:

### 4.1 Documents Tab

Lists all document templates created in the form builder. Each template defines the structure of a clinical document that RNs fill out in the mobile app.

**Controls:**
- "Add Document" button -- creates a new document template
- Search field to filter documents
- Each row has "Example" button (preview) and "Delete" button
- Plans of Care section at top showing which offices have an active Plan of Care

**Internal document types:**

| Internal Type | Human Name | Notes |
|--------------|-----------|-------|
| `CMS485` | CMS-485 Form | Federal government form (multiple versions) |
| `MEDFLYT_PATIENT_ASSESSMENT_HTML` | Patient Assessment | Main clinical assessment (8 pages) |
| `MEDFLYT_PLAN_OF_CARE_HTML` | Plan of Care (POC) | Care plan checklist (2 pages) |
| `MEDFLYT_EMERGENCY_KARDEX_HTML` | Emergency Kardex | Emergency preparedness doc (2 pages) |
| `MEDFLYT_WELCOME_PACKAGE_HTML` | Welcome Package | Legal/consent package (8 pages) |
| `MEDFLYT_PARAPROFESSIONAL_SUPERVISORY_HTML` | Aide Supervisory Form | Aide evaluation (2 pages) |
| `MEDFLYT_PIA` | PIA | Purpose TBD |
| `PATIENT_ASSESSMENT_HTML_TEST` | Patient Assessment (Test) | Test version with AI verifications |
| `General` | General | Generic/custom form type |

### 4.2 Form Builder

URL pattern: `app.taskshealth.com/app/patient-document-builder/{documentId}`

The form builder creates the structure that the RN mobile app renders as a fillable form. Key concepts:

- Each document template is a **versioned** collection of questions/sections
- Templates can have multiple versions
- Questions are built one-by-one and can be reordered via drag-and-drop
- Section headers (gray bars) group related questions
- Question rows (blue rows) represent individual form fields
- Form answers are stored in the database and used by Lambda to generate branded PDFs

### 4.3 Task Templates Tab

Defines bundles of documents assigned together when creating a task. See section 3 above for the complete template list.

**Template list columns:**

| Column | Description |
|--------|-----------|
| Task Name | Template name |
| Created At | When template was created |
| Certifications | Required nurse certification (e.g., "RN") |
| Patient Documents | Number of documents bundled |
| Duration (Minutes) | Expected visit duration |
| Priority | 1 (highest) to 5 (lowest) |
| Task Context | Context classification (e.g., "Regular") |
| Task Type | Assessment category: Start of Care / Reassessment / Other |

---

## 5. Task Creation Flow

There are two paths for creating tasks: the Agency Portal flow (simplified) and the Admin Panel flow (full control).

### 5.1 Agency Portal Flow (Simplified)

When an agency creates a task from `go.task-health.com`:

1. Agency staff logs in and clicks "+ Add Assessment"
2. Selects the **visit type**: Start of Care / Reassessment / Supervisory
3. The system **automatically selects the correct Task Template** based on this visit type -- the agency does NOT manually pick templates or individual documents
4. Fills out a 3-step wizard:
   - **Step 1 -- Patient Information:** First Name, Last Name, Contact Phone Numbers (with Primary toggle), Gender, Date of Birth, Patient main language (with warning: "Wrong language can delay completed results"), Patient Documents upload area (previous CMS-485, assessments, medical charts -- PDF, images, Word, max 10MB each)
   - **Step 2 -- Address & Location:** Patient's address
   - **Step 3 -- Visit Details:** Assessment schedule, Certification Period selection
5. Submits -- case appears in "Nursing Visits" list with status "Needs Attention" ($0 credits)

The template's "Task Type" column (`START_OF_CARE` / `REASSESSMENT` / `SUPERVISORY`) is what drives automatic template selection.

### 5.2 Admin Panel Flow (Full Control)

When a Task Health admin creates a task from `app.taskshealth.com`:

1. Navigate to patient profile and click "New Task" button
2. Fill out the New Patient Task dialog:
   - **Contract and payment:** Contract name, Service code, Payroll code
   - **Select From Task Templates:** Dropdown showing all templates. Selecting one auto-populates documents, duration, priority, and task type
   - **Select Documents:** Dropdown showing pre-checked documents (e.g., "6 selected") -- admin can override
   - **Task Name:** Free text
   - **Start & due date:** Date range picker, with optional "Customize days & hours"
   - **Priority:** 1 (highest) to 5 (lowest)
   - **Cycle period (In Months):** Defines recurring assessment cycle
   - **Task Issues:** Multi-select dropdown
   - **Additional Information:** Free text
3. Choose action:
   - **Broadcast** -- sends task to available RNs
   - **Save** -- saves without broadcasting
   - **Assign directly** -- search and assign a specific nurse

**Prerequisite:** Patient must have a Contract linked under the Administrative tab.

### 5.3 Summary of Differences

| Aspect | Agency Portal | Admin Panel |
|--------|--------------|-------------|
| Template selection | **Automatic** -- based on visit type | **Manual** -- pick from dropdown |
| Document selection | Auto (from template) | Auto (from template) + can override |
| Customization | Minimal -- just visit type + patient info | Full -- all fields editable |
| Certification period | Selected during creation | Selected during creation |
| Who uses it | Agency staff | Task Health internal team |

### 5.4 Certification Period Selection (Both Flows)

During task creation, a **Certification Period** must be selected:

- Dropdown shows existing certification periods for the patient (e.g., "02/17/2026 - 08/16/2026")
- "Add a new certification period" link allows creating one on the fly
- Certification periods are defined per patient under Medical > Summary
- The period links the task's documents to a specific certification window
- For SOC and REASSESSMENT tasks, a 180-day certification period is created by default
- For SUPERVISORY tasks, certification period is skipped (null)

### 5.5 Freedom Care Custom Template Overrides

Freedom Care uses custom template overrides via the `rn_platform_agency_task_template_assoc` table. This table associates a specific agency with a specific task template, overriding the global defaults. When no custom override exists for an agency, the system falls back to global default template IDs from config.

### 5.6 The Complete 10-Step Server Pipeline

When an agency submits a new assessment, the following happens server-side:

**Step 1 -- Create/Find Agency Data:**
- Check if email domain exists as registered agency; if not, register new agency
- Create/find agency member (the submitting user)
- Create/find contract type for RN platform

**Step 2 -- Create/Find Patient:**
- Search for existing patient by phone numbers (default) or by admission ID/DOB
- If found: optionally update existing record
- If not found: insert new patient under `MEDFLYT_AGENCY_ID` with `RN_PLATFORM_OFFICE_ID`
- Create patient contract via `upsertPatientContracts()`
- If caregiver info submitted: create patient contact with relationship "Caregiver"

**Step 3 -- Select Task Template (`getTaskTemplateIdByTaskTypeAndAgencyId`):**
- First check `rn_platform_agency_task_template_assoc` for **custom template per agency**
- If none: fall back to **default templates** from config:
  - `START_OF_CARE` -> `config.RN_PLATFORM_DEFAULT_SOC_TASK_TEMPLATE_ID`
  - `REASSESSMENT` -> `config.RN_PLATFORM_DEFAULT_REASSESSMENT_TASK_TEMPLATE_ID`
  - `SUPERVISORY` -> `config.RN_PLATFORM_DEFAULT_SUPERVISORY_TASK_TEMPLATE_ID`

**Step 4 -- Calculate Broadcast Distance:**
- Get patient's state and county
- Look up `rn_platform_county_miles_broadcast_radius` for county-specific radius
- Default: **40 miles** if no county override
- Convert miles to meters for storage

**Step 5 -- Create Certification Period:**
- SOC and REASSESSMENT: create certification period (180 days default)
- SUPERVISORY: skip (null)

**Step 6 -- Create `patient_task` Record:**
- Links: patient + contract + template + service code + payroll code
- Also creates `patient_task_document` records (from template's document list)

**Step 7 -- Create `patient_task_instance` Record:**
- `is_broadcasting = TRUE`, `caregiver_id = NULL`
- Also creates `patient_task_instance_document` records

**Step 8 -- Broadcast Notification (`notifyRNOnTaskBroadcast`):**
- Find eligible RNs via `getAllCaregvierIdsMatchingTaskBroadcastPushNotification()`
- Send **FCM push notifications** to their devices
- Send **WebSocket events** (`TaskBroadcastsUpdated`) via Socket.IO

**Step 9 -- Attach Uploaded Documents:**
- Agency-uploaded PDFs/images become rows in `patient_documents_scheduled`

**Step 10 -- Schedule Override** (if schedule was provided during submission)

---

## 6. Broadcasting

Broadcasting means making a task instance available in an open marketplace for all eligible RNs to claim.

### 6.1 RN Eligibility Matching

There are two levels of matching:

| Level | Used For | Criteria |
|-------|----------|----------|
| Broad match | Metrics/reporting | Active caregiver + matching certifications |
| Strict match | Push notifications | + Language matching + Distance filtering (haversine) |

### 6.2 Distance-Based Matching

- If `broadcast_distance` is set AND the patient has GPS coordinates, only RNs within that radius receive the broadcast
- If no GPS coordinates exist for the patient, ALL matching RNs get the broadcast
- County-specific radius is looked up from `rn_platform_county_miles_broadcast_radius`
- Default radius: **40 miles** if no county override exists

### 6.3 Language Matching

The RN must speak at least one of the patient's languages (main or secondary language). This is enforced at the strict match level for push notifications.

### 6.4 Certification Matching

The RN's certifications must match the `allowed_certifications` array on the task template. Most nursing assessment templates require the "RN" certification.

### 6.5 RN Acceptance Flow

1. RN sees available broadcasts in the mobile app (via `getAvailableTaskBroadcasts`)
2. RN taps "Accept"
3. Server performs an **atomic UPDATE** with conditions: `is_broadcasting = TRUE AND caregiver_id IS NULL`
4. On success: sets `is_broadcasting = FALSE`, `caregiver_id = {RN's ID}`
5. If 0 rows returned: responds with **409 "ALREADY_ASSIGNED"** -- another RN got it first

This atomic conditional update provides **race condition protection** -- if two RNs tap "Accept" simultaneously, only one succeeds. The other receives a 409 error.

### 6.6 After Acceptance

After accepting a broadcast, the RN must **schedule** the visit date/time. Calling `scheduleTaskDateTime()` creates the `visit_instance` record. The visit instance does NOT exist at task creation time.

---

## 7. Two Submission Paths

| Path | Endpoint | Who | Flow |
|------|----------|-----|------|
| Anonymous | `POST /rn/submit` | First-time agencies | Saves to `rn_platform_website_submission` -> confirmation email -> processes on confirm |
| Authenticated | `POST ./submit` | Logged-in agencies | Processes immediately + duplicate check |

**Duplicate detection:** Checked by admission ID/DOB or name/phone. Returns 409 on duplicate. The portal shows a warning with an option to proceed anyway.

---

## 8. Visit Scheduling

The `visit_instance` record is created **after** an RN accepts a broadcast and schedules the visit -- NOT at task creation time.

**Timeline:**
1. Task created -> `patient_task` and `patient_task_instance` records created. `visit_instance_id` is NULL.
2. Task broadcast -> RN notified. Still no visit instance.
3. RN accepts -> `caregiver_id` set, `is_broadcasting` set to FALSE. Still no visit instance.
4. RN schedules date/time -> `scheduleTaskDateTime()` creates the `visit_instance`, links it via `visit_instance_id`.
5. Visit appears on the Patient Calendar in the admin panel.

**Visit fields visible on the calendar:**
- Date and time range (e.g., 11:45 AM - 12:30 PM)
- Duration (e.g., 0:45h)
- Assigned caregiver/RN name and ID
- Type (RN)
- Status badges: "Assigned Visit" (green), "No Authorization" (red), "Deleted"
- Clock-in time

**Visit statuses in the agency portal:**

| Status | Meaning | Credits |
|--------|---------|---------|
| Needs Attention | Not scheduled, requires action | $0 |
| In Progress | Scheduled, RN assigned or visit underway | $200 |
| Completed | All documents submitted | $200 |

---

## 9. Status Transitions

### PatientTaskInstanceStatus Enum

```
"Completed"
"Incompleted"
"Broadcasting"
"Scheduled"
"ScheduledPendingConfirmation"
"Missing"
"Canceled"
"Assigned"
"Unassigned"
```

### Typical Status Flow

```
Unassigned
    |
    v
Broadcasting  (is_broadcasting = TRUE, caregiver_id = NULL)
    |
    v
Assigned  (RN accepted, is_broadcasting = FALSE, caregiver_id set)
    |
    v
Scheduled  (RN scheduled date/time, visit_instance created)
    |
    v
ScheduledPendingConfirmation  (awaiting patient confirmation)
    |
    v
Completed  (all documents submitted)
```

**Alternative flows:**
- `Broadcasting` -> `Canceled` (task canceled before any RN accepts)
- `Scheduled` -> `Missing` (RN did not show up)
- `Scheduled` -> `Incompleted` (visit started but not all documents submitted)
- Any state -> `Canceled` (task canceled)

### PatientTaskStatus Enum

The parent `patient_task` has its own status that aggregates from its instances:

```
"Future"
"Unassigned"
+ all PatientTaskInstanceStatus values
```

---

## 10. Business Rules

### 10.1 Authorization Matching

- Every visit should have a matching Authorization
- Authorization defines: which days are approved, how many hours, for which contract and service code
- A "No Authorization" red warning appears on the calendar when no matching authorization exists
- This likely blocks billing/payroll processing
- Authorization fields include day-of-week flags (Mo, Tu, We, Th, Fr, Sa, Su), period hours, remaining hours, and max hours

### 10.2 Certification Periods

- Defined per contract: either 90 days or 180 days
- Tracked in Patient > Medical > Summary tab
- The Start of Care date marks the beginning of the first period
- When a period nears expiration, a Reassessment task is needed
- "Overdue Reassessment" warning badge is shown on the patient profile
- "Not Completed" status is shown on the certification period row until the assessment is done
- The `patient_certification_period` table links back to the task instance that created it via `task_instance_id`

### 10.3 "No Authorization" Warning

Visits without a matching authorization display a red "No Authorization" warning tag on the patient calendar. This is a critical compliance issue -- it indicates the visit may not be covered by the patient's approved care plan and likely blocks the billing/invoicing pipeline.

### 10.4 Document Set per Task Type

For a **Start of Care** task, 6 documents are required (26 pages total):

| # | Document | Pages | Template Type |
|---|----------|-------|--------------|
| 1 | Patient Assessment | 8 | `MEDFLYT_PATIENT_ASSESSMENT_HTML` |
| 2 | Aide Supervisory Form | 2 | `MEDFLYT_PARAPROFESSIONAL_SUPERVISORY_HTML` |
| 3 | Plan of Care (POC) | 2 | `MEDFLYT_PLAN_OF_CARE_HTML` |
| 4 | Patient Welcome Package | 8 | `MEDFLYT_WELCOME_PACKAGE_HTML` |
| 5 | Emergency Kardex | 2 | `MEDFLYT_EMERGENCY_KARDEX_HTML` |
| 6 | CMS-485 | 4 | `CMS485` |

Other task types use subsets of these documents (e.g., Reassessment may skip the Welcome Package).

### 10.5 Credit Charges

- $0 charged for visits in "Needs Attention" status (not yet scheduled)
- $200 charged per assessment once scheduled ("In Progress" or "Completed")

---

## 11. Complete Workflow (A to Z)

The end-to-end flow from agency broadcast to document download:

### Step 1: Agency Broadcasts a Case

**From Agency Portal (`go.task-health.com`):**
1. Agency staff logs in
2. Clicks "+ Add Assessment" button
3. Selects visit type: Start of Care / Reassessment / Supervisory
4. System automatically selects the correct Task Template
5. Fills out 3-step wizard (patient info, address, visit details)
6. Submits -- case appears in "Nursing Visits" list with status "Needs Attention" ($0 credits)

**From Admin Panel (`app.taskshealth.com`):**
1. Navigate to patient profile
2. Click "New Task" button
3. Fill out New Patient Task dialog (template, documents, schedule)
4. Choose action: Broadcast / Save / Assign directly
5. Prerequisite: Patient must have a Contract linked

### Step 2: Task Health Schedules & Assigns RN

- Task appears in admin panel under Care & Task Management
- Task is broadcast to eligible RNs (distance + language + certification matching)
- RN accepts the broadcast via mobile app (atomic update with race condition protection)
- RN schedules the visit on a specific date/time -- `visit_instance` created at this point
- Visit appears on Patient Calendar
- Status changes to "In Progress" in agency portal
- $200 credits charged

### Step 3: RN Performs Visit

- RN receives notification via mobile app
- Travels to patient's home
- Opens assigned task in mobile app
- Fills out all required forms question by question
- AI assistance tools help during form completion (per-question AI generation, speech-to-text for narratives, live translation)
- Collects Patient/Representative signature (digital)
- Signs as RN (digital)
- Clicks Submit

### Step 4: Post-Submission Processing

- Form answers stored in database
- Additional questions may be generated based on form answers (AI-driven follow-up)
- Lambda service generates PDFs from HTML templates
- PDFs branded with agency header + Task Health footer
- Document status set to "Done" / "Completed"
- SMS sent to patient and caregiver with document links

### Step 5: Documents Available

**In Admin Panel (Medical > Documents):**
- Each document listed with: Document Type, Origin (Task), Scheduled visit date, Submitted by (RN), Submitted at, Signed at, Status (Done), Certification Period
- Document Change Requests and Task Document Rejections tracked

**In Agency Portal (Patient Detail > Documents tab):**
- Table: Submission Date, Name, Status (Completed), Actions (download)
- "Download All" button for bulk download
- Document SMS Delivery Log shows SMS attempts

### Step 6: Agency Review & Download

- Agency staff views completed documents in portal
- Downloads individual PDFs or uses "Download All"
- Review Status field: N/A (default), Resolved, or other states
- Agency can communicate via Communications and Chat tabs on the visit detail
- Unread Messages indicator visible in main visit list

---

## Entity Relationship Diagram

```
patient_task_template
    |
    |-- patient_task_template_document ---> patient_documents_types
    |                                           |
    v                                           |-- patient_documents_types_versions
patient_task                                    |
    |                                           v
    |-- patient_task_document -----------> patient_documents_types
    |
    v
patient_task_instance
    |
    |-- patient_task_instance_document --> patient_documents_types
    |
    |-- visit_instance_id --------------> visit_instance
    |                                         |
    |                                         |-- visit_authorization
    |                                         |-- patient_documents_scheduled
    |
    |-- contract_id --------------------> contract (patient-contract link)
    |
    |-- patient_id ---------------------> patient
```

---

## Key Enums Reference

| Enum | Values |
|------|--------|
| **PatientTaskInstanceStatus** | Completed, Incompleted, Broadcasting, Scheduled, ScheduledPendingConfirmation, Missing, Canceled, Assigned, Unassigned |
| **PatientTaskStatus** | Future, Unassigned, + all PatientTaskInstanceStatus values |
| **PatientTaskTemplateType** | START_OF_CARE, REASSESSMENT, SUPERVISORY |
| **PatientTaskTemplateContext** | START_OF_CARE, REASSESSMENT |
| **CertificationPeriodType** | START_OF_CARE, REASSESSMENT |
| **PatientDocumentTypes** | GENERAL, CMS485, OCA960, DUTY_SHEET, MEDICATION_PROFILE, SRI, ISR_NHTD, ISR_TBI, MEDFLYT_POC, MEDFLYT_PATIENT_ASSESSMENT_HTML, MEDFLYT_WELCOME_PACKAGE_HTML, MEDFLYT_PLAN_OF_CARE_HTML, MEDFLYT_PARAPROFESSIONAL_SUPERVISORY_HTML, MEDFLYT_EMERGENCY_KARDEX_HTML, PATIENT_ASSESSMENT_HTML_TEST |
