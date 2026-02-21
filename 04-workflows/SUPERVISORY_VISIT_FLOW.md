# Supervisory Visit Flow

> How supervisory visits connect to the Plan of Care, aide evaluation, and the POC ↔ Supervisory mapping.

---

## 1. Trigger

A supervisory visit task is created when:
- Agency coordinator assigns a Paraprofessional Supervisory Visit for a patient
- Typically required periodically (every 2 weeks or as mandated by the state)
- The supervising RN evaluates the aide's (HHA's) performance against the current Plan of Care

**Preconditions:**
- Patient has an active Plan of Care (POC) document
- Patient has an active contract
- Agency has a supervisory task template configured (`type = 'SUPERVISORY'`)

---

## 2. What Makes Supervisory Visits Different

| Aspect | SOC / Reassessment | Supervisory Visit |
|--------|-------------------|-------------------|
| Purpose | Clinical assessment of patient | Evaluation of aide performance |
| Document | Patient Assessment + CMS-485 + POC | Paraprofessional Supervisory Form |
| RN evaluates | Patient condition | Aide (HHA) competency |
| POC connection | Creates/updates POC | Reads POC duties, evaluates compliance |
| Certification period | Yes | No |
| Template type | `type = 'START_OF_CARE'` / `'REASSESSMENT'` | `type = 'SUPERVISORY'` |
| Document type | Various | `MEDFLYT_PARAPROFESSIONAL_SUPERVISORY_HTML` |

---

## 3. Step-by-Step Flow

### Step 1: Task Creation
Same as SOC flow Steps 1-2, but:
- Template has `type = 'SUPERVISORY'`
- No certification period is created or linked
- Document set is typically just the Paraprofessional Supervisory Form

### Step 2: Broadcasting → Assignment → Scheduling
Same as SOC flow Steps 2-5.

### Step 3: RN Visits and Fills Supervisory Form

The supervisory form evaluates the aide's performance against the current POC duties:

**POC ↔ Supervisory Connection:**

The key mapping is handled by `poc-to-supervisory-mapping.v2.ts` and `applySupervisoryDocumentAdjustmentsV2()`:

1. System reads the patient's current active POC
2. Identifies which of the 42 duties are selected in the POC
3. The supervisory form dynamically shows only the relevant duty evaluation questions
4. For each selected POC duty, the RN rates the aide's performance

**Form structure:**
- Patient information (auto-populated from database)
- Aide identification
- Per-duty evaluation (only duties from current POC):
  - Was the duty performed?
  - Quality of performance
  - Notes/observations
- Overall aide evaluation
- RN recommendations
- Signatures (RN + patient)

### Step 4: Submission & PDF Generation
Same pipeline as other documents:
- Submit → AI review (if enabled) → PDF generation → SMS delivery
- PDF uses `MEDFLYT_PARAPROFESSIONAL_SUPERVISORY_HTML` template (Pipeline 1: HTML)

---

## 4. POC-to-Supervisory Mapping Detail

**Key file:** `taskhealth_server2/src/rn-platform/.../poc-to-supervisory-mapping.v2.ts`

**Function:** `applySupervisoryDocumentAdjustmentsV2()`

**How it works:**

```
Plan of Care (active, most recent)
  |
  +-- plan_of_care_item_answer (selected duties)
        |
        +-- plan_of_care_item (id, section_name, label, code)
              |
              | (mapping table in poc-to-supervisory-mapping.v2.ts)
              v
        Supervisory Form Questions
        (dynamically show/hide based on which POC duties are selected)
```

1. When RN opens the supervisory form, the system:
   - Fetches the patient's most recent submitted POC
   - Gets all `plan_of_care_item_answer` records (selected duties)
   - Maps each POC duty to corresponding supervisory evaluation questions
   - Sets visibility flags on the supervisory form content items

2. Duty categories mapped:
   - **Personal Care** — bathing, grooming, dressing, toileting, etc.
   - **Nutritional** — meal prep, feeding assistance, etc.
   - **Environmental** — cleaning, laundry, etc.
   - **Health Related** — medication reminders, vital signs, exercises
   - **Other** — escort, companionship, etc.
   - **Communication** — reporting changes, emergency procedures

3. If a duty is NOT in the POC → the corresponding supervisory question is hidden
4. If a duty IS in the POC → RN must evaluate it

---

## 5. Tables Touched

| Table | Operation | Step |
|-------|-----------|------|
| patient_task, patient_task_instance | INSERT | Task creation |
| plan_of_care | READ | Form setup (get active POC) |
| plan_of_care_item_answer | READ | Form setup (get selected duties) |
| plan_of_care_item | READ | Mapping to supervisory questions |
| patient_documents_scheduled_visit | UPDATE | Submission |
| patient_documents_answers | INSERT/UPDATE | Form filling |
| patient_document_ai_review | INSERT | AI review (if enabled) |
| patient_document_generation_queue | INSERT | PDF generation |

---

## 6. Edge Cases & Gotchas

- **No active POC:** If the patient doesn't have a submitted POC, the supervisory form may show all duties or show a warning. The mapping function handles this gracefully.
- **POC updated between visits:** The supervisory form always reads the MOST RECENT POC. If the POC was updated since the last supervisory visit, the duty set may differ.
- **Multiple POC versions:** Only the latest submitted POC is considered. Previous versions are ignored.

---

## 7. Code Paths

| Component | Repo | Key Files |
|-----------|------|-----------|
| POC → Supervisory mapping | taskhealth_server2 | `src/rn-platform/.../poc-to-supervisory-mapping.v2.ts` |
| Supervisory adjustments | taskhealth_server2 | `applySupervisoryDocumentAdjustmentsV2()` |
| Form rendering | taskhealth-mobile2 | Standard document question components |
| PDF template | html-to-pdf-lambda | `MEDFLYT_PARAPROFESSIONAL_SUPERVISORY_HTML` template |
