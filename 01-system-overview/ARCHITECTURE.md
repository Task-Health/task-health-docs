# Task Health System Architecture

## What Is Task Health

Task Health is a **home healthcare compliance and staffing platform** operating in New York State. It is a product of **Medflyt LLC** (the legal entity).

### The Three Parties

1. **Home care agencies (LHCSAs)** -- Task Health's paying customers. These are Licensed Home Care Services Agencies that need clinical nursing assessments done for their patients but outsource this to Task Health rather than employing their own RNs.
2. **Registered Nurses (RNs)** -- Independent contractors managed by Task Health. They travel to patients' homes, perform clinical assessments, fill out forms on a mobile app, and submit documentation.
3. **Patients** -- Recipients of home care services. They are the agency's patients, not Task Health's. Task Health provides the nursing assessment service on behalf of the agency.

### What Happens

- An agency has a patient who needs a clinical nursing assessment (e.g., Start of Care, Reassessment)
- The agency logs into Task Health's portal and "broadcasts" the case with patient details
- Task Health assigns one of their RNs to visit the patient's home
- The RN performs the assessment, fills out clinical forms on a mobile app (with AI assistance)
- Task Health generates compliant PDF documents branded with the agency's name/logo
- The agency downloads the completed documents from the portal for their regulatory/billing needs

### Revenue Model

Credit-based system. Agencies pre-purchase credits. Each completed assessment deducts credits:

- Typical cost: **$200 per assessment** (observed in portal data)
- Agency portal shows: Available Credits balance + Pending Payment Credits
- "Buy Credits" button available in portal
- $0 charged for visits in "Needs Attention" status (not yet scheduled)

---

## Company Identity: Medflyt vs Task Health

| Aspect | Detail |
|--------|--------|
| Legal entity | Medflyt LLC |
| Product/brand | Task Health |
| Admin webapp logo | Still shows the **"medflyt" logo** in the header |
| Footer text | "Copyright all rights reserved (c) Medflyt LLC" |
| Support line | "Medflyt Support - call us (718) 550-2775 or email support@medflyt..." |
| Code identifiers | Many use "MEDFLYT" prefix (e.g., `MEDFLYT_PATIENT_ASSESSMENT_HTML`, `MEDFLYT_EMERGENCY_KARDEX_HTML`) |
| Email domains | `@medflyt.com` (agency logins), `@taskshealth.com` (admin logins) |
| Portal URL | `go.task-health.com` (with hyphen) |
| Admin URL | `app.taskshealth.com` (no hyphen, no dash) |
| Marketing URL | `www.task-health.com` (with hyphen) |
| Support email on PDFs | `support@task-health.com` |
| Physical address | 2329 Nostrand Avenue, Brooklyn, NY, USA |

---

## Applications Map

| Application | URL | Repo | Users | Purpose |
|-------------|-----|------|-------|---------|
| Agency Portal | `go.task-health.com` | `rn-platform-website` | Agency staff | Broadcast cases, track visits, download documents |
| Admin Webapp | `app.taskshealth.com` / `app.medflyt.com` | `taskhealth_webapp` (underscore) | Task Health internal team | Full management: patients, tasks, billing, settings |
| RN Mobile App | N/A (Capacitor hybrid app) | `taskhealth-mobile2` | RNs in the field | Fill out assessment forms during patient visits |
| RN Recruitment Site | N/A | `taskhealth-rn` | Potential RN recruits | Marketing/recruitment landing page (NOT a mobile app) |
| Marketing Website | `www.task-health.com` | `marketing-website` | Public | Marketing, booking, webinars |
| Backend API | `api.medflyt.com` | `taskhealth_server2` | All apps | Core API serving all frontends |
| Serverless | N/A (AWS Lambda) | `taskhealth-serverless` | System | Lambda functions |
| PDF Generator | N/A (Lambda) | `taskhealth_patient_docs_pdf` | System | HTML template to PDF conversion |
| Serverless Functions | N/A (Lambda) | `taskhealth-serverless` | System | Doc generation, compliance checks, image processing, IoT, SMS webhooks |
| Telephony AI Agent | N/A (Elastic Beanstalk) | `taskhealth-realtime-agent` | System | AI voice bot for intake calls (OpenAI Realtime + Deepgram) |
| Socket.IO | N/A (Elastic Beanstalk) | `taskhealth-socketio` | System | Real-time notifications and presence tracking |

### Repo Corrections and Clarifications

These corrections were discovered through code analysis:

- `rn-platform-website` is the **Agency Portal** (`go.task-health.com`), NOT the admin webapp.
- `taskhealth_webapp` (underscore) is the **Admin Webapp** (`app.taskshealth.com` / `app.medflyt.com`). Hybrid AngularJS + React.
- `taskhealth-webapp` (hyphen) is a **planned pure-React rewrite** -- early stage, NOT in production.
- `taskhealth-portal-website` is **EMPTY**. Portal migrated to `rn-platform-website`.
- `taskhealth-lambda-html-documents` is **ABANDONED** (last commit Oct 2020). Active PDF generator is `taskhealth_patient_docs_pdf`.
- `taskhealth-rn` is a **recruitment landing page**, NOT the mobile app. The mobile app is `taskhealth-mobile2`.

---

## Admin Webapp Navigation Structure

**Header:** Medflyt logo, global search ("Search anything..."), notification icons, user avatar
**Footer:** "Copyright all rights reserved (c) Medflyt LLC" | "Socket connected" indicator | "Medflyt Support" contact | "What's new" changelog

**Left Sidebar (full tree):**

```
[User: Omer Klein, Medflyt At Home, Home]
+-- Run workflow
+-- Dashboard
+-- Notes
+-- Patients
|   +-- Patients list
|   +-- Care & Task management    <-- main working view
|   +-- Patient Alerts
|   +-- Quality Of Care
|   +-- Eligibility Checks
|   +-- Prompt Testing
|   +-- Intake
|   +-- Authorized Patients Without Visits
|   +-- Patients Compliance
|   +-- Patient Issues
+-- Caregivers
+-- Training Center
+-- Visits
+-- Chat
+-- Comm Center
+-- Workflows
+-- EVV
+-- Payroll
+-- Billing
+-- Reports
+-- HHAX Integration
+-- Compliance
+-- Document Review
+-- Admin
```

**Key Settings Pages:**

- `/app/patient-document-settings` -- Form builder for document templates
- `/app/settings` -- System settings including Contract configuration

---

## Service Architecture

```
                          +---------------------------+
                          |   Agency Portal (React)   |
                          |   go.task-health.com      |
                          |   repo: rn-platform-      |
                          |         website            |
                          +------------+--------------+
                                       |
                                       | HTTPS / REST + WebSocket
                                       v
+---------------------------+    +---------------------------+    +---------------------------+
|  Admin Webapp             |    |   Backend API (Node.js)   |    |  RN Mobile App            |
|  app.taskshealth.com      +--->+   api.medflyt.com         +<---+  (Capacitor hybrid)       |
|  repo: taskhealth_webapp  |    |   repo: taskhealth_       |    |  repo: taskhealth-mobile2 |
|  (AngularJS + React)      |    |         server2           |    |  (React + Capacitor)      |
+---------------------------+    +--+--------+--------+-----+    +---------------------------+
                                    |        |        |
                    +---------------+   +----+----+   +----------------+
                    |                   |         |                    |
                    v                   v         v                    v
   +----------------+---+  +----------+--+  +----+-------------+  +---+------------------+
   |  PostgreSQL + GIS   |  |  Socket.IO  |  |  Serverless      |  |  PDF Generator       |
   |  (primary database) |  |  (EB)       |  |  (AWS Lambda)    |  |  (AWS Lambda)        |
   |  No ORM (zol +      |  |  repo:      |  |  repo:           |  |  repo: taskhealth_   |
   |  mfCrudTables.ts)   |  |  taskhealth |  |  taskhealth-     |  |  patient_docs_pdf    |
   |  Flyway migrations  |  |  -socketio  |  |  serverless      |  |  (wkhtmltopdf +      |
   +---------------------+  +------+------+  +--------+---------+  |   pdftk)             |
                                    |                  |            +----------+-----------+
                                    |                  |                       |
                             Real-time events    Lambda functions         PDFs to S3
                             (push, presence)    (doc gen, compliance,
                                                  image proc, IoT, SMS)
```

**All API calls** from the Agency Portal, Admin Webapp, and RN Mobile App go to `https://api.medflyt.com`.

Authenticated endpoint prefix for portal: `/rn/agencies/:agencyId/agency_members/:agencyMemberId`

---

## Serverless Infrastructure (`taskhealth-serverless`)

The serverless layer is organized into **three sub-services**:

### A. Default Service -- Document Generation and Compliance (25+ Lambdas)

**Document Generation:**

| Lambda | Purpose |
|--------|---------|
| `generateFullProfile` | Full caregiver/patient profiles as PDFs (Chromium) |
| `generatePatientProfile` | Patient profile documents |
| `generateCaregiverProfile` | Caregiver profile documents |
| `generateMfDocument` | Structured `MfDocument` tree to PDF (Chromium/Puppeteer) |
| `generateHrDocument` | HR docs from question/answer payloads (25+ question types) |
| `generatePlanOfCare` | Plan of Care documents |
| `generateDutySheet` / `generatePatientDutySheet` | Duty sheets |
| `generateInvoicePaper` | Invoice documents |
| `generateTrainingCenterCertificate` | Training completion certificates |
| `fillPdf` | Fill PDF form templates with key-value pairs (pdf-lib) |
| `combineAssetsToPDF` | Combine multiple assets into single PDF |

**Compliance Automation (web scraping via Puppeteer):**

| Lambda | Purpose |
|--------|---------|
| `complianceExclusionCheck` | Scrapes OMIG exclusion list (apps.omig.ny.gov) -- name search + SSN verification |
| `collectRNVerification` | Scrapes NYSED e-services -- verifies RN license status + enforcement actions |
| `complianceCaregiverCertificateCheck` | Checks caregiver cert via NY Health State worker portal |

**Image Processing:**

| Lambda | Purpose |
|--------|---------|
| `convertPdfToImage` | PDF pages to images (Sharp + pdfjs-dist) |
| `combineImages` | Combine multiple images (Sharp) |
| `scaleImageToMaxBytes` | Resize images to fit byte limit |
| `createZipFile` | ZIP archives of multiple documents |

### B. IoT Service -- Patient Telemetry

- Endpoint: `POST /forwardtelemetry` at `iot.medflyt.com`
- Receives blood pressure data from IoT devices and publishes to SQS queue
- Dead letter queue for failed messages (max 3 retries)

### C. Callbacks Service -- SMS Webhooks

- Endpoints: `POST /twilio` and `POST /plivo` at `callbacks.taskshealth.com`
- Receives inbound SMS/MMS webhooks from both providers
- Validates signatures, enqueues to SQS (`tasks-health-inbound-sms-{stage}`)

---

## Socket.IO Channel Architecture (`taskhealth-socketio`)

Real-time notifications and presence tracking. This service handles push events and online/offline status -- it is NOT used for chat or AI.

**Channel types:**

| Pattern | Purpose |
|---------|---------|
| `private-agency-{agencyId}` | All members of an agency |
| `private-agencymember-{memberId}` | Specific agency member |
| `private-caregiver-{caregiverId}` | Specific caregiver |
| `presence-agency-{agencyId}` | Caregiver online/offline tracking |

**Server pushes events via:** `POST /api/send-push-to-channels` (server-to-server, authenticated via `X-Server-Auth-Token`)

**Auth flow:** Client connects, emits `auth` with JWT or legacy token, server validates, auto-joins private channels, emits `auth:done`

---

## Telephony AI Voice Agent (`taskhealth-realtime-agent`)

> **Status: Experimental -- not deployed to production.**

This is NOT the RN assessment AI. This is an **automated phone call bot** for intake triage.

**What it does:**

- Makes/receives real-time phone calls
- Conducts automated intake conversations with leads
- Can execute functions during calls (hang up, transfer to intake specialist, send SMS, schedule callbacks)
- Bot persona "Maria" with a New York accent

**AI Stack:**

| Provider | Role |
|----------|------|
| OpenAI Realtime API (`gpt-4o-realtime`) | Voice-to-voice conversation via WebSocket |
| Deepgram Nova 3 | Speech-to-text (alternative) |
| OpenAI gpt-4.1-mini | LLM thinking (with Deepgram) |
| ElevenLabs | Text-to-speech (Jessica voice) |

**Architecture:** Telephony (Plivo/Twilio) <-> WebSocket (Hono on Elastic Beanstalk) <-> OpenAI/Deepgram

The "Maria" persona was never deployed to production. This remains an experiment.
