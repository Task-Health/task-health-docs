# Entity Relationships

This document describes the foreign key relationships, join tables, and entity hierarchies in the Task Health database. Only core RN platform tables are covered — see [FULL_SCHEMA.md](FULL_SCHEMA.md) for complete table definitions.

---

## Entity Relationship Diagram (Text ERD)

```
agency (id)
  +-- agency_member (agency) --> user (id)
  +-- patient (agency)
  +-- patient_task_template (agency_id)
  +-- patient_documents_types (agency)
  +-- visit_instance (agency_id)
  +-- contract_type (agency) --> payer (agency_id)
  +-- rn_platform_agency_task_template_assoc (agency_id)
  +-- task_credit_agency_balance (rn_platform_agency_id)
  +-- nursing_question (agency_id)
  +-- rn_platform_poc_item_code (agency_id)
  +-- plan_of_care_item_code_pdf_enable (agency_id)

caregiver (id) --> user (id)
  +-- caregiver_agency_assoc (caregiver) --> agency (id)
  +-- caregiver_phonenumber (caregiver)
  +-- caregiver_notification (caregiver)
  +-- patient_task_instance (caregiver_id)
  +-- patient_task_broadcast_caregiver_engagement (caregiver_id)
  +-- visit_instance (caregiver_id)
  +-- patient_documents_scheduled_visit (caregiverId)
  +-- nursing_question_answer (caregiver_id)
  +-- plan_of_care (created_by)

patient (id)
  +-- contract (patient)
  |     +-- contract_type (via contract.contract_type)
  |     +-- patient_authorization (patient_contract_id)
  |     +-- patient_contract_diagnosis_code (patient_contract_id)
  |     +-- patient_task (patient_contract_id)
  |     +-- patient_task_instance (contract_id)
  |
  +-- patient_certification_period (patient_id)
  |     +-- patient_task (certification_period_id)
  |     +-- patient_task_instance (via task_instance_id back-ref)
  |
  +-- patient_task (patient_id)
  |     +-- patient_task_document (task_id) --> patient_documents_types
  |     +-- patient_task_instance (task_id)
  |           +-- visit_instance (via visit_instance_id FK)
  |           +-- patient_task_instance_document (task_instance_id)
  |           +-- patient_task_broadcast_caregiver_engagement (patient_task_instance_id)
  |           +-- patient_document_generation_queue (patient_task_instance_id)
  |           +-- task_credit_reservation (task_instance_id)
  |
  +-- visit_instance (patient_id)
  |     +-- visit_authorization (visit_instance_id)
  |     +-- clockin_clockout_record (visit_instance_id)
  |     +-- invoice_visit (visit_instance_id)
  |
  +-- patient_medication (patient_id)
  +-- patient_medication_profile (patient_id)
  +-- patient_allergy (patient_id)
  +-- patient_staffing_preferences (patient_id)
  +-- nursing_question_answer (patient_id)
  +-- patient_contract_diagnosis_code (via contract)

patient_task_template (id)
  +-- patient_task (task_template_id)
  +-- patient_task_template_document (task_template_id) --> patient_documents_types
  +-- rn_platform_agency_task_template_assoc (task_template_id)

patient_documents_types (id)
  +-- patient_documents_types_versions (patientDocumentTypeId)
  +-- patient_task_template_document (document_id)
  +-- patient_task_document (document_id)
  +-- patient_task_instance_document (document_id)
  +-- patient_documents_scheduled_visit (patientDocumentTypeId)

patient_documents_scheduled_visit (id)
  +-- patient_documents_answers (scheduledVisitDocumentId)
  +-- patient_document_ai_review (scheduled_document_id)
  +-- nursing_question_answer (schedule_visit_document_id)
  +-- patient_document_link (scheduled_document_id)

plan_of_care (id) --> plan_of_care_item_answer --> plan_of_care_item
  +-- plan_of_care_item_answer (plan_of_care) --> plan_of_care_item (id)

contract_type (id) --> payer (id), office (id)
  +-- billing_rate (contract_type_id) --> service_code (id)
  +-- invoice_batch (contract_type_id) --> invoice --> invoice_visit

comm_center_ticket (id)
  +-- comm_center_message (ticket_id)
```

---

## Junction / Join Tables

Junction tables implement many-to-many relationships between core entities.

### patient_task_template_document
Connects **task templates** to **document types**.

| Side A | Side B |
|--------|--------|
| patient_task_template(id) | patient_documents_types(id) |

Constraint: UNIQUE(task_template_id, document_id)

### patient_task_document
Connects **patient tasks** to **document types** (copied from template, can be customized per task).

| Side A | Side B |
|--------|--------|
| patient_task(id) | patient_documents_types(id) |

### patient_task_instance_document
Connects **task instances** to **document types**.

| Side A | Side B |
|--------|--------|
| patient_task_instance(id) | patient_documents_types(id) |

### visit_authorization
Connects **visits** to **authorizations** with allocated minutes.

| Side A | Side B | Payload |
|--------|--------|---------|
| visit_instance(id) | patient_authorization(id) | minutes_allocated (INT) |

### patient_task_broadcast_caregiver_engagement
Connects **task instances** to **caregivers** who viewed a broadcast.

| Side A | Side B | Payload |
|--------|--------|---------|
| patient_task_instance(id) | caregiver(id) | created_at, viewed_at |

Constraint: UNIQUE(patient_task_instance_id, caregiver_id)

### caregiver_agency_assoc
Connects **caregivers** to **agencies** (a caregiver can work with multiple agencies).

| Side A | Side B | Payload |
|--------|--------|---------|
| caregiver(id) | agency(id) | caregiverCode, status |

Constraint: UNIQUE(caregiver, agency)

### invoice_visit
Connects **visits** to **invoices** with billing details.

| Side A | Side B | Payload |
|--------|--------|---------|
| visit_instance(id) | invoice(id) | billing_units, billing_rate_id, visit_date |

### rn_platform_agency_task_template_assoc
Connects **agencies** to their **task templates** for each task type on the RN platform.

| Side A | Side B | Payload |
|--------|--------|---------|
| agency(id) | patient_task_template(id) | task_type ('START_OF_CARE' / 'REASSESSMENT') |

Constraint: PRIMARY KEY(agency_id, task_type) — one template per type per agency

### nursing_question_agency_setting
Per-agency visibility settings for nursing questions.

| Side A | Side B | Payload |
|--------|--------|---------|
| nursing_question(id) | agency(id) | show_on_patient, show_on_agency |

Constraint: UNIQUE(question_id, agency_id)

---

## Common Relationship Patterns

### Pattern 1: Template → Task → Instance → Visit (Task Lifecycle)

```
patient_task_template       (agency-level reusable definition)
        |
        | task_template_id
        v
   patient_task             (patient-specific assignment with date range)
        |
        | task_id
        v
patient_task_instance       (individual occurrence / recurrence cycle)
        |
        | visit_instance_id
        v
  visit_instance            (calendar visit with clock-in/out)
```

- A **template** is created once per agency and defines the task type, required certifications, duration, and attached documents.
- A **task** is created when that template is assigned to a specific patient under a specific contract. It carries start/due dates, priority, and recurrence settings.
- A **task instance** is the individual occurrence. For non-recurring tasks there is one instance; for recurring tasks (e.g., every 2 months), a new instance is spawned per cycle. The instance tracks broadcasting, caregiver assignment, patient confirmation, and completion.
- A **visit instance** is created when the task instance is scheduled on the calendar. It holds the actual clock-in/out times, GPS data, and billing flags.

### Pattern 2: Patient → Contract → Authorization → Visit Billing

```
   patient
      |
      | patient (FK)
      v
   contract                 (links patient to a payer/contract type)
      |
      | patient_contract_id
      v
patient_authorization       (approved minutes for a service code in a date range)
      |
      | (via visit_authorization junction)
      v
  visit_instance            (minutes consumed against authorization)
```

- A **patient** can have multiple contracts (e.g., one Medicare, one Medicaid).
- Each **contract** can have multiple **authorizations**, each approving minutes for a service code within a date range.
- The **visit_authorization** junction table tracks minutes consumed per visit.

### Pattern 3: Patient → Certification Period ↔ Task (Bidirectional)

```
       patient
          |
          | patient_id
          v
patient_certification_period    (60-day clinical window: SOC or Reassessment)
    |               ^
    | cert_period_id |  task_instance_id
    v               |
patient_task     patient_task_instance
```

- A **certification period** defines a 60-day clinical window (Start of Care or Reassessment).
- Tasks can be linked to a certification period via `certification_period_id`.
- The certification period links back to the task instance that completed it via `task_instance_id`.
- This bidirectional relationship enables tracking which task instance satisfied a certification requirement.

### Pattern 4: Document Type → Version → Scheduled Visit → Answers

```
patient_documents_types           (master definition: title, type, display flags)
        |
        | patientDocumentTypeId
        v
patient_documents_types_versions  (versioned form-builder JSON content)
        |
        | (referenced by)
        v
patient_documents_scheduled_visit (per-visit document instance for a caregiver)
        |
        +-- patient_documents_answers (individual question answers)
        +-- patient_document_ai_review (AI review results)
        +-- nursing_question_answer (database-linked question answers)
        +-- patient_document_link (shareable PDF download links)
```

- Only one version per document type has `isPublished = true`.
- `patient_documents_scheduled_visit` is the concrete instance tying a version to a visit+caregiver.
- Answers flow into both the `patient_documents_answers` table (per-question) and the `nursing_question_answer` table (for database-linked questions that propagate across documents).

### Pattern 5: Credit Lifecycle (Task Instance → Reservation → Balance)

```
patient_task_instance
        |
        | task_instance_id
        v
task_credit_reservation    (credits consumed, latest=true for current)
        |
        | (aggregated into)
        v
task_credit_agency_balance (total_credits_purchased, total_credits_reserved)
        ^
        |
task_credit_stripe_invoice (credits purchased via Stripe)
```

- Credits are pre-purchased via Stripe (recorded in `task_credit_stripe_invoice`).
- Each task instance consumes credits via `task_credit_reservation`.
- `task_credit_agency_balance` tracks the running balance per agency.
- The `latest` flag on reservations supports adjustments (new reservation replaces old).

### Pattern 6: Nursing Questions → Cross-Document Propagation

```
nursing_question (database_link = DatabaseLinkType enum)
        |
        | question_id
        v
nursing_question_answer (patient_id, schedule_visit_document_id)
        ^
        |
patient_documents_scheduled_visit (answers linked via schedule_visit_document_id)
```

- `nursing_question.database_link` maps to one of 61 `DatabaseLinkType` values.
- When a document has a `PatientDocumentContentItem` with `nursingQuestionLinked`, the answer is stored/read from `nursing_question_answer`.
- These answers propagate across documents — e.g., allergies entered in Patient Assessment appear in CMS-485.
- The `nursing_question_answer` table is the **single source of truth** for cross-document data.

### Pattern 7: Plan of Care — Two Parallel Systems

**System A: Legacy POC** (caregiver-facing, per-agency duties)

```
plan_of_care_item             (per-agency duty reference items)
        |
        | plan_of_care_item (FK)
        v
plan_of_care_item_answer      (selected duties for a specific POC)
        |
        | plan_of_care (FK)
        v
plan_of_care                  (POC document instance, linked to treatment)
```

- Legacy POC duties are stored in `plan_of_care_item` table, scoped per agency via `planOfCareTypeId` → `plan_of_care_type`.
- NOT used by the RN Platform.

**System B: RN Platform POC** (RN-facing, hardcoded in TypeScript)

```
patient_documents_types_versions  (JSONB content with itemType: "POC", POCItems array)
        |
        | (defines duty list for mobile + adapter)
        v
patient_documents_answers         (POC answers: zPOCItemsDocumentAnswer[])
        |
        | (read by adapter at PDF generation)
        v
TypeScript adapter (v1-v7)        (maps answers → HTML template fields)
        |
        v
HTML template                     (renders checkboxes + frequency + IVR codes)

rn_platform_poc_item_code         (per-agency custom IVR/HHA Exchange codes)
plan_of_care_item_code_pdf_enable (flag per agency: show codes on PDF)
```

- RN Platform POC duties are defined in TypeScript constants (`planOfCareItemsV7`) — NOT in a DB table.
- Duty list flows through: form builder JSONB (`POCItems`) → AI prompt → mobile → adapter → HTML/PDF.
- Answer format: `{ item: string, attributes: TaskWhenToPerform, notes: string | null }` where `TaskWhenToPerform = EveryVisit | OnDaysOfWeek { frequency } | AsRequestedByPatient`.
- Each agency can customize IVR codes via `rn_platform_poc_item_code` (3-digit codes for HHA Exchange phone system).
- `plan_of_care_item_code_pdf_enable` controls whether codes appear on the agency's PDFs.
- POC duties also map to supervisory competency questions via `poc-to-supervisory-mapping.v2.ts`.

### Pattern 8: Comm Center → Tickets → Messages

```
comm_center_team
        |
        | team_id
        v
comm_center_ticket (agency_id, caregiver_id, patient_id)
        |
        | ticket_id
        v
comm_center_message (payload, caregiver_id XOR agency_member_id)
```

- Tickets are scoped to an agency and optionally linked to a caregiver/patient.
- Messages can be from caregivers, agency members, or system-generated.
- The author constraint ensures non-system messages have exactly one author.

---

## Three-Level Task Hierarchy

The task system uses a three-level hierarchy that separates concerns cleanly:

### Level 1: Template (`patient_task_template`)

- **Scope:** Agency-wide
- **Purpose:** Reusable definition of a task type
- **Key data:** Title, allowed caregiver certifications, expected duration, priority, type (SOC / Reassessment / Supervisory)
- **Documents:** Linked via `patient_task_template_document` junction table
- **Lifecycle:** Created once by admin; soft-deleted via `removed_at` when retired

### Level 2: Task (`patient_task`)

- **Scope:** Patient-specific
- **Purpose:** An assignment of a template to a specific patient under a specific contract
- **Key data:** Start/due dates, priority, recurrence settings (`repeat_months`), pre-assigned caregiver, service/payroll codes, pricing
- **Documents:** Linked via `patient_task_document` junction table (copied from template, can be customized)
- **Lifecycle:** Can be in draft (`is_draft`), active, canceled (`canceled_at`), or removed (`removed_at`)

### Level 3: Instance (`patient_task_instance`)

- **Scope:** Single occurrence
- **Purpose:** The actual work item that gets scheduled, broadcast, assigned, and completed
- **Key data:** Caregiver assignment, schedule date/time, broadcasting state, patient confirmation, completion date, link to visit
- **Calendar link:** `visit_instance_id` connects this instance to a calendar visit
- **Status values:** Unassigned, Assigned, Broadcasting, Scheduled, ScheduledPendingConfirmation, Completed, Incompleted, Missing, Canceled
- **Lifecycle:** Created from parent task; one instance for one-time tasks, multiple instances for recurring tasks (one per cycle)

### Why Three Levels?

| Concern | Template | Task | Instance |
|---------|----------|------|----------|
| Who defines it? | Agency admin | Coordinator | System (auto-generated) |
| How many per patient? | 0 (not patient-specific) | 1 per assignment | 1+ per task (depends on recurrence) |
| Holds documents? | Yes (default set) | Yes (can override) | References parent |
| Has a calendar visit? | No | No | Yes (via visit_instance_id) |
| Has a caregiver? | No (defines certifications) | Optional (pre-assignment) | Yes (actual assignment) |
| Tracks completion? | No | No | Yes (completion_date, status) |

This separation allows templates to be reused across patients, tasks to capture patient-specific scheduling and billing parameters, and instances to track the real-world execution of each occurrence.

---

## FK Index Reference

Key indexes on foreign key columns (performance-critical for JOINs):

| Table | FK Column(s) | Index |
|-------|-------------|-------|
| patient_task_instance | task_id | Yes |
| patient_task_instance | visit_instance_id | Yes |
| patient_task_instance | caregiver_id | Yes |
| patient_task_broadcast_caregiver_engagement | patient_task_instance_id | Yes |
| patient_task_broadcast_caregiver_engagement | caregiver_id | Yes |
| visit_instance | patient_id | Yes |
| visit_instance | caregiver_id | Yes |
| visit_instance | agency_id | Yes |
| contract | patient | Yes |
| contract | contract_type | Yes |
| patient_documents_answers | scheduledVisitDocumentId | Yes |
| nursing_question_answer | question_id | Yes |
| nursing_question_answer | patient_id | Yes |
| task_credit_reservation | task_instance_id | Yes (+ unique where latest) |
| comm_center_message | ticket_id | Yes |
