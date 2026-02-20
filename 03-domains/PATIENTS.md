# Patients

> The patient entity — profile structure, statuses, contracts, certification periods, diagnosis codes, medications, and all related data.

---

## 1. Overview

Patients are the recipients of home care services. They belong to an **agency** (LHCSA), not to Task Health directly. Task Health provides nursing assessment services on behalf of the agency.

**Total patients in system:** ~2,418 (as of Feb 2026).

**Key relationships:**
- Patient → Contract(s) → Agency
- Patient → Certification Period(s)
- Patient → Task(s) → Task Instance(s) → Visit(s)
- Patient → Documents (via visits)

---

## 2. Patient Profile — 6 Tabs

The patient profile opens as a **slide-over panel** from the patient list. Top bar shows patient avatar (initials), name, status badges (ACTIVE, Reassessment, etc.), address, DOB, warning badges, and action buttons (Export Profile, Communications, Notes, New Visit, New Task).

### TAB 1: Calendar

**Sub-tabs:** Calendar | List view | Weekly template | Caregivers

- **Calendar view:** Monthly grid (Sun-Sat) with colored visit blocks showing time range, duration, RN name. Color coding: Blue/teal = active, Red = deleted, Red tag = "No Authorization". Controls: Show Deleted Visits, Show Authorization Details, Show Summary Column.
- **List view:** Date range picker, status/type filters, table with Date/Caregiver/Schedule/Type/Status. Pagination: 15/25/50/100.
- **Weekly template:** Day-of-week grid defining recurring care schedule. "Missing weekly template" warning when not configured.
- **Caregivers:** Table of RNs assigned to this patient (name, ID, start date, end date, visits count).

### TAB 2: Profile

**Sub-tabs:** Summary | Status review | Staffing preferences | Availability | Addresses | Emergency Contact & Preparedness | Patient Contacts | Information | Faxes | Patient-Caregiver Relationships

**Summary — Personal Details:**

| Field | Type |
|-------|------|
| ID | Internal numeric |
| SSN | Text |
| PIMS Id | Text |
| First/Middle/Last name | Text |
| Gender | M/F |
| Birth date | Date |
| Address, Address 2, Address Instructions | Text |
| County | Text (e.g., Kings County) |
| Main language, Secondary language | Text |
| Clinical severity level | Text |
| Is Test User | Yes/No |
| Live in | Selection |
| Replacement without patient's permission | Selection |

**Summary — Contact Information:** Mobile phone (with Primary badge), multiple phone numbers supported.

**Summary — Services Information:**

| Field | Type |
|-------|------|
| Start of care | Date |
| Assigned Coordinator | Agency member |
| Assigned Team | Text |
| Assigned Caregiver | Caregiver link |
| Assigned Nurse | RN link |
| Caregivers Blacklist | List |
| Office | Text (e.g., "RN Platform") |
| Branches | Text |
| Wage Parity | Selection |
| Eligibility | Date + "Check now" button |

**Staffing Preferences:** Grid of Yes/No/Unknown toggles:
Main language, Secondary language, Has Kids in house, Number of kids, Smoking patient, Work with smoking caregiver, Is patient bedridden, Is patient with cane/walker/wheelchair, Patient has kosher house, Patient has halal culture, Preferred gender, Patient is shabbat observant, Allow Multiple Caregivers, Using hoyer lift, Patient has pets, Pet details.

Plus: Allergies, Medical Notes, Special staffing requests, "What are the main things the caregiver will do" (free text).

**Availability:** 7-day x 3-shift grid (Morning 8-14, Afternoon 14-22, Evening 22-8).

**Addresses:** Multiple addresses per patient with fields: Address, Address 2, Location type, Phones, Notes, Primary flag.

**Emergency Contact & Preparedness:** Emergency Information + Priority Code, Mobility Status, Evacuation Zone, Equipment Dependency, Evacuation Location.

### TAB 3: Medical

**Sub-tabs:** Summary | Plan of Care | Duty sheet | Medical Information | Physicians | Medication profile | Documents | Uploaded documents | Blood Pressure | Value-Based payments | Advanced Directives

**Summary:** Start of Care date. Certification periods table (From, To, days count, Status, Notes). "Current period" marker on active period. Actions: Edit, "Edit primary", "Reassessment" button.

**Plan of Care:** "View plan of care" button. Shows duty selections from POC document.

**Medical Information:** Medical Notes (free text), Allergies, Visit Measurements (vital signs with date/time/value/units/method/comments), General Medical Information (paginated Q&A list).

**Physicians:** Table of patient's physicians. "+ Add Physician" button.

**Medication Profile:** Table: Medication Name, Dose, Frequency, Administration Route. "+ Add Medication".

**Documents:** Document Change Requests + Task Document Rejections + Documents table with date range filter (Document Type, Origin, Visit date, Submitted by, Status, Certification Period).

**Value-Based Payments:** Weekly grid of clinical quality questions per day (ER visits, falls, breathing changes, pain, incontinence, flu).

**Advanced Directives:** Has DNR (Yes/No), Has Proxy (Yes/No).

### TAB 4: Billing
(Not yet documented)

### TAB 5: Administrative

**Sub-tabs:** Contracts | Authorizations | Diagnosis codes | Pay rates | Surpluses

**Contracts:** List of agency contracts linked to patient. Each card: Contract name, start/end date, Is primary (Yes/No), Is on hold, Contract Files, Member ID, Medicaid/Medicare Number.

**Authorizations:** Table with ID, Code, Contract, Service Code, Period type, Start/End date, **Day-of-week flags** (Mo-Su), Period Hours, Remaining Hours, Max Hours, Notes, Files, timestamps.

**CRITICAL BUSINESS RULE:** Visits without a matching authorization show "No Authorization" red warning on calendar. This blocks billing.

**Diagnosis Codes:** Table: ID, Contract, Type (Principal/Other pertinent), DX Code (ICD-10), Short description, Start/End date, Is for billing (Yes/No). Codes are **per-contract** (agency-specific).

**Pay rates:** Default Pay Rates + Patient Pay Rates (overrides) with Payroll Code, Rate Type, Hourly/Daily/Visit Rate, Date Range.

**Surpluses:** Current balance, monthly surplus, Surpluses list, Invoices, Surplus checks.

### TAB 6: Recent activity
(Audit log of all changes to patient record)

---

## 3. Patient Statuses (12 values)

| Status | Meaning |
|--------|---------|
| DRAFT | Initial creation, not yet complete |
| REFERRAL | Referred, pending intake |
| PENDING_FILES | Waiting for required documents |
| ELIGIBLE | Passed eligibility check |
| ACCEPTED | Accepted for care |
| **ACTIVE** | Currently receiving care (most common) |
| DISCHARGED | Care ended |
| ON_HOLD | Temporarily paused |
| HOSPITALIZED | Currently in hospital |
| VACATION | Patient temporarily away |
| DECEASED | Patient deceased |
| LOST | Lost to follow-up |

---

## 4. Multiple ID Systems

| ID Type | Example | Where Seen |
|---------|---------|-----------|
| Patient ID (internal) | 16404173, 16397376 | Admin webapp, portal detail |
| Patient ID (legacy) | 23591, 23590 | Admin webapp |
| Visit/Task reference | #201534 | Agency portal |
| Document instance ID | 80752, 80950 | PDF filenames |
| Diagnosis code ID | 1281399 | Admin → Diagnosis codes |

**Two ID ranges observed:**
- High IDs: 16397376, 16397343, etc. (recent patients created via portal broadcast)
- Low IDs: 23591, 23590, etc. (older patients or different source)

---

## 5. Certification Periods

**Source table:** `patient_certification_period`
- Fields: `start_date`, `end_date`, `type` (START_OF_CARE or REASSESSMENT), `is_completed`, `task_instance_id`
- Duration: per-contract (agency setting) — 90 or 180 days

**Fallback chain for documents:**
1. Document's own cert period (if explicitly set)
2. Task instance's cert period
3. Patient's `start_of_care` date (ultimate fallback for FROM_DATE)

**Where cert period appears:**
- POC header: `text_certification_period_from` / `text_certification_period_to`
- CMS-485 Field #3: "Certification Period (From / To)"
- Patient Assessment header

**Read-only behavior:** Both cert period questions become `blockOnMobile = true` once populated, preventing RN modification. Only blocked if BOTH dates are present.

**Business rules:**
- When a period nears expiration, a Reassessment is needed
- "Overdue Reassessment" warning badge on patient profile
- "Not Completed" status on certification period row

---

## 6. Diagnosis Codes (ICD-10)

ICD-10 codes are linked **per contract** (agency-specific).

**Fields:** ID, Contract, Type ("Principal diagnosis" or "Other pertinent diagnosis"), DX Code, Short description, Start/End date, Is for billing (Yes/No).

Only one principal diagnosis per contract. Multiple "other pertinent" diagnoses allowed.

---

## 7. Database Schema

### `patient` table (V0090)

| Column | Type | FK | Notes |
|--------|------|-----|-------|
| id | SERIAL PK | | |
| first_name | TEXT NOT NULL | | |
| last_name | TEXT NOT NULL | | |
| gender | TEXT | | "M" / "F" |
| date_of_birth | TIMESTAMPTZ | | |
| ssn | TEXT | | |
| home_phone_number | TEXT | | |
| mobile_phone_number | TEXT | | |
| address | TEXT | | |
| address_components | JSONB | | |
| agency | INT NOT NULL | agency(id) | |
| status | TEXT NOT NULL | | PatientStatus enum |
| main_language | TEXT | | |
| secondary_language | TEXT | | |
| start_of_care | DATE | | (V0804) |
| medicare_number | TEXT | | |
| medicaid_number | TEXT | | |
| email | TEXT | | (V0790) |
| priority_code | INT | | |
| assigned_coordinator | INT | agency_member(id) | |
| assigned_sales_rep | INT | agency_member(id) | |
| source | INT | referral_source(id) | |
| created_at | TIMESTAMPTZ NOT NULL | | |
| created_by | INT | agency_member(id) | |

### `patient_certification_period` table (V0729)

| Column | Type | FK | Notes |
|--------|------|-----|-------|
| id | SERIAL PK | | |
| patient_id | INT NOT NULL | patient(id) | |
| start_date | DATE NOT NULL | | |
| end_date | DATE NOT NULL | | |
| type | TEXT NOT NULL | | 'START_OF_CARE' / 'REASSESSMENT' |
| is_completed | BOOLEAN NOT NULL | | (V0818) |
| task_instance_id | INT | patient_task_instance(id) | Links to the task that created it |

---

## 8. Key Code Locations

| File | Purpose |
|------|---------|
| `taskhealth_server2/sql/migrations/V0090__PatientsTable.sql` | Patient table creation |
| `taskhealth_server2/sql/migrations/V0729__patient_start_of_care_changes.sql` | Certification period table |
| `taskhealth_server2/src/modules/nursing_database_question/controllers/NursingQuestionCtrl.ts` | Patient data for nursing questions |
| `taskhealth_server2/src/messages/NursingQuestion.ts` | DatabaseLinkType enum (61 patient-linked values) |
