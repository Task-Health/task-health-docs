# Full Database Schema

Complete table schemas for the Task Health system, extracted from the core PostgreSQL database. All tables use Flyway-style versioned migrations (e.g., `V0504` = migration file `V0504__patient_tasks.sql`).

---

## patient

Description: Core patient record. Every patient belongs to a single agency and holds demographic, contact, insurance, and care-coordination data.
Migration: V0090 (`V0090__PatientsTable.sql`)

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| first_name | TEXT | NOT NULL | | |
| last_name | TEXT | NOT NULL | | |
| gender | TEXT | YES | | "M" / "F" |
| date_of_birth | TIMESTAMPTZ | YES | | |
| ssn | TEXT | YES | | Social Security Number |
| home_phone_number | TEXT | YES | | |
| mobile_phone_number | TEXT | YES | | |
| address | TEXT | YES | | |
| address_components | JSONB | YES | | Structured address parts |
| agency | INT | NOT NULL | agency(id) | Owning agency |
| status | TEXT | NOT NULL | | PatientStatus enum |
| main_language | TEXT | YES | | |
| secondary_language | TEXT | YES | | |
| start_of_care | DATE | YES | | Added in V0804 |
| medicare_number | TEXT | YES | | |
| medicaid_number | TEXT | YES | | |
| email | TEXT | YES | | Added in V0790 |
| priority_code | INT | YES | | |
| assigned_coordinator | INT | YES | agency_member(id) | |
| assigned_sales_rep | INT | YES | agency_member(id) | |
| source | INT | YES | referral_source(id) | |
| created_at | TIMESTAMPTZ | NOT NULL | | |
| created_by | INT | YES | agency_member(id) | |

---

## patient_task_template

Description: Reusable task template defined per agency. Specifies what certifications are required, expected duration, priority, and whether the template is for Start of Care, Reassessment, or Supervisory visits. Templates are linked to document types via the junction table `patient_task_template_document`.
Migration: V0504 (`V0504__patient_tasks.sql`), modified in V0729

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| title | TEXT | NOT NULL | | Template name |
| agency_id | INT | NOT NULL | agency(id) | Owning agency |
| allowed_certifications | JSONB | NOT NULL | | Array of CaregiverCertification values |
| duration_minutes | INT | YES | | Expected visit duration |
| priority | INT | NOT NULL | | 1-5 |
| context | TEXT | YES | | CHECK: NULL, 'START_OF_CARE', 'REASSESSMENT' |
| type | TEXT | YES | | 'START_OF_CARE' / 'REASSESSMENT' / 'SUPERVISORY' -- drives auto-selection |
| plan_of_care_type_id | INT | YES | plan_of_care_type(id) | |
| created_at | TIMESTAMPTZ | NOT NULL | | |
| removed_at | TIMESTAMPTZ | YES | | Soft delete timestamp |

---

## patient_task_template_document

Description: Junction table linking task templates to their required document types. A template can require multiple documents, and a document type can be used across multiple templates.
Migration: V0504 (`V0504__patient_tasks.sql`)

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| task_template_id | INT | NOT NULL | patient_task_template(id) | |
| document_id | INT | NOT NULL | patient_documents_types(id) | |

Constraints: UNIQUE(task_template_id, document_id)

---

## patient_task

Description: A concrete task assigned to a specific patient under a specific contract. Created from a template. A task can spawn multiple task instances (one per recurrence cycle). Holds scheduling parameters, pricing, and assignment info.
Migration: V0504 (`V0504__patient_tasks.sql`), V0646 (`V0646__new_task.sql`), V0847

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| agency_id | INT | NOT NULL | agency(id) | |
| task_template_id | INT | NOT NULL | patient_task_template(id) | Links to template |
| patient_id | INT | NOT NULL | patient(id) | |
| patient_contract_id | INT | NOT NULL | contract(id) | Links to agency/payer contract |
| title | TEXT | NOT NULL | | |
| start_date | DATE | NOT NULL | | |
| due_date | DATE | NOT NULL | | |
| priority | INT | NOT NULL | | 1-5 |
| repeat_months | INT | YES | | Cycle period for recurring tasks |
| is_draft | BOOLEAN | NOT NULL | | |
| caregiver_id | INT | YES | caregiver(id) | Pre-assigned RN |
| certification_period_id | INT | YES | patient_certification_period(id) | Added in V0847 |
| service_code_id | INT | NOT NULL | service_code(id) | |
| payroll_code_id | INT | YES | payroll_code(id) | |
| day_time_params | JSONB | YES | | Custom schedule parameters |
| is_future_assigned | BOOLEAN | NOT NULL | | |
| price | INT | YES | | |
| canceled_at | TIMESTAMPTZ | YES | | Soft cancel timestamp |
| removed_at | TIMESTAMPTZ | YES | | Soft delete timestamp |

---

## patient_task_document

Description: Junction table linking a patient task to its required document types. Mirrors the template-level association but at the task level (allowing per-task customization).
Migration: V0504 (`V0504__patient_tasks.sql`)

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| task_id | INT | NOT NULL | patient_task(id) | |
| document_id | INT | NOT NULL | patient_documents_types(id) | |

---

## patient_task_instance

Description: The individual occurrence of a task -- the actual assignment that gets scheduled, broadcast to caregivers, and completed. A `patient_task` can spawn multiple `patient_task_instance` records (one per recurrence cycle). This is the entity that links to a calendar visit via `visit_instance_id`.
Migration: V0504 (`V0504__patient_tasks.sql`), V0646 (`V0646__new_task.sql`), V0867

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| task_id | INT | NOT NULL | patient_task(id) | Parent task |
| patient_id | INT | NOT NULL | patient(id) | |
| contract_id | INT | NOT NULL | contract(id) | |
| caregiver_id | INT | YES | caregiver(id) | Assigned RN |
| start_date | DATE | NOT NULL | | |
| due_date | DATE | NOT NULL | | |
| duration_minutes | INT | YES | | |
| completion_date | DATE | YES | | When completed |
| schedule_date_time | TIMESTAMPTZ | YES | | Scheduled visit time |
| visit_instance_id | INT | YES | visit_instance(id) | Links to calendar visit (V0646) |
| is_broadcasting | BOOLEAN | NOT NULL | | Currently being broadcast to caregivers |
| broadcast_distance | INT | YES | | Broadcast radius |
| patient_confirmed | BOOLEAN | NOT NULL | | Patient confirmed the visit |
| patient_confirmed_at | TIMESTAMPTZ | YES | | |
| confirmation_type | TEXT | YES | | |
| is_active | BOOLEAN | NOT NULL | | |
| price | INT | YES | | |
| service_code_id | INT | NOT NULL | service_code(id) | |
| payroll_code_id | INT | YES | payroll_code(id) | |
| agency_note | TEXT | YES | | |
| canceled_at | TIMESTAMPTZ | YES | | Soft cancel timestamp |
| removed_at | TIMESTAMPTZ | YES | | Soft delete timestamp |

**Status enum -- PatientTaskInstanceStatus:**
`"Completed" | "Incompleted" | "Broadcasting" | "Scheduled" | "ScheduledPendingConfirmation" | "Missing" | "Canceled" | "Assigned" | "Unassigned"`

---

## visit_instance

Description: The calendar visit -- an actual scheduled time slot with clock-in/out tracking, GPS location capture, billing flags, and issue tracking. This is the entity that appears on the caregiver's and coordinator's calendar. Created either directly (regular visits) or from a task instance (task-based visits, marked with `is_task = true`).
Migration: V0236 (`V0236__Add_lots_of_Billing_related_tables.sql`), heavily modified in subsequent migrations

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| patient_id | INT | NOT NULL | patient(id) | |
| caregiver_id | INT | YES | caregiver(id) | |
| patient_contract_id | INT | YES | contract(id) | |
| start_time / end_time | TIMESTAMP | NOT NULL | | Scheduled time (local) |
| start_time_utc / end_time_utc | TIMESTAMPTZ | NOT NULL | | Scheduled time (UTC) |
| clockin_time / clockout_time | TIMESTAMP | YES | | Actual clock times (local) |
| clockin_time_utc / clockout_time_utc | TIMESTAMPTZ | YES | | Actual clock times (UTC) |
| clockin_location / clockout_location | JSONB | YES | | GPS coordinates |
| clockin_type / clockout_type | TEXT | YES | | How clock was performed |
| service_code_id | INT | YES | service_code(id) | |
| payroll_code_id | INT | YES | payroll_code(id) | |
| office_id | INT | NOT NULL | office(id) | |
| agency_id | INT | NOT NULL | agency(id) | |
| timezone | TEXT | NOT NULL | | IANA timezone |
| state | TEXT | NOT NULL | | US state code |
| county_name | TEXT | NOT NULL | | |
| missed_visit | BOOLEAN | NOT NULL | | |
| billable | BOOLEAN | NOT NULL | | |
| is_task | BOOLEAN | NOT NULL | | Marks task-created visits (V0646) |
| duty_sheet_fill_percentage | INT | YES | | |
| is_summary_submitted | BOOLEAN | YES | | |
| travel_time_seconds | INT | NOT NULL | | |
| was_imported | BOOLEAN | NOT NULL | | |
| manual_clock_time_edit_approved | BOOLEAN | NOT NULL | | |
| clock_distance_approved | BOOLEAN | NOT NULL | | |
| removed_at | TIMESTAMPTZ | YES | | Soft delete timestamp |
| show_on_calendar_when_deleted | BOOLEAN | NOT NULL | | |
| 20+ issue tracking columns | BOOLEAN | | | issue_has_patient_overlap, etc. |

---

## patient_documents_types

Description: Master document type definition. Each record defines a form/document that an agency uses (e.g., Patient Assessment, CMS-485, Plan of Care). Controls header display flags and whether AI review is required. Actual form content is stored in the versions table.
Migration: V0163 (`V0163__PatientDocuments.sql`)

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| title | TEXT | YES | | Document name |
| type | TEXT | YES | | PatientDocumentTypes enum |
| agency | INT | YES | agency(id) | |
| is_template | BOOLEAN | NOT NULL | | |
| require_ai_review | BOOLEAN | NOT NULL | | |
| show_patient_name | BOOLEAN | NOT NULL | | Header display flag |
| show_patient_gender | BOOLEAN | NOT NULL | | Header display flag |
| show_patient_address | BOOLEAN | NOT NULL | | Header display flag |
| show_patient_phone | BOOLEAN | NOT NULL | | Header display flag |
| show_patient_dob | BOOLEAN | NOT NULL | | Header display flag |
| show_caregiver_name | BOOLEAN | NOT NULL | | Header display flag |
| show_patient_contract | BOOLEAN | NOT NULL | | Header display flag |
| show_general_details_on_every_page | BOOLEAN | NOT NULL | | |

---

## patient_documents_types_versions

Description: Versioned content for a document type. Each version holds the full form-builder JSON (questions, sections, conditional logic). Only one version per document type should be published at a time.
Migration: V0163 (`V0163__PatientDocuments.sql`)

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| patientDocumentTypeId | INT | NOT NULL | patient_documents_types(id) | Parent document type |
| content | JSONB | YES | | Form builder JSON (questions/sections structure) |
| isPublished | BOOLEAN | NOT NULL | | Whether this version is the active one |
| html_template_version_id | INT | YES | | References HTML template version |

---

## contract

Description: Links a patient to a payer/agency contract. A patient can have multiple contracts (e.g., Medicare + Medicaid). One contract is marked as primary. Contracts carry insurance member IDs and date ranges.
Migration: V0092 (`V0092__Treatments.sql`)

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| contract_type | INT | NOT NULL | contract_type(id) | Agency/payer type |
| patient | INT | NOT NULL | patient(id) | |
| start_date | DATE | NOT NULL | | |
| end_date | DATE | YES | | |
| is_primary | BOOLEAN | NOT NULL | | |
| is_on_hold | BOOLEAN | YES | | |
| member_id | TEXT | NOT NULL | | Insurance member ID |
| medicaid_number | TEXT | YES | | |
| medicare_number | TEXT | YES | | |
| discharge_date | DATE | YES | | |

---

## patient_authorization

Description: Authorization record defining how many minutes of a specific service code are approved for a patient contract within a date range. Despite column names `hours` and `max_hours`, values are stored in minutes. Supports daily day-of-week minute allocations.
Migration: V0236 (`V0236__Add_lots_of_Billing_related_tables.sql`), renamed in V0456

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| code | TEXT | YES | | Authorization code |
| patient_contract_id | INT | NOT NULL | contract(id) | |
| service_code_id | INT | NOT NULL | service_code(id) | |
| start_date | DATE | NOT NULL | | |
| end_date | DATE | NOT NULL | | |
| hours | INT | NOT NULL | | Actually stores minutes |
| max_hours | INT | NOT NULL | | Actually stores max minutes |
| period_type | TEXT | NOT NULL | | DAILY / WEEKLY / MONTHLY / ENTIRE_PERIOD |
| monday | INT | YES | | Daily minute allocation |
| tuesday | INT | YES | | Daily minute allocation |
| wednesday | INT | YES | | Daily minute allocation |
| thursday | INT | YES | | Daily minute allocation |
| friday | INT | YES | | Daily minute allocation |
| saturday | INT | YES | | Daily minute allocation |
| sunday | INT | YES | | Daily minute allocation |
| first_day_of_week | TEXT | NOT NULL | | |

---

## visit_authorization

Description: Junction table linking visits to authorizations. Records how many minutes from a given authorization were allocated to a specific visit.
Migration: V0236 (`V0236__Add_lots_of_Billing_related_tables.sql`)

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| visit_instance_id | INT | NOT NULL | visit_instance(id) | |
| patient_authorization_id | INT | NOT NULL | patient_authorization(id) | |
| minutes_allocated | INT | NOT NULL | | Minutes consumed from the authorization |

---

## patient_certification_period

Description: Defines a certification period for a patient (typically 60-day windows). Each period is typed as either Start of Care or Reassessment. Can link back to the task instance that created/satisfied it.
Migration: V0729 (`V0729__patient_start_of_care_changes.sql`)

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| patient_id | INT | NOT NULL | patient(id) | |
| start_date | DATE | NOT NULL | | |
| end_date | DATE | NOT NULL | | |
| type | TEXT | NOT NULL | | 'START_OF_CARE' / 'REASSESSMENT' |
| is_completed | BOOLEAN | NOT NULL | | Added in V0818 |
| task_instance_id | INT | YES | patient_task_instance(id) | Links to the task instance that created/completed this period |

---

## patient_documents_scheduled

Description: Tracks scheduled document delivery for visits (e.g., sending documents to patients via SMS before a visit).
Migration: V0163 (`V0163__PatientDocuments.sql`)

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| visit_instance_id | INT | NOT NULL | visit_instance(id) | |

---

# Key Enums (from TypeScript types)

| Enum | Values |
|------|--------|
| **PatientStatus** | DRAFT, REFERRAL, PENDING_FILES, ELIGIBLE, ACCEPTED, **ACTIVE**, DISCHARGED, ON_HOLD, HOSPITALIZED, VACATION, DECEASED, LOST |
| **PatientTaskInstanceStatus** | Completed, Incompleted, Broadcasting, Scheduled, ScheduledPendingConfirmation, Missing, Canceled, Assigned, Unassigned |
| **PatientTaskStatus** | Future, Unassigned, + all PatientTaskInstanceStatus values |
| **PatientDocumentTypes** | GENERAL, CMS485, OCA960, DUTY_SHEET, MEDICATION_PROFILE, SRI, ISR_NHTD, ISR_TBI, MEDFLYT_POC, MEDFLYT_PATIENT_ASSESSMENT_HTML, MEDFLYT_WELCOME_PACKAGE_HTML, MEDFLYT_PLAN_OF_CARE_HTML, MEDFLYT_PARAPROFESSIONAL_SUPERVISORY_HTML, MEDFLYT_EMERGENCY_KARDEX_HTML, PATIENT_ASSESSMENT_HTML_TEST |
| **PatientTaskTemplateType** | START_OF_CARE, REASSESSMENT, SUPERVISORY |
| **PatientTaskTemplateContext** | START_OF_CARE, REASSESSMENT |
| **CertificationPeriodType** | START_OF_CARE, REASSESSMENT |
| **AuthorizationPeriodType** | DAILY, WEEKLY, MONTHLY, ENTIRE_PERIOD |
| **CaregiverCertification** | APC, CBSA, CDPAP, CH, CMT, CNA, COMP, DCW, ESC, FS, GNA, HCSS, HHA, HM, HMK, HSK, ILST, LPN, MSW, NT, OT, PA, PBIS, PC, PCA, PT, PTA, RD, RESP, **RN**, RT, SCI, SCM, SDP, SHC, SHHA, SPC, ST, Other (Skilled) |
| **EBillingProviderType** | EDI File, EDI-eMedNY, EDI-PA Promise, HHAExchange, PDF File, CMS-1500, UB04, Tellus, CSV, Authenticare-Claims, MSA-1904 |
| **EVVAggregatorType** | Emedny, Sandata, Tellus, HHAExchange |

---

# Migration Files Reference

| Migration | Purpose |
|-----------|---------|
| `V0001__Initial_Tables.sql` | agency, user, caregiver, visit, chat, SMS |
| `V0090__PatientsTable.sql` | patient table |
| `V0092__Treatments.sql` | contract, contract_type, service_code |
| `V0163__PatientDocuments.sql` | patient_documents_types, versions, scheduled, answers |
| `V0236__Add_lots_of_Billing_related_tables.sql` | visit_instance, authorization, billing_rate, invoice, payer, office |
| `V0504__patient_tasks.sql` | **patient_task_template, patient_task, patient_task_instance** |
| `V0646__new_task.sql` | Major task refactor (broadcasting, visit_instance link, service/payroll) |
| `V0729__patient_start_of_care_changes.sql` | patient_certification_period |
| `V0847` | Added certification_period_id to patient_task |
