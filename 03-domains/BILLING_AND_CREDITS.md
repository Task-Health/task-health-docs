# Billing & Credits

> Credit-based revenue, authorizations, contract billing settings, pay rates, surpluses, invoicing, issue types, service/payroll codes.

---

## 1. Overview

Task Health uses a **credit-based revenue model**. Agencies pre-purchase credits and each completed assessment deducts credits.

- Typical cost: **$200 per assessment**
- Agency portal shows: Available Credits balance + Pending Payment Credits
- "Buy Credits" button available in portal
- $0 charged for visits in "Needs Attention" status (not yet scheduled)
- $200 charged when visit moves to "In Progress" or "Completed"

---

## 2. End-to-End Credit Flow

### Credit Purchase
1. Agency clicks "Buy Credits" in portal
2. Selects credit package from `task_credit_order_options` (1K, 5K, 10K, 20K, 50K, 75K, 100K)
3. `POST /rn/.../credit_order` → creates Stripe draft invoice → finalizes
4. Agency receives `hostedInvoiceUrl` to pay
5. On payment: Stripe webhook `invoice.paid` → updates `task_credit_agency_balance.total_credits_purchased`
6. Invoice recorded in `task_credit_stripe_invoice` with `paid = true`

### Credit Consumption
1. Task created for patient → `task_credit_reservation` inserted with `credits_used` (typically 1)
2. `task_credit_agency_balance.total_credits_reserved` incremented
3. Available balance = `total_credits_purchased - total_credits_reserved`
4. `latest = true` flag on reservation (supports adjustments — new reservation replaces old)

### Credit Balance Check
- `GET /rn/.../credit_balance` returns current balance
- If `allowed_negative_balance` is set on agency, they can go negative up to that limit
- Insufficient credits blocks task creation

### Database Tables

| Table | Purpose |
|-------|---------|
| `task_credit_agency_balance` | Running balance per agency (purchased - reserved) |
| `task_credit_stripe_invoice` | Stripe invoice records with payment status |
| `task_credit_reservation` | Per-task-instance credit consumption |
| `task_credit_order_options` | Available credit packages with pricing |

See [STRIPE.md](../05-integrations/STRIPE.md) for full Stripe integration details (3 accounts, webhooks, API calls).

---

## 3. Authorizations

Authorizations control how many hours of care are approved for a patient under a contract.

### Authorization Fields

| Field | Type |
|-------|------|
| ID | Auto-generated |
| Code | Text |
| Contract | FK to contract |
| Service Code | FK to service_code |
| Visit Create Office | FK to office |
| Period type | DAILY / WEEKLY / MONTHLY / ENTIRE_PERIOD |
| Start date, End date | Date |
| Day-of-week flags | Mo, Tu, We, Th, Fr, Sa, Su |
| Period Hours | Total approved hours (stored as minutes internally) |
| Remaining Hours | Unused hours |
| Max Hours | Maximum allowed (stored as minutes) |
| Notes | Text |
| Files | Attachments |

### Business Rule
**Visits without a matching authorization display "No Authorization" red warning tag on the calendar. This blocks billing/invoicing.**

### Database Schema (`patient_authorization`, V0236/V0456)

| Column | Type | FK | Notes |
|--------|------|-----|-------|
| id | SERIAL PK | | |
| code | TEXT | | Authorization code |
| patient_contract_id | INT NOT NULL | contract(id) | |
| service_code_id | INT NOT NULL | service_code(id) | |
| start_date / end_date | DATE NOT NULL | | |
| hours | INT NOT NULL | | **Actually minutes** |
| max_hours | INT NOT NULL | | **Actually max minutes** |
| period_type | TEXT NOT NULL | | DAILY/WEEKLY/MONTHLY/ENTIRE_PERIOD |
| monday–sunday | INT | | Daily minute allocations |
| first_day_of_week | TEXT NOT NULL | | |

**Junction table:** `visit_authorization` (links visits to authorizations with `minutes_allocated`)

---

## 4. Invoice Flow

### Invoice Creation
1. Agency admin creates invoice batch for a contract type → `invoice_batch`
2. Individual invoices created per patient → `invoice`
3. Visits linked to invoices → `invoice_visit` with `billing_units` and `billing_rate_id`
4. Billing rate looked up from `billing_rate` table (per contract_type + service_code + date range)

### Invoice Chain
```
contract_type
    |
    +-- billing_rate (rate_in_cents, per service_code, date-ranged)
    |
    +-- invoice_batch (batch of invoices for this contract type)
          |
          +-- invoice (per patient)
                |
                +-- invoice_visit (per visit, with billing_units × rate)
```

### Billing Rate Lookup
- `billing_rate` has `contract_type_id`, `service_code_id`, `start_date`, `end_date`
- Rate is in cents (`rate_in_cents`)
- Geographic overrides via `billing_rate_county` (rate varies by state/county)
- Rounding applied per `contract_type.rounding_unit` and `rounding_direction`

---

## 5. Contract Billing Settings

See [CONTRACTS_AND_AGENCIES.md](CONTRACTS_AND_AGENCIES.md) for complete billing/rounding settings per contract, including:
- Rounding Unit (default 15 minutes) / Direction (CLOSEST)
- Clock In/Out Tolerance
- Timely Filing Limits (default 1)
- Split Invoice settings
- EDI configuration
- Wage parity flag

---

## 6. Issue Types (~30)

Configurable per contract, per office. See [CONTRACTS_AND_AGENCIES.md](CONTRACTS_AND_AGENCIES.md) for complete list. Issues trigger warnings/blocks in the billing/payroll pipeline. Issues are tracked as boolean columns on `visit_instance` (e.g., `issue_has_no_clockin`, `issue_has_patient_overlap`).

---

## 7. Service Codes & Payroll Codes

### Service Codes
Define billable services. Stored in `service_code` table.

| Field | Description |
|-------|-------------|
| code | e.g., "T2024" (assessment code) |
| rate_type | HOURLY, DAILY, or VISIT |
| certification | Default 'HHA' |
| units_per_hour | Required for HOURLY (billing unit calculation) |
| billable | Whether visits using this code are billable |

**Key service codes:**
- **T2024** — Used for Initial Assessment and Reassessment (Direct Care Rates)
- Other codes are agency-specific

### Payroll Codes
Separate from service codes. Used for payroll processing. Linked via:
- `service_code_payroll_code_assoc` — Maps service codes to payroll codes
- `visit_instance.payroll_code_id` — Per-visit payroll code
- `patient_task_instance.payroll_code_id` — Per-task payroll code

### Pay Rate Tables
- `pay_rate` — Default rates per payroll code
- `caregiver_pay_rate` — Caregiver-specific rate overrides
- `patient_pay_rate` — Patient-specific rate overrides (highest priority)

---

## 8. Pay Rates

**Three levels (priority order):**
1. **Patient Pay Rates** (highest) — Per-patient overrides in `patient_pay_rate`
2. **Caregiver Pay Rates** — Per-caregiver overrides in `caregiver_pay_rate`
3. **Default Pay Rates** (lowest) — Base rates in `pay_rate`

**Rate fields:** Payroll Code Name, Rate Type, Hourly Rate, Daily Rate, Visit Rate, Date Range

**Direct Care Rates (per contract, RN platform):**
- Initial Assessment rate (code: T2024)
- Reassessment rate (code: T2024)
- Supervisory Visit rate

**Administrative Pay Rates:** Separate from direct care rates, managed independently.

---

## 9. Surpluses

Per-patient financial tracking:
- Current total balance (as of date)
- Current Monthly Surplus
- Surpluses list + Add Surplus button
- Invoices (patient surplus invoices) + Add surplus invoice button
- Surplus checks + Add Surplus Check button

**Tables:** `patient_surplus`, `patient_surplus_invoice`, `patient_surplus_check` (created in later migrations)

---

## 10. Visit Status → Credit Impact

| Portal Status | Credits Charged |
|--------------|----------------|
| Needs Attention | $0 |
| In Progress | $200 |
| Completed | $200 |

---

## 11. Key Enums

| Enum | Values |
|------|--------|
| `AuthorizationPeriodType` | DAILY, WEEKLY, MONTHLY, ENTIRE_PERIOD |
| `EBillingProviderType` | EDI File, EDI-eMedNY, EDI-PA Promise, HHAExchange, PDF File, CMS-1500, UB04, Tellus, CSV, Authenticare-Claims, MSA-1904 |
| `EVVAggregatorType` | Emedny, Sandata, Tellus, HHAExchange |
| `ServiceCodeRateType` | HOURLY, DAILY, VISIT |

---

## 12. Key Code Locations

| File | Purpose |
|------|---------|
| `taskhealth_server2/src/modules/rn_platform_website/views/credits.view.ts` | Credit order endpoints + Stripe webhook |
| `taskhealth_server2/src/Utils/StripeUtils.ts` | Stripe utility functions |
| `taskhealth_server2/src/modules/billing/` | Billing/invoicing logic |
| `taskhealth_server2/sql/migrations/V0236__Add_lots_of_Billing_related_tables.sql` | Core billing schema |
| `taskhealth_server2/sql/migrations/V1511__task_credit_stripe_invoice.sql` | Credit tables |
