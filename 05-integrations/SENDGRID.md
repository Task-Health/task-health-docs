# SendGrid Integration

> Email delivery for notifications, communication center, and system emails.

---

## 1. What It Does

SendGrid is the email delivery provider for all outgoing emails:
- System notification emails
- Communication center emails (with attachments)
- Agency auto-invoice notifications
- HR/onboarding emails

---

## 2. Authentication

- API key-based: `SENDGRID_API_KEY` env variable
- Package: `@sendgrid/mail` v7.7.0, `@sendgrid/client` v7.7.0, `@sendgrid/helpers` v7.7.0

---

## 3. Key API Calls

### Direct Mail Send
```typescript
// EmailSender.ts
sendEmailAPI(to, from, subject, bodyHtml, category?)
  // Uses /v3/mail/send endpoint directly
  // Adds email category for tracking

sendEmailWithParamsAPI(from, to, subject, bodyHtml)
  // Alternative with custom from address
```

### Comm Center Email
```typescript
// CommCenterEmailSender.ts
sendEmaiFromCommCenter(to, from, subject, bodyHtml, attachments?, inReplyTo?, references?)
  // Supports S3-hosted attachments (Base64 encoded)
  // Supports email threading via In-Reply-To and References headers
```

---

## 4. Configuration

| Env Variable | Purpose |
|-------------|---------|
| `SENDGRID_API_KEY` | SendGrid API key (nullable — email disabled if not set) |

---

## 5. Code Location

| File | Purpose |
|------|---------|
| `taskhealth_server2/src/Email/EmailSender.ts` | Main SendGrid email sender |
| `taskhealth_server2/src/Email/CommCenterEmailSender.ts` | Comm center emails with attachments |
| `taskhealth_server2/src/Email/EmailTaskQueue.ts` | Email queue definition |
| `taskhealth_server2/src/AppService/SendEmail.ts` | Template rendering + queue |

---

## 6. Implementation Details

**From address:** `noreply@task-health.com` (branded as "Task Health")

**Email queue:** Uses a task queue with 2-hour expiration for reliable delivery.

**Template rendering:** Uses Nunjucks template engine (`SendEmail.ts:sendEmails()`) to render HTML email bodies.

**Filtering:**
- Non-production environments: emails may be filtered/blocked
- Hard-coded blocked email list exists (temporary patch in EmailSender.ts)
- `sendEmailToActiveUsers()` filters out inactive users before queuing

**Attachments:** Comm center emails support S3-hosted file attachments, downloaded and Base64-encoded before sending.

---

## 7. Known Limitations

- No dedicated SendGrid template IDs in codebase — templates rendered server-side via Nunjucks
- Email category tracking is optional (not always set)
- Blocked email list is hard-coded rather than configurable
- SENDGRID_API_KEY is nullable — if not set, email sending is silently disabled
