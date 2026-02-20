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

## 2. Authorizations

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
| hours | INT NOT NULL | | Actually minutes |
| max_hours | INT NOT NULL | | Actually max minutes |
| period_type | TEXT NOT NULL | | DAILY/WEEKLY/MONTHLY/ENTIRE_PERIOD |
| monday-sunday | INT | | Daily minute allocations |
| first_day_of_week | TEXT NOT NULL | | |

**Junction table:** `visit_authorization` (links visits to authorizations with `minutes_allocated`)

---

## 3. Contract Billing Settings

See `CONTRACTS_AND_AGENCIES.md` for complete billing/rounding settings per contract, including:
- Rounding Unit/Direction
- Clock In/Out Tolerance
- Timely Filing Limits
- Split Invoice settings
- EDI configuration

---

## 4. Issue Types (~30)

Configurable per contract, per office. See `CONTRACTS_AND_AGENCIES.md` for complete list. Issues trigger warnings/blocks in the billing/payroll pipeline.

---

## 5. Pay Rates

**Two levels:**
1. **Default Pay Rates** — Payroll Code Name, Rate Type, Hourly Rate, Daily Rate, Visit Rate, Date Range
2. **Patient Pay Rates** (overrides) — Same fields, applied per-patient

**Direct Care Rates (per contract):**
- Initial Assessment rate (code: T2024)
- Reassessment rate (code: T2024)
- Supervisory Visit rate

**Administrative Pay Rates:** Separate from direct care rates.

---

## 6. Surpluses

Per-patient financial tracking:
- Current total balance (as of date)
- Current Monthly Surplus
- Surpluses list + Add Surplus button
- Invoices (patient surplus invoices) + Add surplus invoice button
- Surplus checks + Add Surplus Check button

---

## 7. Visit Status → Credit Impact

| Portal Status | Credits Charged |
|--------------|----------------|
| Needs Attention | $0 |
| In Progress | $200 |
| Completed | $200 |

---

## 8. Key Enums

| Enum | Values |
|------|--------|
| `AuthorizationPeriodType` | DAILY, WEEKLY, MONTHLY, ENTIRE_PERIOD |
| `EBillingProviderType` | EDI File, EDI-eMedNY, EDI-PA Promise, HHAExchange, PDF File, CMS-1500, UB04, Tellus, CSV, Authenticare-Claims, MSA-1904 |
| `EVVAggregatorType` | Emedny, Sandata, Tellus, HHAExchange |

---

## 9. Areas Still Open

- [ ] End-to-end billing flow: Credits → Invoice → Payroll → Payment
- [ ] Service codes & Payroll codes — full list and billing mapping
- [ ] Value-Based Payments — weekly Q&A data, how it's used for billing
- [ ] Stripe integration details (see `05-integrations/STRIPE.md` when created)
