# Contracts & Agencies

> Contract = Agency. Setup fields, billing/rounding, EDI config, EVV, care rates, issue settings, agency-specific template overrides.

---

## 1. Overview

In Task Health, a **Contract** represents a home care agency (LHCSA) that is a customer. The terms "Contract" and "Agency" are used interchangeably. Agencies pre-purchase credits and broadcast patient cases to Task Health for RN assessment.

**Where configured:** Admin webapp → Settings → Contracts

---

## 2. Contract Setup Fields

### Basic Info
- Name (e.g., "Incare Home Health Care")
- Payer ID
- Offices (e.g., "RN Platform")
- Certification period duration: **90 Days / 180 Days**
- Effective Date, Expiration Date
- Wage Parity setting
- Start of authorization week (e.g., Monday)
- Active flag

### Billing/Rounding
- Rounding Unit (e.g., 15 minutes)
- Rounding Direction (Closest)
- Clock In Tolerance (Minutes) (e.g., 60)
- Clock Out Tolerance (Minutes) (e.g., 60)
- Original Timely Filing Limit (e.g., 1)
- Adjustment Timely Filing Limit (e.g., 1)
- Contract Payment Terms (e.g., 0)
- Notification Payment Terms (e.g., 0)
- Split Invoice By Calendar Period flag
- Required amount of tasks performed for billing
- Requires a personal care task for billing
- Allow invoicing pending visits
- Require a visit to be invoiced before payroll

### EDI (Electronic Data Interchange)
- Billing Provider
- EDI Type: **Institutional / Professional**
- Admission Date Type: **D8 / DT**
- Show Authorization line
- Show NM segment
- Hide HC In Medical Procedure Identifier If Empty
- Administrative payment diagnosis code

### EVV
- EVV aggregator setting (Emedny, Sandata, Tellus, HHAExchange)

### Direct Care Rates
- Initial Assessment rate (code: T2024)
- Reassessment rate (code: T2024)
- Supervisory Visit rate

### Administrative Pay Rates
- Separate from direct care rates

---

## 3. Issue Settings (~30 Issue Types)

Configurable **per contract, per office**. These trigger warnings/blocks in the billing/payroll pipeline:

| Issue Type | Description |
|-----------|------------|
| Zero dollar pay rate | Pay rate resolves to $0 |
| Zero billing units | No billable units calculated |
| Unapproved manual clock time edit | Clock time was manually changed without approval |
| Schedule auth allocation conflict | Schedule conflicts with authorization |
| Overbilled day | More hours billed than authorized |
| No matching authorization | Visit has no matching auth |
| No caregiver | No caregiver assigned |
| No billing rate county / No billing rate | Missing billing rate |
| Missing personal care duty | Required personal care duty not selected |
| Missing patient member id | Member ID not set |
| Missing matching mutual visit | No corresponding mutual visit |
| Missing dx codes | Diagnosis codes not set |
| Missing clock times | Clock in/out not recorded |
| Missing caregiver ssn | Caregiver SSN not on file |
| Missing authorization hours | Auth hours not defined |
| Missing address | Patient address missing |
| Missed visit | Visit was missed |
| Manual hold invoicing | Invoice manually held |
| Wrong authorization | Incorrect auth matched |
| Insufficient visit duties | Not enough duties performed |
| Has patient overlap issue | Patient has overlapping visits |
| Has caregiver overlap issue | Caregiver has overlapping visits |
| Excessive clock distance | Clock location too far from patient |
| Daily minimum hours not met | Minimum hours requirement not satisfied |
| Clockout/Clockin time mismatch | Clock times don't match schedule |
| Caregiver incompliant | Caregiver has compliance issues |
| Authorization over allocation | More hours used than authorized |
| Adjustment auto approval setting | Auto-approval for adjustments |

---

## 4. Agency-Specific Template Overrides

Agencies can have custom task template overrides via `rn_platform_agency_task_template_assoc` table.

**How it works:**
1. System first checks `rn_platform_agency_task_template_assoc` for a **custom template per agency**
2. If none found: falls back to **default templates** from config:
   - `START_OF_CARE` → `config.RN_PLATFORM_DEFAULT_SOC_TASK_TEMPLATE_ID`
   - `REASSESSMENT` → `config.RN_PLATFORM_DEFAULT_REASSESSMENT_TASK_TEMPLATE_ID`
   - `SUPERVISORY` → `config.RN_PLATFORM_DEFAULT_SUPERVISORY_TASK_TEMPLATE_ID`

**Example:** Freedom Care uses custom template overrides.

---

## 5. Per-Patient Contract Link

When a contract is linked to a patient (Patient → Administrative → Contracts):

| Field | Type |
|-------|------|
| Contract name | Text |
| Contract start date | Date |
| Contract end date | Date |
| Is primary | Yes/No |
| Is on hold | Yes/No |
| Contract Files | Uploadable |
| Member ID | Text |
| Medicaid Number | Text |
| Medicare Number | Text |

---

## 6. POC Code Mapping (IVR / HHA Exchange Codes)

**What this is:** 3-digit numeric codes (e.g., "101", "606") that caregivers (HHAs/PCAs) punch into HHA Exchange's IVR phone system when clocking in/out to report which duties they performed during a visit.

**Two configuration surfaces:**
1. **Agency Portal** (go.task-health.com) — agencies map their own IVR codes to POC duties. API: `GET/POST /rn/agencies/:id/.../rn-platform/poc-codes`. Backend: `src/modules/rn_platform/rn_poc_code_mapping/`.
2. **Admin Webapp** (app.taskshealth.com) — admin configures at `/app/poc-code-mapping`.

**How codes flow to PDF:**
- Default codes defined in `poc-item-default-code-values.ts` (per duty, per section: 100s = Personal Care, 200s = Treatment, 300s = Nutrition, etc.)
- Agency-specific overrides stored in `rn_platform_poc_item_code` table (V1526)
- Codes only appear on PDF if `plan_of_care_item_code_pdf_enable.is_pdf_enabled = true` for that agency
- Adapter merges defaults with agency overrides via `mergePocItemsWithAgencyCodes()` in `poc-code-mapping.bl.ts`
- Rendered on PDF as parenthesized suffix: e.g., "Bath Shower (101)"

**DB tables:**
- `rn_platform_poc_item_code` — per-agency code overrides (columns: `agency_id`, `item_name`, `agency_code`, `default_code`, `created_at/by`, `updated_at/by`)
- `plan_of_care_item_code_pdf_enable` — per-agency flag to show/hide codes on PDF (columns: `agency_id`, `is_pdf_enabled`)

---

## 7. Database Schema

### `contract` table (V0092) — Patient-Contract Link

| Column | Type | FK | Notes |
|--------|------|-----|-------|
| id | SERIAL PK | | |
| contract_type | INT NOT NULL | contract_type(id) | Agency/payer type |
| patient | INT NOT NULL | patient(id) | |
| start_date | DATE NOT NULL | | |
| end_date | DATE | | |
| is_primary | BOOLEAN NOT NULL | | |
| is_on_hold | BOOLEAN | | |
| member_id | TEXT NOT NULL | | Insurance member ID |
| medicaid_number | TEXT | | |
| medicare_number | TEXT | | |
| discharge_date | DATE | | |

---

## 8. Known Contracts

| ID | Name |
|----|------|
| 408476 | Robert McKeown |
| 408310 | Alternate Staffing |
| 408245 | Task Health |
| 408211 | Xincon Home Health Care |
| 408179 | Unicare Home Care |
| 408145 | Tri-Med Home Care Services |
| 408079 | Incare Home Health Care |
| 408013 | Eagle Home Care |
| 407881 | Consulting Contract |
| 407834 | GR Home Care |
| — | MedFlyt Home Care Agency (test/internal) |
| — | Platinum Home Health Care (active customer) |
