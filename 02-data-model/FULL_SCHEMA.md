# Full Database Schema

Complete table schemas for the Task Health RN platform, extracted from the core PostgreSQL database. All tables use Flyway-style versioned migrations (e.g., `V0504` = migration file `V0504__patient_tasks.sql`).

**Scope:** This document covers tables directly relevant to the RN platform's core domains — patients, tasks, documents, AI, billing/credits, contracts, nursing questions, plan of care, and communications. Legacy tables, HR/onboarding, training center, compliance, intake, payroll batch processing, EVV aggregator internals, and other peripheral systems are excluded.

> **837 total tables exist** in the database. ~60 core tables are documented here. For the complete table catalog, see the migration files in `taskhealth_server2/sql/migrations/` (V0001–V1528).

---

# 1. User & Agency Tables

## agency

Description: Top-level entity. Each agency (LHCSA) is a paying customer of Task Health. "Contract" and "Agency" are often used interchangeably in the codebase.
Migration: V0001 (`V0001__Initial_Tables.sql`)

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| createdAt | TIMESTAMP | NOT NULL | | |
| name | TEXT | NOT NULL | | Agency name |
| website | TEXT | YES | | |
| address | TEXT | YES | | |
| officePhone | TEXT | YES | | |
| organizationType | TEXT | YES | | |
| settings | JSONB | YES | | Agency-level settings |
| isRequestableByCaregiver | BOOLEAN | YES | | |

---

## user

Description: Authentication record. Every agency_member and caregiver has a linked user record. Holds email/password for login.
Migration: V0001

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| createdAt | TIMESTAMP | NOT NULL | | |
| active | BOOLEAN | NOT NULL | | |
| superuser | BOOLEAN | NOT NULL | | |
| email | TEXT | YES | | UNIQUE on LOWER(email) |
| passwordHash | TEXT | YES | | |
| emailVerified | BOOLEAN | YES | | |
| resetPasswordToken | TEXT | YES | | UNIQUE |
| resetPasswordTokenExpires | TIMESTAMP | YES | | |

---

## agency_member

Description: Staff member of an agency. Can be admin or regular member. Links to user for auth.
Migration: V0001

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| createdAt | TIMESTAMP | NOT NULL | | |
| agencyAdmin | BOOLEAN | NOT NULL | | |
| firstName | TEXT | NOT NULL | | |
| lastName | TEXT | NOT NULL | | |
| user | INT | NOT NULL | user(id) | |
| agency | INT | NOT NULL | agency(id) | |
| photoUrl | TEXT | YES | | |
| jobTitle | TEXT | NOT NULL | | |
| actions | JSONB | YES | | Permissions/actions |

---

## caregiver

Description: RN/caregiver record. Independent contractors who perform patient visits. Core fields from V0001 with many additions over time.
Migration: V0001, modified in V0003, V0010, V0021, V0043, V0062, V0068

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| createdAt | TIMESTAMP | NOT NULL | | |
| firstName | TEXT | NOT NULL | | |
| lastName | TEXT | NOT NULL | | |
| middleName | TEXT | YES | | Added V0068 |
| gender | TEXT | NOT NULL | | |
| languages | JSONB | NOT NULL | | Array of spoken languages |
| address | TEXT | NOT NULL | | |
| addressGeoLocation | JSONB | NOT NULL | | GPS coords for distance matching (V0003) |
| certification | TEXT | NOT NULL | | CaregiverCertification enum |
| photoUrl | TEXT | YES | | |
| user | INT | NOT NULL | user(id) | Auth link |
| lastSeen | TIMESTAMP | YES | | |
| birthDate | TIMESTAMP | YES | | |
| homePhone | TEXT | YES | | |
| smsCount | INT | YES | | V0021 |
| receiveVisitNotifications | BOOLEAN | NOT NULL | | V0062 |
| referredBy | INT | YES | caregiver(id) | V0010, self-referral |

**Note:** `phoneNumber` column was dropped in V0043 and moved to `caregiver_phonenumber` table.

---

## caregiver_agency_assoc

Description: Links caregivers to agencies. A caregiver can work with multiple agencies. Status tracks their relationship.
Migration: V0001

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| caregiver | INT | NOT NULL | caregiver(id) | |
| agency | INT | NOT NULL | agency(id) | |
| caregiverCode | TEXT | YES | | Agency-specific caregiver ID |
| status | TEXT | NOT NULL | | Relationship status |

Constraints: UNIQUE(caregiver, agency)

---

## caregiver_phonenumber

Description: Caregiver phone numbers (moved from caregiver table in V0043 to support multiple numbers).
Migration: V0043

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| caregiver | INT | NOT NULL | caregiver(id) | |
| createdAt | TIMESTAMP | NOT NULL | | |
| phoneNumber | TEXT | NOT NULL | | UNIQUE |

---

## active_auth_token

Description: JWT/session token for authenticated users.
Migration: V0001

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| authToken | TEXT | NOT NULL | | UNIQUE |
| createdAt | TIMESTAMP | NOT NULL | | |
| user | INT | NOT NULL | user(id) | |

---

## user_fcm_registration_token

Description: Firebase Cloud Messaging tokens for push notifications to RN mobile app.
Migration: V0001

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| token | TEXT | NOT NULL | | UNIQUE |
| user | INT | NOT NULL | user(id) | |
| authToken | TEXT | NOT NULL | | |

---

# 2. Patient Tables

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
| service_type | TEXT | YES | | Set at broadcast Step 3 from agency portal. Values: "HHA", "PCA", or other free text |

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
| created_at | TIMESTAMPTZ | NOT NULL | | |
| updated_at | TIMESTAMPTZ | YES | | |
| updated_by | INT | YES | user(id) | |

---

## patient_contract_diagnosis_code

Description: ICD-10 diagnosis codes linked to a specific patient contract. Supports date-ranged diagnoses.
Migration: V0327

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| icd_code | INT | NOT NULL | icd_code(dx_id) | |
| patient_contract_id | INT | NOT NULL | contract(id) | |
| start_date | DATE | NOT NULL | | |
| end_date | DATE | NOT NULL | | |

---

## patient_staffing_preferences

Description: Patient home environment and care preferences for RN matching.
Migration: V0895

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| patient_id | INT PK | NOT NULL | patient(id) | One row per patient |
| kids | BOOLEAN | YES | | Has children |
| kids_count | INT | YES | | |
| smoking | BOOLEAN | YES | | Patient smokes |
| smoking_caregiver | BOOLEAN | YES | | Accepts smoking caregiver |
| pets | BOOLEAN | YES | | Has pets |
| pets_details | TEXT[] | YES | | Pet types |
| bedbound | BOOLEAN | YES | | |
| cane / wheelchair / walker | BOOLEAN | YES | | Mobility aids |
| kosher / halal / shabat | BOOLEAN | YES | | Dietary/religious |
| hoyer_lift | BOOLEAN | YES | | |
| gender | TEXT | YES | | Preferred caregiver gender |
| main_language | TEXT | YES | | |
| secondary_language | TEXT | YES | | |
| allow_multiple_caregivers | BOOLEAN | YES | | |

---

## patient_medication

Description: Patient medication records. Used by AI for medication-diagnosis cluster analysis.
Migration: V1456

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| patient_id | INT | NOT NULL | patient(id) | |
| medication_name | TEXT | NOT NULL | | |
| dosage | TEXT | NOT NULL | | |
| frequency | TEXT | YES | | |
| administration_notes | TEXT | YES | | |
| is_removed | BOOLEAN | NOT NULL | | Soft delete |
| created_at | TIMESTAMPTZ | NOT NULL | | |
| created_by | INT | NOT NULL | user(id) | |
| updated_at | TIMESTAMPTZ | YES | | |
| updated_by | INT | YES | user(id) | |

---

## patient_medication_profile

Description: Links patients to the medication reference table with dosage overrides and status.
Migration: V0383

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| patient_id | INT | NOT NULL | patient(id) | |
| medication_id | INT | NOT NULL | medication(id) | Reference medication |
| from | DATE | YES | | Start date |
| until | DATE | YES | | End date |
| frequency | TEXT | YES | | |
| status | TEXT | NOT NULL | | CHECK: 'ACTIVE' / 'DISCONTINUED' |
| notes | TEXT | YES | | |
| dose_override | TEXT | YES | | |

Constraints: UNIQUE(patient_id, medication_id)

---

## patient_allergy

Description: Patient allergy records.
Migration: V0583 (approximate)

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| patient_id | INT | NOT NULL | patient(id) | |
| allergy_id | INT | NOT NULL | allergy(id) | Reference allergy |

---

## icd_code

Description: ICD-10 diagnosis code reference table. Used for diagnosis code selection in documents and contracts.
Migration: V0092

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| dx_id | INT PK | NOT NULL | | Primary key |
| dx_code | TEXT | YES | | e.g., "E11.9" |
| formatted_dx_code | TEXT | YES | | Display format |
| valid_for_coding | TEXT | YES | | "1" = valid |
| short_desc | TEXT | YES | | Short description |
| long_desc | TEXT | YES | | Long description |
| active | INT | YES | | |
| revision | INT | YES | | |

---

# 3. Contract & Billing Tables

## contract

Description: Links a patient to a payer/agency contract. A patient can have multiple contracts (e.g., Medicare + Medicaid). One contract is marked as primary.
Migration: V0092 (`V0092__Treatments.sql`), modified in V0236

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
| discharge_to | INT | YES | discharge_to_ref(id) | V0236 |
| discharge_reason | INT | YES | discharge_reason_ref(id) | V0236 |

---

## contract_type

Description: Defines a payer/contract type for an agency. Holds billing configuration (rounding, filing limits, wage parity).
Migration: V0092, heavily modified in V0236

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| name | TEXT | NOT NULL | | |
| agency | INT | NOT NULL | agency(id) | |
| payer_id | INT | NOT NULL | payer(id) | V0236 |
| office_id | INT | NOT NULL | office(id) | V0236 |
| effective_date | DATE | NOT NULL | | V0236 |
| expiration_date | DATE | NOT NULL | | V0236 |
| rounding_unit | INT | NOT NULL | | Default 15 (minutes) |
| rounding_direction | TEXT | NOT NULL | | Default 'CLOSEST' |
| timely_filing_limit | INT | NOT NULL | | Default 1 |
| mutual | BOOLEAN | NOT NULL | | Default false |
| wage_parity | BOOLEAN | NOT NULL | | Default false |
| active | BOOLEAN | NOT NULL | | Default true |

---

## payer

Description: Insurance payer entity. Each agency has its own set of payers.
Migration: V0236

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| agency_id | INT | NOT NULL | agency(id) | |
| name | TEXT | NOT NULL | | |
| external_id | TEXT | YES | | UNIQUE per agency |
| phone | TEXT | YES | | |
| fax | TEXT | YES | | |
| active | BOOLEAN | NOT NULL | | |
| contact_person | TEXT | YES | | |
| email | TEXT | YES | | |
| state / city / address / zip_code | TEXT | YES | | |

Constraints: UNIQUE(agency_id, external_id)

---

## service_code

Description: Service code definitions (e.g., T2024 for assessments). Drives billing rate lookups.
Migration: V0092, modified in V0236

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| code | TEXT | NOT NULL | | e.g., "T2024" |
| agency | INT | YES | agency(id) | |
| rate_type | TEXT | NOT NULL | | Default 'HOURLY'. Also: 'DAILY', 'VISIT' |
| export_code | TEXT | NOT NULL | | Default '' |
| certification | TEXT | NOT NULL | | Default 'HHA' |
| billable | BOOLEAN | NOT NULL | | Default true |
| active | BOOLEAN | NOT NULL | | Default true |
| units_per_hour | INT | YES | | Required if rate_type='HOURLY' |
| minimum_daily_hours | INT | YES | | Required if rate_type='DAILY' |

---

## office

Description: Office/branch entity within an agency. Used for visit assignment, billing, and authorization scoping.
Migration: V0236

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| agency_id | INT | NOT NULL | agency(id) | |
| name | TEXT | NOT NULL | | |
| active | BOOLEAN | NOT NULL | | |

---

## billing_rate

Description: Rate definitions per contract type and service code. Drives invoice calculations.
Migration: V0236

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| contract_type_id | INT | NOT NULL | contract_type(id) | |
| service_code_id | INT | NOT NULL | service_code(id) | |
| rate_in_cents | INT | NOT NULL | | |
| start_date | DATE | NOT NULL | | |
| end_date | DATE | NOT NULL | | |

---

## patient_authorization

Description: Authorization record defining approved service minutes for a patient contract within a date range. **Gotcha:** `hours` and `max_hours` columns actually store minutes.
Migration: V0236, renamed in V0456

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| code | TEXT | YES | | Authorization code |
| patient_contract_id | INT | NOT NULL | contract(id) | |
| service_code_id | INT | NOT NULL | service_code(id) | |
| start_date | DATE | NOT NULL | | |
| end_date | DATE | NOT NULL | | |
| hours | INT | NOT NULL | | **Actually stores minutes** |
| max_hours | INT | NOT NULL | | **Actually stores max minutes** |
| period_type | TEXT | NOT NULL | | DAILY / WEEKLY / MONTHLY / ENTIRE_PERIOD |
| monday–sunday | INT | YES | | Daily minute allocations (7 columns) |
| first_day_of_week | TEXT | NOT NULL | | |

---

## visit_authorization

Description: Junction table linking visits to authorizations with allocated minutes.
Migration: V0236

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| visit_instance_id | INT | NOT NULL | visit_instance(id) | |
| patient_authorization_id | INT | NOT NULL | patient_authorization(id) | |
| minutes_allocated | INT | NOT NULL | | Minutes consumed |

---

## invoice_batch

Description: Batch of invoices for a contract type. Groups invoices for export/submission.
Migration: V0236

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| display_id | TEXT | NOT NULL | | |
| contract_type_id | INT | NOT NULL | contract_type(id) | |
| agency_id | INT | NOT NULL | agency(id) | |

---

## invoice

Description: Per-patient invoice within a batch.
Migration: V0236

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| display_id | TEXT | NOT NULL | | |
| batch_id | INT | NOT NULL | invoice_batch(id) | |
| patient_id | INT | NOT NULL | patient(id) | |
| agency_id | INT | NOT NULL | agency(id) | |

---

## invoice_visit

Description: Links individual visits to invoices with billing details.
Migration: V0236

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| visit_instance_id | INT | NOT NULL | visit_instance(id) | |
| invoice_id | INT | NOT NULL | invoice(id) | |
| is_deleted | BOOLEAN | NOT NULL | | |
| billing_units | INT | NOT NULL | | |
| billing_rate_id | INT | NOT NULL | billing_rate(id) | |
| visit_date | DATE | NOT NULL | | |

---

# 4. Task Credit Tables

## task_credit_agency_balance

Description: Current credit balance for each agency on the RN platform. Credits are pre-purchased and consumed per assessment.
Migration: V1511

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| rn_platform_agency_id | INT | NOT NULL | agency(id) | UNIQUE, one row per agency |
| total_credits_purchased | INT | NOT NULL | | Default 0 |
| total_credits_reserved | INT | NOT NULL | | Default 0 |
| allowed_negative_balance | INT | YES | | Override for allowing debt |
| updated_at | TIMESTAMPTZ | NOT NULL | | |

---

## task_credit_stripe_invoice

Description: Stripe invoice records for credit purchases.
Migration: V1511

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| paid | BOOLEAN | NOT NULL | | |
| paid_at | TIMESTAMPTZ | YES | | |
| finalized | BOOLEAN | NOT NULL | | |
| amount_billed | INT | NOT NULL | | |
| amount_credit | INT | NOT NULL | | Credits purchased |
| stripe_customer_id | TEXT | NOT NULL | | |
| stripe_invoice_id | TEXT | NOT NULL | | UNIQUE |
| rn_platform_agency_id | INT | NOT NULL | agency(id) | |
| hosted_invoice_url | TEXT | YES | | |
| invoice_pdf_url | TEXT | YES | | |
| removed_at | TIMESTAMPTZ | YES | | |

---

## task_credit_reservation

Description: Records credit consumption per task instance. `latest = true` marks the current reservation (supports adjustments).
Migration: V1511, V1513

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| task_instance_id | INT | NOT NULL | patient_task_instance(id) | |
| credits_used | INT | NOT NULL | | |
| latest | BOOLEAN | NOT NULL | | UNIQUE per task_instance WHERE latest |
| note | TEXT | YES | | |
| paid_via_invoice | BOOLEAN | NOT NULL | | |

---

## task_credit_order_options

Description: Available credit packages for purchase. Can be agency-specific or global (null agency).
Migration: V1511

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| rn_platform_agency_id | INT | YES | agency(id) | NULL = global option |
| amount_credit | INT | NOT NULL | | Credits in package |
| price_cents | INT | NOT NULL | | Price in cents |

---

# 5. Task Lifecycle Tables

## patient_task_template

Description: Reusable task template per agency. Specifies certifications, duration, and visit type (SOC/Reassessment/Supervisory).
Migration: V0504, V0729

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| title | TEXT | NOT NULL | | |
| agency_id | INT | NOT NULL | agency(id) | |
| allowed_certifications | JSONB | NOT NULL | | Array of CaregiverCertification |
| duration_minutes | INT | YES | | |
| context | TEXT | YES | | CHECK: NULL, 'START_OF_CARE', 'REASSESSMENT' (V0729) |
| type | TEXT | YES | | 'START_OF_CARE' / 'REASSESSMENT' / 'SUPERVISORY' |
| plan_of_care_type_id | INT | YES | plan_of_care_type(id) | |
| created_at | TIMESTAMPTZ | NOT NULL | | |
| removed_at | TIMESTAMPTZ | YES | | Soft delete |

---

## patient_task_template_document

Description: Junction: which document types a template requires.
Migration: V0504

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| task_template_id | INT | NOT NULL | patient_task_template(id) | |
| document_id | INT | NOT NULL | patient_documents_types(id) | |

Constraints: UNIQUE(task_template_id, document_id)

---

## patient_task

Description: Concrete task for a specific patient under a contract. Created from a template. Can spawn multiple instances (recurring tasks).
Migration: V0504, V0646, V0847

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| agency_id | INT | NOT NULL | agency(id) | |
| task_template_id | INT | NOT NULL | patient_task_template(id) | |
| patient_id | INT | NOT NULL | patient(id) | |
| patient_contract_id | INT | NOT NULL | contract(id) | V0646 |
| title | TEXT | NOT NULL | | |
| start_date | DATE | NOT NULL | | |
| due_date | DATE | NOT NULL | | |
| priority | INT | NOT NULL | | 1-5 |
| repeat_months | INT | YES | | Recurrence cycle |
| is_draft | BOOLEAN | NOT NULL | | |
| caregiver_id | INT | YES | caregiver(id) | Pre-assigned RN |
| certification_period_id | INT | YES | patient_certification_period(id) | V0847 |
| service_code_id | INT | NOT NULL | service_code(id) | V0646 |
| payroll_code_id | INT | YES | payroll_code(id) | V0646 |
| day_time_params | JSONB | YES | | Schedule parameters |
| is_future_assigned | BOOLEAN | NOT NULL | | |
| price | INT | YES | | |
| canceled_at | TIMESTAMPTZ | YES | | |
| removed_at | TIMESTAMPTZ | YES | | |

---

## patient_task_document

Description: Junction: which documents a specific task requires.
Migration: V0504

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| task_id | INT | NOT NULL | patient_task(id) | |
| document_id | INT | NOT NULL | patient_documents_types(id) | |

Constraints: UNIQUE(task_id, document_id)

---

## patient_task_instance

Description: Individual task occurrence — the entity that gets broadcast, assigned to an RN, scheduled, and completed. Links to a calendar visit via `visit_instance_id`.
Migration: V0504, V0646, V0867

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| task_id | INT | NOT NULL | patient_task(id) | Parent task |
| patient_id | INT | NOT NULL | patient(id) | V0646 |
| contract_id | INT | NOT NULL | contract(id) | |
| caregiver_id | INT | YES | caregiver(id) | Assigned RN |
| start_date | DATE | NOT NULL | | |
| due_date | DATE | NOT NULL | | |
| duration_minutes | INT | YES | | |
| completion_date | DATE | YES | | |
| schedule_date_time | TIMESTAMPTZ | YES | | |
| visit_instance_id | INT | YES | visit_instance(id) | Calendar visit link (V0646) |
| is_broadcasting | BOOLEAN | NOT NULL | | V0646 |
| broadcast_distance | INT | YES | | Radius in miles |
| patient_confirmed | BOOLEAN | NOT NULL | | |
| patient_confirmed_at | TIMESTAMPTZ | YES | | |
| confirmation_type | TEXT | YES | | |
| is_active | BOOLEAN | NOT NULL | | |
| price | INT | YES | | |
| service_code_id | INT | NOT NULL | service_code(id) | V0646 |
| payroll_code_id | INT | YES | payroll_code(id) | V0646 |
| agency_note | TEXT | YES | | |
| canceled_at | TIMESTAMPTZ | YES | | |
| removed_at | TIMESTAMPTZ | YES | | |

**Constraint:** `(caregiver_id IS NOT NULL AND is_broadcasting IS FALSE) OR (caregiver_id IS NULL)` — can't be assigned and broadcasting simultaneously.

**Status enum — PatientTaskInstanceStatus:**
`"Completed" | "Incompleted" | "Broadcasting" | "Scheduled" | "ScheduledPendingConfirmation" | "Missing" | "Canceled" | "Assigned" | "Unassigned"`

---

## patient_task_instance_document

Description: Junction: which documents a task instance requires.
Migration: V0504

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| task_instance_id | INT | NOT NULL | patient_task_instance(id) | |
| document_id | INT | NOT NULL | patient_documents_types(id) | |

---

## patient_task_broadcast_caregiver_engagement

Description: Tracks which caregivers viewed a broadcast. Used for metrics and race-condition-safe assignment.
Migration: V0646

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| patient_task_instance_id | INT | NOT NULL | patient_task_instance(id) | |
| caregiver_id | INT | NOT NULL | caregiver(id) | |
| created_at | TIMESTAMPTZ | NOT NULL | | |
| viewed_at | TIMESTAMPTZ | NOT NULL | | |

Constraints: UNIQUE(patient_task_instance_id, caregiver_id)

---

# 6. Visit Tables

## visit_instance

Description: The calendar visit — actual scheduled time slot with clock-in/out, GPS, billing flags, and issue tracking. Created from task instances (is_task=true) or directly.
Migration: V0236, heavily modified

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| patient_id | INT | NOT NULL | patient(id) | |
| caregiver_id | INT | YES | caregiver(id) | |
| patient_contract_id | INT | YES | contract(id) | |
| start_time / end_time | TIMESTAMP | NOT NULL | | Local scheduled time |
| start_time_utc / end_time_utc | TIMESTAMPTZ | NOT NULL | | UTC scheduled time |
| clockin_time / clockout_time | TIMESTAMP | YES | | Actual clock (local) |
| clockin_time_utc / clockout_time_utc | TIMESTAMPTZ | YES | | Actual clock (UTC) |
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
| is_task | BOOLEAN | NOT NULL | | Task-created visit (V0646) |
| duty_sheet_fill_percentage | INT | YES | | |
| is_summary_submitted | BOOLEAN | YES | | |
| travel_time_seconds | INT | NOT NULL | | |
| was_imported | BOOLEAN | NOT NULL | | |
| manual_clock_time_edit_approved | BOOLEAN | NOT NULL | | |
| clock_distance_approved | BOOLEAN | NOT NULL | | |
| removed_at | TIMESTAMPTZ | YES | | Soft delete |
| show_on_calendar_when_deleted | BOOLEAN | NOT NULL | | |
| 20+ issue tracking columns | BOOLEAN | | | issue_has_no_clockin, issue_has_patient_overlap, etc. |

Constraints: `end_time > start_time`, timezone must be valid IANA

---

## clockin_clockout_record

Description: Raw clock-in/clock-out events from IVR, mobile app, or manual entry. Linked to visit instances after the fact.
Migration: V0236

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| caregiver_id | INT | NOT NULL | caregiver(id) | |
| patient_id | INT | YES | patient(id) | |
| visit_instance_id | INT | YES | visit_instance(id) | |
| call_type | TEXT | NOT NULL | | CLOCKIN / CLOCKOUT |
| method_type | TEXT | NOT NULL | | IVR, APP, MANUAL, etc. |
| call_duration | INT | NOT NULL | | |
| source_phone | TEXT | YES | | |
| geo_location | JSONB | YES | | |
| duties | JSONB | YES | | |
| linked_at | TIMESTAMPTZ | YES | | When linked to visit |
| rejected_at | TIMESTAMPTZ | YES | | |

---

# 7. Document Tables

## patient_documents_types

Description: Master document type definition (e.g., Patient Assessment, CMS-485, Plan of Care). Controls header flags and AI review requirement.
Migration: V0163, V1396

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| title | TEXT | YES | | Document name |
| type | TEXT | YES | | PatientDocumentTypes enum |
| agency | INT | YES | agency(id) | |
| is_template | BOOLEAN | NOT NULL | | |
| require_ai_review | BOOLEAN | NOT NULL | | V1396 |
| show_patient_name | BOOLEAN | NOT NULL | | Header display |
| show_patient_gender | BOOLEAN | NOT NULL | | |
| show_patient_address | BOOLEAN | NOT NULL | | |
| show_patient_phone | BOOLEAN | NOT NULL | | |
| show_patient_dob | BOOLEAN | NOT NULL | | |
| show_caregiver_name | BOOLEAN | NOT NULL | | |
| show_patient_contract | BOOLEAN | NOT NULL | | |
| show_general_details_on_every_page | BOOLEAN | NOT NULL | | |

---

## patient_documents_types_versions

Description: Versioned form content. Each version holds the full form-builder JSON. The system selects the highest `isPublished = TRUE` version for new tasks. Version locks at first RN interaction (lazy locking). See [DOCUMENT_VERSIONING.md](../03-domains/DOCUMENT_VERSIONING.md).
Migration: V0163, V1435

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Higher ID = newer version |
| patientDocumentTypeId | INT | NOT NULL | patient_documents_types(id) | |
| content | JSONB | YES | | Form builder JSON (PatientDocumentContentItem tree) |
| isPublished | BOOLEAN | NOT NULL (default FALSE) | | FALSE = draft, TRUE = available for new tasks |
| html_template_version_id | INT | YES | | Links to TypeScript adapter code version (v1-v10) |
| createdAt | TIMESTAMPTZ | NOT NULL | | |
| updatedAt | TIMESTAMPTZ | YES | | |
| removedAt | TIMESTAMPTZ | YES | | Soft delete |

Version selection: `SELECT id FROM ... WHERE isPublished = TRUE ORDER BY id DESC LIMIT 1`

---

## patient_documents_scheduled

Description: Per-task/visit document instance. **This is where the version gets locked.** Created lazily at first RN interaction via `findOrCreateScheduledDocId()`. Once created, `version_id` is frozen — template updates do not affect this row. Renamed from `patient_documents_scheduled_visit` in V0752.
Migration: V0163, V0283, V0504, V0752

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| caregiver_id | INT | YES | caregiver(id) | Nullable — allows pre-assignment scheduling |
| patient_document_type_id | INT | YES | patient_documents_types(id) | |
| version_id | INT | YES | patient_documents_types_versions(id) | **THE LOCKED VERSION** — nullable for legacy rows (falls back to latest) |
| task_instance_id | INT | YES | patient_task_instance(id) | |
| visit_instance_id | INT | YES | visit_instance(id) | |
| patient_id | INT | YES | patient(id) | Denormalized for fast queries |
| agency_member_id | INT | YES | agency_member(id) | For agency submissions |
| created_at | TIMESTAMPTZ | NOT NULL | | |
| submitted_at | TIMESTAMPTZ | YES | | When RN submitted |
| approved_at | TIMESTAMPTZ | YES | | When admin approved |
| updated_at | TIMESTAMPTZ | YES | | |
| removed_at | TIMESTAMPTZ | YES | | Soft delete |
| file_url | TEXT | YES | | Generated PDF URL |
| document_scanned | BOOLEAN | | | Free-form scan flag |
| document_title | TEXT | YES | | For free scans |

Constraints: UNIQUE(caregiverId, patientDocumentTypeId, versionId, task_instance_id)

---

## patient_documents_answers

Description: Individual question answers for a document. Each row = one answer to one question on one scheduled document.
Migration: V0163

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| caregiverId | INT | NOT NULL | caregiver(id) | |
| scheduledVisitDocumentId | INT | NOT NULL | patient_documents_scheduled_visit(id) | |
| questionId | INT | NOT NULL | | References content item ID |
| answer | TEXT | NOT NULL | | |
| chartRow | INT | YES | | For chart/table questions |

Constraints: UNIQUE(chartRow, questionId, scheduledVisitDocumentId)

---

## patient_document_ai_review

Description: AI review results for a submitted document. Stores the review prompt output and status.
Migration: V1396

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| scheduled_document_id | INT | NOT NULL | patient_documents_scheduled_visit(id) | |
| s3_url | TEXT | NOT NULL | | Review data in S3 |
| result | TEXT | YES | | Review result |
| error | TEXT | YES | | Error if failed |
| started_at | TIMESTAMPTZ | YES | | |
| completed_at | TIMESTAMPTZ | YES | | |
| is_latest | BOOLEAN | NOT NULL | | UNIQUE per doc WHERE is_latest |

---

## patient_document_generation_queue

Description: Queue for async PDF document generation. Tracks status and retries.
Migration: V1509

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| patient_task_instance_id | INT | NOT NULL | patient_task_instance(id) | |
| caregiver_id | INT | NOT NULL | caregiver(id) | |
| status | TEXT | NOT NULL | | CHECK: 'pending' / 'processing' / 'completed' / 'failed' |
| retry_count | INT | NOT NULL | | |
| max_retries | INT | NOT NULL | | |
| started_at | TIMESTAMPTZ | YES | | |
| ended_at | TIMESTAMPTZ | YES | | |
| error | TEXT | YES | | |

---

## patient_document_link

Description: Shareable links for generated document PDFs. Used for SMS delivery to patients/caregivers.
Migration: UNVERIFIED (referenced in codebase)

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| scheduled_document_id | INT | NOT NULL | patient_documents_scheduled_visit(id) | |
| url | TEXT | NOT NULL | | S3/CDN URL |
| token | TEXT | NOT NULL | | Access token |

---

# 8. Nursing Database Questions

## nursing_question

Description: Reusable nursing database questions. Each question has a `database_link` that maps to a `DatabaseLinkType` (61 values) for cross-document data propagation.
Migration: V0458

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| agency_id | INT | YES | agency(id) | NULL = global |
| question_text | TEXT | NOT NULL | | |
| answer_type | TEXT | NOT NULL | | CHECK: radio, check, dropDown, yesNo, textShort, textLong, number, time, date, bloodPressure |
| possible_answers | JSONB | YES | | Options for radio/check/dropdown |
| database_link | TEXT | YES | | DatabaseLinkType enum value |
| is_vital | BOOLEAN | NOT NULL | | Vital sign question |
| icon | TEXT | YES | | |
| created_at | TIMESTAMPTZ | NOT NULL | | |
| removed_at | TIMESTAMPTZ | YES | | Soft delete |

---

## nursing_question_answer

Description: Answers to nursing database questions. Per-patient or per-caregiver, linked to a specific document visit.
Migration: V0458

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| question_id | INT | NOT NULL | nursing_question(id) | |
| answer_text | TEXT | NOT NULL | | |
| schedule_visit_document_id | INT | YES | patient_documents_scheduled_visit(id) | |
| reported_by | INT | NOT NULL | user(id) | |
| patient_id | INT | YES | patient(id) | |
| caregiver_id | INT | YES | caregiver(id) | |
| vital_measured_at | TIMESTAMP | YES | | For vital signs |
| vital_method | TEXT | YES | | |
| vital_comments | TEXT | YES | | |
| vital_unit | TEXT | YES | | |

Constraints: UNIQUE(question_id, schedule_visit_document_id), CHECK: exactly one of patient_id or caregiver_id must be set

---

## nursing_question_agency_setting

Description: Per-agency visibility settings for nursing questions.
Migration: V0458

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| question_id | INT | NOT NULL | nursing_question(id) | |
| agency_id | INT | NOT NULL | agency(id) | |
| show_on_patient | BOOLEAN | NOT NULL | | Show in patient profile |
| show_on_agency | BOOLEAN | NOT NULL | | Show in agency view |

Constraints: UNIQUE(question_id, agency_id)

---

# 9. Plan of Care Tables

## plan_of_care

Description: Plan of Care document instance. Links to a treatment (legacy) or task instance (new). Contains signatures.
Migration: V0095, V0504

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| created_by | INT | NOT NULL | caregiver(id) | RN who created |
| treatment_id | INT | YES | treatment(id) | Legacy link |
| patient_task_instance_id | INT | YES | patient_task_instance(id) | V0504 |
| submitted_at | TIMESTAMPTZ | YES | | |
| caregiver_signature | TEXT | YES | | Base64 |
| caregiver_signed_at | TIMESTAMPTZ | YES | | |
| patient_signature | TEXT | YES | | Base64 |
| patient_signed_at | TIMESTAMPTZ | YES | | |

Constraints: Either treatment_id or patient_task_instance_id must be set (not both). Signature and signed_at must be both null or both non-null.

---

## plan_of_care_item

Description: LEGACY POC system duty items. NOT a global reference table — items are scoped per agency/office via `planOfCareTypeId` (FK to `plan_of_care_type`). Each row is a selectable duty within a plan of care type.
Migration: V0095

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | Primary key |
| type | TEXT | NOT NULL | | Item type |
| label | TEXT | NOT NULL | | Display text |
| section_name | TEXT | NOT NULL | | Category (Personal Care, Nutritional, etc.) |
| code | TEXT | NOT NULL | | IVR/HHA code |
| order_in_section | INT | NOT NULL | | Sort order within section |
| planOfCareTypeId | INT | NOT NULL | plan_of_care_type(id) | Scopes item to a specific POC type (per agency/office) |
| documentItemType | TEXT | YES | | Optional document item type classifier |
| is_personal_care | BOOLEAN | NOT NULL | | Whether this is a personal care duty |
| is_active | BOOLEAN | NOT NULL | | Soft-active flag |

---

## plan_of_care_item_answer

Description: Selected duties for a specific POC with scheduling (when_to_perform).
Migration: V0095

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| plan_of_care | INT | NOT NULL | plan_of_care(id) | |
| plan_of_care_item | INT | NOT NULL | plan_of_care_item(id) | |
| notes | TEXT | YES | | |
| when_to_perform | JSONB | YES | | Day/time schedule |

Constraints: UNIQUE(plan_of_care, plan_of_care_item)

---

# 10. RN Platform-Specific Tables

## rn_platform_agency_task_template_assoc

Description: Maps agencies to their task templates for SOC and Reassessment on the RN platform. Each agency has exactly one template per task type.
Migration: V1442

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| agency_id | INT | NOT NULL | agency(id) | |
| task_template_id | INT | NOT NULL | patient_task_template(id) | |
| task_type | TEXT | NOT NULL | | CHECK: 'START_OF_CARE' / 'REASSESSMENT' |

Constraints: PRIMARY KEY(agency_id, task_type) — one template per type per agency

---

## rn_platform_poc_item_code

Description: Per-agency code mapping for POC duty items. Agencies can customize the IVR/HHA codes shown on PDFs.
Migration: V1526

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| agency_id | INT | NOT NULL | agency(id) | |
| plan_of_care_item_id | TEXT | NOT NULL | | Duty name string (e.g., "Bath Shower") |
| code | TEXT | NOT NULL | | IVR code |
| created_at | TIMESTAMPTZ | NOT NULL | | |
| created_by | INT | NOT NULL | | |
| updated_at | TIMESTAMPTZ | YES | | |
| updated_by | INT | YES | | |

Constraints: PRIMARY KEY(agency_id, plan_of_care_item_id)

---

## plan_of_care_item_code_pdf_enable

Description: Feature flag per agency for showing custom POC codes on PDFs.
Migration: V1526

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| agency_id | INT PK | NOT NULL | agency(id) | UNIQUE |
| is_enabled | BOOLEAN | NOT NULL | | |
| created_at | TIMESTAMPTZ | NOT NULL | | |
| created_by | INT | NOT NULL | | |
| updated_at | TIMESTAMPTZ | YES | | |
| updated_by | INT | YES | | |

---

## rn_platform_county_miles_broadcast_radius

Description: County-specific broadcast radius overrides. Default is 40 miles; this table stores exceptions.
Migration: V1486

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| county | VARCHAR(255) | NOT NULL | | |
| state | VARCHAR(255) | NOT NULL | | |
| miles_radius | INT | NOT NULL | | |

Constraints: UNIQUE(county, state)

---

## rn_platform_task_document_rejection

Description: Document rejection records from QA review with per-question rejections.
Migration: UNVERIFIED

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| task_instance_id | INT | NOT NULL | patient_task_instance(id) | |
| document_type_id | INT | NOT NULL | patient_documents_types(id) | |
| question_id | INT | NOT NULL | | |
| rejection_reason | TEXT | NOT NULL | | |

---

# 11. Communication Tables

## comm_center_ticket

Description: Communication ticket in the comm center. Tracks conversations between agency staff and caregivers.
Migration: V0936

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| agency_id | INT | NOT NULL | agency(id) | |
| caregiver_id | INT | YES | caregiver(id) | |
| patient_id | INT | YES | patient(id) | |
| team_id | INT | NOT NULL | comm_center_team(id) | |
| assigned_to | INT | YES | comm_center_team_member(id) | |
| initiated_by | TEXT | NOT NULL | | CHECK: 'Caregiver' / 'Agency Member' |
| source | TEXT | NOT NULL | | |
| enable_agency_response | BOOLEAN | NOT NULL | | |
| label_id | INT | NOT NULL | comm_center_label(id) | |
| created_at | TIMESTAMPTZ | NOT NULL | | |

---

## comm_center_message

Description: Individual message within a comm center ticket.
Migration: V0936

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| ticket_id | INT | NOT NULL | comm_center_ticket(id) | |
| payload | JSONB | NOT NULL | | Message content |
| system_message | BOOLEAN | NOT NULL | | Auto-generated message |
| caregiver_id | INT | YES | caregiver(id) | Author (if caregiver) |
| agency_member_id | INT | YES | agency_member(id) | Author (if staff) |
| label_id | INT | YES | comm_center_label(id) | |
| is_read | BOOLEAN | NOT NULL | | |

Constraint: Non-system messages must have exactly one author (caregiver XOR agency_member). System messages have neither.

---

## caregiver_notification

Description: Push notification records sent to caregivers (task broadcasts, reminders, etc.).
Migration: V0001

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| caregiver | INT | NOT NULL | caregiver(id) | |
| payload | JSON | NOT NULL | | Notification data |
| notificationText | TEXT | NOT NULL | | Display text |
| viewedAt | TIMESTAMP | YES | | |
| clickedAt | TIMESTAMP | YES | | |

---

# 12. Physician & Treatment Tables

## physician

Description: Physician records per agency. Referenced in CMS-485 and medical orders.
Migration: V0092

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| agency | INT | NOT NULL | agency(id) | |
| first_name | TEXT | NOT NULL | | |
| last_name | TEXT | NOT NULL | | |
| npi | TEXT | YES | | National Provider Identifier |
| license_number | TEXT | YES | | |
| phone / mobile_phone / fax | TEXT | YES | | |
| clinic_name | TEXT | YES | | |
| address | TEXT | YES | | |

---

## treatment

Description: Legacy clinical treatment record linked to a contract. Holds authorization info and RN assessment tracking. Being superseded by the task-based system.
Migration: V0092

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | INT PK | NOT NULL | | |
| contract | INT | NOT NULL | contract(id) | |
| start_of_period / end_of_period | TIMESTAMPTZ | YES | | |
| accepted_services | JSONB | YES | | Service certification list |
| auth_number | TEXT | YES | | |
| eligibility_sunday–saturday | INT | YES | | Minutes per day |
| rn_assessment_done | TIMESTAMPTZ | YES | | |
| next_rn_assessment_required | TIMESTAMPTZ | YES | | |

---

## treatment_diagnosis

Description: Links treatments to ICD diagnosis codes.
Migration: V0092

| Column | Type | Nullable | FK | Description |
|--------|------|----------|-----|-------------|
| id | SERIAL PK | NOT NULL | | |
| treatment | INT | NOT NULL | treatment(id) | |
| diagnosis_icd | INT | NOT NULL | icd_code(dx_id) | |
| is_primary | BOOLEAN | YES | | |

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
| **DocumentGenerationQueueStatus** | pending, processing, completed, failed |

---

# Migration Files Reference

| Migration | Purpose |
|-----------|---------|
| `V0001__Initial_Tables.sql` | agency, user, caregiver, visit, chat, SMS, notifications |
| `V0043` | caregiver_phonenumber (phone moved from caregiver table) |
| `V0068__HR_Infrastructure.sql` | HR document types, application sections, questions |
| `V0090__PatientsTable.sql` | patient table |
| `V0092__Treatments.sql` | contract, contract_type, service_code, physician, treatment, icd_code |
| `V0095__PlanOfCare.sql` | plan_of_care, plan_of_care_item, plan_of_care_item_answer |
| `V0163__PatientDocuments.sql` | patient_documents_types, versions, scheduled, answers |
| `V0236__Add_lots_of_Billing_related_tables.sql` | visit_instance, authorization, billing_rate, invoice, payer, office |
| `V0327` | patient_contract_diagnosis_code |
| `V0383` | patient_medication_profile |
| `V0456` | authorization renamed to patient_authorization |
| `V0458__nursing_database_questions.sql` | nursing_question, nursing_question_answer, agency settings |
| `V0504__patient_tasks.sql` | patient_task_template, patient_task, patient_task_instance |
| `V0583` | patient_address, patient_phonenumber |
| `V0646__new_task.sql` | Task refactor (broadcasting, visit_instance link, service/payroll) |
| `V0729__patient_start_of_care_changes.sql` | patient_certification_period, template context |
| `V0847` | certification_period_id added to patient_task |
| `V0895` | patient_staffing_preferences |
| `V0936` | comm_center_ticket, comm_center_message (recreated) |
| `V1396` | patient_document_ai_review, require_ai_review flag |
| `V1442` | rn_platform_agency_task_template_assoc |
| `V1456` | patient_medication |
| `V1486` | rn_platform_county_miles_broadcast_radius |
| `V1509` | patient_document_generation_queue |
| `V1511` | task_credit tables (balance, stripe invoice, reservation, order options) |
| `V1526` | rn_platform_poc_item_code, plan_of_care_item_code_pdf_enable |

---

# Complete Table Catalog (837 tables)

For reference, the full database contains 837 tables. Major table groups NOT detailed above:

| Group | ~Count | Description |
|-------|--------|-------------|
| `training_center_*` | ~50 | Training bundles, videos, tests, caregiver enrollment |
| `caregiver_compliance_*` | ~15 | Compliance tracking, reviews, automation |
| `onboarding_*` | ~20 | RN onboarding, HR engagement, document validation |
| `workflow_*` / `workflow2_*` | ~25 | Internal workflow automation engine |
| `telephony_*` | ~15 | Call center telephony (Plivo/Twilio calls) |
| `sandata_*` | ~12 | Sandata EVV integration submissions |
| `hha_integration_*` | ~10 | HHA Exchange integration |
| `payroll_*` | ~10 | Payroll batch processing |
| `intake_*` | ~25 | Patient intake tracking |
| `robocall_*` | ~5 | Automated call scheduling |
| `caregiver_pto_*` | ~5 | PTO management |
| `insta_pay_*` | ~5 | Instant pay/deductions |
| `logging.history*` | ~6 | Audit logging schema |
| Legacy (`visit`, `scheduled_visit`) | ~5 | Pre-visit_instance system |
