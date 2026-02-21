# Stripe Integration

> Credit purchases, payment methods, invoicing, webhooks. Three separate Stripe accounts.

---

## 1. What It Does

Stripe handles all payment processing for Task Health:
- **Credit purchases** — Agencies buy assessment credits ($200/credit) via invoices
- **Payment method tokenization** — Card and ACH bank account setup
- **Agency charging** — On-demand charges for SMS boosts, recruitment fees
- **Invoice management** — Draft → finalize → pay → webhook confirmation

---

## 2. Three Stripe Accounts

The system uses **three separate Stripe accounts** for different business functions:

| Account | Env Variable | Purpose |
|---------|-------------|---------|
| Default | `STRIPE_SECRET_KEY` | General customer/charge operations |
| Medflyt Agency | `MEDFLYT_STRIPE_SECRET_KEY` | Agency payment methods (cards, bank accounts) |
| Task Health | `TASK_HEALTH_STRIPE_SECRET_KEY` | Credit ordering system (RN platform) |

---

## 3. Authentication

- API key-based auth (secret keys per account)
- Webhook signature validation via `STRIPE_WEBHOOK_SECRET` and `TASK_HEALTH_STRIPE_WEBHOOK_SECRET`
- Package: `stripe` v14.14.0

---

## 4. Key API Calls

### Customer Creation
```typescript
// Three functions, one per Stripe account:
createStripeCustomer(email, name)              // Default
createAgencyStripeCustomer(name, email?)       // Medflyt
createTaskHealthStripeCustomer(name, email?)   // Task Health credits
```

### Setup Intents (Payment Method Tokenization)
```typescript
createStripeCustomerSetupIntent(customerId, description, metadata?)
createTaskHealthStripeCustomerSetupIntent(customerId, description, metadata?)
// Supports: card, us_bank_account payment methods
```

### Payment Methods
```typescript
getStripeCustomerPaymentMethod(customerId)           // List Medflyt methods
getTaskHealthStripeCustomerPaymentMethod(customerId)  // List TH methods
updateCustomerDefaultPaymentMethod(customerId, pmId)  // Set default
```

### Invoicing (Credit Orders)
```typescript
createTaskHealthStripeInvoice(customerId, amountCents, description, metadata?)
  // Creates draft invoice, auto_advance=false, 30 days until due
finalizeTaskHealthStripeInvoice(invoiceId)   // Finalizes and sends
voidTaskHealthStripeInvoice(invoiceId)       // Voids invoice
```

### Direct Charging
```typescript
chargeAgency(conn, agencyId, amountInCents, description)
  // Charges agency's default payment method. Minimum: $0.50
  // Used for: SMS boosts, recruitment fees
```

### Bank Accounts
```typescript
addBankToStripeCustomer(customerId, bankToken, metadata)
  // Adds ACH bank account via Plaid token
```

---

## 5. Webhook Endpoints

### `POST /stripe/webhook`
- **Events:** `invoice.finalized`
- **Purpose:** Agency auto-invoice email notification
- **Validation:** Stripe signature header
- **Handler:** `stripeViews.addRoutes()`

### `POST /stripe/credits-webhook`
- **Events:**
  - `invoice.paid` → Updates `task_credit_agency_balance`, marks `task_credit_stripe_invoice.paid = true`
  - `invoice.voided` → Marks invoice as cancelled
- **Purpose:** Credit order payment confirmation
- **Handler:** `credits.view.addRoutes()`

---

## 6. REST Endpoints (Credit Orders)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/rn/agencies/:id/agency_members/:id/credit_order_options` | Available credit packages |
| POST | `/rn/agencies/:id/agency_members/:id/credit_order` | Create credit order (invoice) |
| GET | `/rn/agencies/:id/agency_members/:id/credit_orders` | List orders (paginated) |
| GET | `/rn/agencies/:id/agency_members/:id/credit_balance` | Current balance |
| DELETE | `/rn/agencies/:id/agency_members/:id/credit_orders/:orderId` | Cancel order |

**Credit order flow:**
1. Agency selects credit package → `POST credit_order`
2. System creates Stripe draft invoice → finalizes → returns `hostedInvoiceUrl`
3. Agency pays via hosted invoice page
4. Webhook `invoice.paid` fires → credits added to balance

---

## 7. Configuration

| Env Variable | Purpose |
|-------------|---------|
| `STRIPE_SECRET_KEY` | Default Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Default webhook signing secret |
| `MEDFLYT_STRIPE_SECRET_KEY` | Agency payment Stripe key |
| `TASK_HEALTH_STRIPE_SECRET_KEY` | Credit system Stripe key |
| `TASK_HEALTH_STRIPE_WEBHOOK_SECRET` | Credit webhook signing secret |

---

## 8. Code Location

| File | Purpose |
|------|---------|
| `taskhealth_server2/src/Utils/StripeUtils.ts` | All Stripe utility functions |
| `taskhealth_server2/src/modules/stripe/views/stripeViews.ts` | Webhook handler (agency invoices) |
| `taskhealth_server2/src/modules/rn_platform_website/views/credits.view.ts` | Credit webhook handler |
| `taskhealth_server2/src/modules/patient_portal/controllers/PortalController.ts` | Patient payment setup |
| `taskhealth_server2/src/modules/sms_system/controllers/sms_system_controllers.ts` | SMS boost charging |
| `taskhealth_server2/src/modules/recruitment/controllers/RecruitmentSuccessWorker.ts` | Recruitment fee charging |
| `taskhealth_server2/src/config.ts` | Env variable definitions |

---

## 9. Database Tables

| Table | Purpose |
|-------|---------|
| `task_credit_stripe_invoice` | Stripe invoice records for credit purchases |
| `task_credit_order_options` | Available credit packages (1K–100K credits) |
| `task_credit_reservation` | Per-task-instance credit consumption |
| `task_credit_agency_balance` | Running credit balance per agency |
| `stripe_customer_patient_assoc` | Links Stripe customers to patients |
| `agency.stripeCustomerId` | Agency's Stripe customer ID |
| `contract_type.stripe_customer_id` | Contract-level Stripe customer |

---

## 10. Known Limitations

- Minimum charge amount: $0.50 (Stripe minimum)
- Invoice collection method is `send_invoice` (not automatic), 30 days to pay
- Three separate Stripe accounts adds complexity — must use correct utility function for each
- `auto_advance = false` on credit invoices means they must be explicitly finalized
