# Reassessment Flow

> How reassessments differ from Start of Care. Reassessments are recurring visits that maintain patient certification.

---

## 1. Trigger

A reassessment task is created when:
- A previous certification period is nearing expiration (typically 60-day windows)
- The agency coordinator creates a new reassessment task for the patient
- The system may auto-create reassessment tasks based on `repeat_months` on the parent task

**Preconditions:**
- Patient has a completed SOC certification period
- Patient has an active contract
- Agency has a reassessment task template configured (via `rn_platform_agency_task_template_assoc` with `task_type = 'REASSESSMENT'`)

---

## 2. How It Differs From SOC

| Aspect | Start of Care | Reassessment |
|--------|--------------|--------------|
| Template context | `context = 'START_OF_CARE'` | `context = 'REASSESSMENT'` |
| Certification period type | `type = 'START_OF_CARE'` | `type = 'REASSESSMENT'` |
| Recurrence | One-time (typically) | Can be recurring (`repeat_months`) |
| Documents | Full set (Assessment, CMS-485, POC, Welcome Pkg, Kardex) | Typically subset (Assessment + CMS-485 + POC) |
| "Copy From Last Time" | Not available (first visit) | Available — copies answers from previous assessment |
| AI generation context | No prior data to reference | Can reference previous visit answers |
| Certification period | Creates new initial period | Creates new reassessment period linked to previous |

---

## 3. Step-by-Step Flow

The flow follows the same 11 steps as SOC (see [START_OF_CARE_FLOW.md](START_OF_CARE_FLOW.md)), with these differences:

### Step 1: Task Creation
- Template has `context = 'REASSESSMENT'` and `type = 'REASSESSMENT'`
- Certification period created with `type = 'REASSESSMENT'`
- If parent task has `repeat_months`, system may auto-generate the next instance

### Step 6: RN Fills Forms
- **"Copy From Last Time" button** is available on document forms
  - `CopyFromLastTimeButton` fetches answers from the most recent completed document of the same type
  - All answers bulk-inserted into current form
  - RN reviews and updates as needed
- Database-linked questions (`nursingQuestionLinked`) auto-populate from the nursing database
  - Some are `blockOnMobile = true` (read-only) if values exist
  - Exception: Allergies question is **never** blockOnMobile (always editable)
  - Certification period dates: blockOnMobile only if BOTH from_date and to_date have values

### Step 7: Submission
- Same invisible question generation
- Cross-document data propagation updates `nursing_question_answer` records (which become the source for the NEXT reassessment)

### Step 9: PDF Generation
- Same pipelines, but reassessment documents may have slightly different PDF templates

---

## 4. Recurrence Cycle

For recurring reassessments:

```
patient_task (repeat_months = 2)
  |
  +-- patient_task_instance #1 (Jan-Feb cert period) → Completed
  +-- patient_task_instance #2 (Mar-Apr cert period) → Completed
  +-- patient_task_instance #3 (May-Jun cert period) → In Progress
  ...
```

Each instance:
1. Has its own `start_date` / `due_date` (offset by `repeat_months` from previous)
2. Links to its own `patient_certification_period`
3. Links to its own `visit_instance`
4. Goes through the full broadcast → assign → schedule → visit → submit → review → PDF cycle

---

## 5. Certification Period Continuity

```
SOC Period:            [Jan 1 -------- Mar 1]
                                        |
Reassessment Period 1: [Mar 1 -------- May 1]
                                        |
Reassessment Period 2: [May 1 -------- Jul 1]
```

- Each period is 60 days
- The `patient_certification_period.task_instance_id` links back to the task instance that completed it
- The system uses this chain to determine the patient's current certification status

---

## 6. Tables Touched

Same as SOC flow (see [START_OF_CARE_FLOW.md](START_OF_CARE_FLOW.md#5-tables-touched-summary)), with the addition of:
- Previous `patient_documents_answers` and `nursing_question_answer` records (READ for "Copy From Last Time")
- Previous `patient_certification_period` (READ for period continuity)

---

## 7. Decision Points

| Decision | Condition | Branch |
|----------|-----------|--------|
| Auto-create next instance? | `repeat_months` set on parent task | Yes: new instance auto-created with offset dates |
| Copy from last time? | Previous completed document exists | Button available for RN |
| Block database-linked questions? | `nursingQuestionLinked` + value exists | `blockOnMobile = true` (read-only) except allergies |
