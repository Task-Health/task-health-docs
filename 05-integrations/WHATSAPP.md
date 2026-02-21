# WhatsApp Integration

> WhatsApp messaging via Twilio's WhatsApp Business API. Minimal integration — opt-in parameter on existing SMS infrastructure.

---

## 1. What It Does

WhatsApp is available as an **alternative delivery channel** for SMS messages. It uses Twilio's WhatsApp Business API — not a separate WhatsApp integration.

---

## 2. Authentication

Uses the same Twilio credentials as SMS:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID`
- `TWILIO_PHONE_NUMBERS`

No separate WhatsApp credentials needed — Twilio handles the WhatsApp Business API routing.

---

## 3. How It Works

The integration is a single boolean parameter on the existing SMS send function:

```typescript
// send_sms.ts
twilioSend(phoneNumber, message, sendViaWhatsapp?: boolean)
  // If sendViaWhatsapp=true: prepends "whatsapp:" to phone number
  // Otherwise: standard SMS delivery
```

When `sendViaWhatsapp = true`, the recipient number is formatted as `whatsapp:+1XXXXXXXXXX`, which tells Twilio to route via WhatsApp instead of SMS.

---

## 4. Supported Message Types

All existing SMS types can theoretically be sent via WhatsApp:
- DEFAULT, HIGH_PRIORITY
- DOWNLOAD_BOOST, TRAINING_BOOST, VISIT_BOOST, MESSAGE_BOOST
- HR_STAGE_CHANGE, APPLICATION_LINK
- TWO_WAY_COMMUNICATION
- And others

---

## 5. Code Location

| File | Purpose |
|------|---------|
| `taskhealth_server2/src/send_sms.ts` | SMS/WhatsApp sender (line 321, `twilioSend()`) |

---

## 6. Known Limitations

- **Minimal integration** — Just a boolean flag on SMS, not a full WhatsApp messaging platform
- No separate WhatsApp template management (Twilio handles template approval)
- No WhatsApp-specific features (reactions, read receipts, media messages, etc.)
- No dedicated WhatsApp configuration or environment variables
- Relies entirely on Twilio's WhatsApp Business API support
