# Notifications & Communications

> SMS delivery, FCM push, Socket.IO events, WebSocket presence, inbound SMS webhooks, comm center, fax.

---

## 1. Overview

Task Health uses multiple communication channels:
- **SMS** — Document delivery to patients/caregivers (Twilio + Plivo)
- **Push notifications** — FCM to RN mobile app
- **WebSocket** — Real-time events via Socket.IO
- **Email** — Via SendGrid (see `05-integrations/SENDGRID.md`)
- **Fax** — Document faxing capability
- **Chat** — In-app messaging between admin and agency
- **Comm Center** — Centralized communication hub in admin webapp

---

## 2. SMS Delivery

### Providers
Two SMS providers: **Twilio** and **Plivo**

### Document SMS Delivery
After documents are generated, SMS messages with document links are sent to:
- Patient phone number
- Caregiver phone number

**SMS Delivery Log** (visible in agency portal Documents tab):
- Columns: Timestamp, Document, Recipient, Status
- Recipient format: "Patient (+13477311156)" or "Caregiver (+19085874692)"
- Status: "Failed" or "Sent"/"Delivered"
- Multiple SMS per document (sent to both patient and caregiver)

### Inbound SMS Webhooks
**Repo:** `taskhealth-serverless` (Callbacks Service)

- Endpoints: `POST /twilio` and `POST /plivo` at `callbacks.taskshealth.com`
- Receives inbound SMS/MMS webhooks from both providers
- Validates signatures, enqueues to SQS (`tasks-health-inbound-sms-{stage}`)

---

## 3. Push Notifications (FCM)

- Task broadcasts trigger FCM push notifications to eligible RNs
- Function: `notifyRNOnTaskBroadcast()` in task creation pipeline (Step 8)
- Uses `getAllCaregvierIdsMatchingTaskBroadcastPushNotification()` to find eligible RNs

---

## 4. Socket.IO Real-Time Events

**Repo:** `taskhealth-socketio` (Elastic Beanstalk)

### Channel Types

| Pattern | Purpose |
|---------|---------|
| `private-agency-{agencyId}` | All members of an agency |
| `private-agencymember-{memberId}` | Specific agency member |
| `private-caregiver-{caregiverId}` | Specific caregiver (RN) |
| `presence-agency-{agencyId}` | Caregiver online/offline tracking |

### Server Push
Events sent via: `POST /api/send-push-to-channels` (server-to-server, auth via `X-Server-Auth-Token`)

### Auth Flow
Client connects → emits `auth` with JWT or legacy token → server validates → auto-joins private channels → emits `auth:done`

### Key Events
- `TaskBroadcastsUpdated` — new broadcast available for RNs
- Presence tracking — caregiver online/offline status

---

## 5. Comm Center

Located in admin webapp sidebar. Centralized view of all communications:
- SMS messages
- Chat messages
- Fax documents

---

## 6. Chat

- Visible in agency portal visit detail view
- `GET ./tasks/:patientTaskId/chat_messages` — fetch chat messages
- Unread Messages indicator in main visit list

---

## 7. Telephony AI Agent

**Repo:** `taskhealth-realtime-agent` (Elastic Beanstalk)

Automated phone call bot for intake triage (NOT the RN assessment AI):
- Makes/receives real-time phone calls
- Conducts automated intake conversations
- Functions during calls: hang up, transfer to intake specialist, send SMS, schedule callbacks
- Bot persona "Maria" with a New York accent

**AI Stack:**
- OpenAI Realtime API (`gpt-4o-realtime`) — voice-to-voice via WebSocket
- Deepgram Nova 3 — speech-to-text (alternative)
- OpenAI gpt-4.1-mini — LLM thinking
- ElevenLabs — text-to-speech (Jessica voice)

**Architecture:** Telephony (Plivo/Twilio) ↔ WebSocket (Hono on Elastic Beanstalk) ↔ OpenAI/Deepgram

**Note from owner:** This was an experiment and is not going to be actively used.
