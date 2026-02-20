# Entity Relationships

This document describes the foreign key relationships, join tables, and entity hierarchies in the Task Health database.

---

## Entity Relationship Diagram

The following text-based ERD shows all FK relationships between core tables. Indentation indicates ownership; arrows indicate FK references.

```
agency (id)
  +-- patient (agency)
  +-- patient_task_template (agency_id)
  +-- patient_documents_types (agency)
  +-- visit_instance (agency_id)

patient (id)
  +-- contract (patient) --> patient_authorization (patient_contract_id)
  |                          visit_instance (patient_contract_id)
  |                          patient_task (patient_contract_id)
  |                          patient_task_instance (contract_id)
  |
  +-- patient_certification_period (patient_id)
  |     +-- patient_task (certification_period_id)
  |     +-- patient_task_instance (via task_instance_id FK back)
  |
  +-- patient_task (patient_id)
  |     +-- patient_task_document (task_id) --> patient_documents_types
  |     +-- patient_task_instance (task_id)
  |           +-- visit_instance (via visit_instance_id FK)
  |
  +-- visit_instance (patient_id)
        +-- visit_authorization (visit_instance_id)
        +-- patient_documents_scheduled (visit_instance_id)

patient_task_template (id)
  +-- patient_task (task_template_id)
  +-- patient_task_template_document (task_template_id) --> patient_documents_types

patient_documents_types (id)
  +-- patient_documents_types_versions (patientDocumentTypeId)
  +-- patient_task_template_document (document_id)
  +-- patient_task_document (document_id)
  +-- patient_task_instance_document (document_id)
```

---

## Junction / Join Tables

Junction tables implement many-to-many relationships between core entities.

### patient_task_template_document

Connects **task templates** to **document types**. Defines which documents are required when a task is created from a given template.

| Side A | Side B |
|--------|--------|
| patient_task_template(id) | patient_documents_types(id) |

Constraint: UNIQUE(task_template_id, document_id) -- each document type appears at most once per template.

### patient_task_document

Connects **patient tasks** to **document types**. Created when a task is instantiated from a template; allows per-task overrides of the document set.

| Side A | Side B |
|--------|--------|
| patient_task(id) | patient_documents_types(id) |

### visit_authorization

Connects **visits** to **authorizations**. Records the number of minutes allocated from a given authorization to a specific visit. Enables authorization utilization tracking.

| Side A | Side B | Payload |
|--------|--------|---------|
| visit_instance(id) | patient_authorization(id) | minutes_allocated (INT) |

---

## Common Relationship Patterns

### Pattern 1: Template --> Task --> Instance --> Visit

This is the core task lifecycle chain:

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

### Pattern 2: Patient --> Contract --> Authorization

This is the billing/payer chain:

```
   patient
      |
      | patient (FK)
      v
   contract                 (links patient to a payer/contract type)
      |
      | patient_contract_id
      v
patient_authorization       (approved hours for a service code in a date range)
      |
      | (via visit_authorization junction)
      v
  visit_instance            (minutes consumed against authorization)
```

- A **patient** can have multiple contracts (e.g., one Medicare, one Medicaid).
- Each **contract** can have multiple **authorizations**, each approving a certain number of minutes for a specific service code within a date range.
- When visits are scheduled, the **visit_authorization** junction table tracks how many minutes from each authorization are consumed by each visit.

### Pattern 3: Patient --> Certification Period --> Task

This connects clinical certification cycles to task scheduling:

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
- The certification period can link back to the specific task instance that completed it via `task_instance_id`.
- This bidirectional relationship enables the system to know which task instance satisfied a certification requirement.

### Pattern 4: Document Type --> Versions (Content Versioning)

```
patient_documents_types         (master definition: title, type, display flags)
        |
        | patientDocumentTypeId
        v
patient_documents_types_versions  (versioned form-builder JSON content)
```

- A **document type** is the master record (e.g., "Patient Assessment Form").
- Each document type has one or more **versions** containing the form-builder JSON (questions, sections, conditional logic).
- Only one version per document type should have `isPublished = true` at any time.

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
