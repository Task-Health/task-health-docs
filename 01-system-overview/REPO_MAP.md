# Repo Map

> Every active repository in the Task Health org, what it does, and key dependencies.

**Note:** The Task-Health GitHub org contains ~120+ repositories. This document covers the **actively used repositories** relevant to the RN platform. Many legacy/dormant repos exist but are not documented here.

---

## Core Application Repos

### taskhealth_server2
- **Type:** Backend API server
- **Tech:** Node.js + TypeScript + Express
- **Database:** PostgreSQL (via `zol` typed SQL builder)
- **What it does:** The main backend powering all platforms (agency portal, admin webapp, RN mobile app). Handles task management, document system, AI generation/review, billing, credits, user auth, broadcasting, and all business logic.
- **Deployment:** EC2 / Elastic Beanstalk
- **Key paths:**
  - `src/rn-platform/` — RN platform-specific logic (tasks, documents, AI, credits)
  - `src/modules/` — Domain modules (stripe, recruitment, communication center, etc.)
  - `sql/migrations/` — 1,528 Flyway-style SQL migrations (V0001–V1528+)
  - `src/Utils/StripeUtils.ts` — Stripe integration
  - `src/Email/` — SendGrid email
  - `src/GoogleApi/` — Google Calendar
- **Gotchas:** Uses `zol` (not Prisma/TypeORM) for typed SQL. Migration files are the source of truth for schema.

### rn-platform-website
- **Type:** Agency portal (frontend)
- **Tech:** React + TypeScript
- **URL:** `go.task-health.com`
- **What it does:** Agency-facing portal where coordinators manage patients, create tasks, view documents, buy credits, and track visits.
- **Key features:** Patient profile (6 tabs), task creation, document viewer, credit purchases, calendar, billing

### taskhealth_webapp
- **Type:** Admin webapp (frontend)
- **Tech:** React + TypeScript
- **URL:** `app.taskshealth.com`
- **What it does:** Internal Task Health admin portal. Full access to all agencies, patients, caregivers. Manages the form builder, document templates, QA review, and system configuration.
- **Key features:** Form builder UI, document version management, AI review dashboard, agency management

### taskhealth-mobile2
- **Type:** RN mobile app
- **Tech:** React 17 + Capacitor 7 (hybrid iOS/Android)
- **App ID:** `com.taskshealth.app`
- **What it does:** The app RNs use during patient visits. Form filling, AI generation, speech-to-text, live translation, signatures, real-time answer saving.
- **Key paths:**
  - `src/components/POCDocumentQuestion/` — POC duty selection
  - `src/components/AIGenerationButton/` — AI generation UI
  - `src/components/RNNarrativeScreen/` — Speech-to-text narratives
  - `src/components/LiveTranslationModal/` — Real-time translation
- **Build:** Vite 5 + TypeScript 5.9
- **State:** Jotai + TanStack React Query 4 + Immutable.js

### taskhealth-rn
- **Type:** RN recruitment website
- **Tech:** React
- **What it does:** Public-facing website for recruiting new RNs. Application forms, landing pages.

---

## Serverless & Infrastructure Repos

### taskhealth-serverless
- **Type:** AWS Lambda functions (Serverless Framework)
- **Tech:** Node.js + TypeScript
- **What it does:** Background processing, PDF generation, webhooks, SMS callbacks.
- **Key services:**
  - **Callbacks Service** — Inbound SMS/MMS webhooks (Twilio + Plivo) at `callbacks.taskshealth.com`
  - **generateMfDocument** — Pipeline 3 PDF generation (Puppeteer → S3)
  - **Document generation queue** — Async PDF processing
- **Deployment:** AWS Lambda via Serverless Framework

### html-to-pdf-lambda
- **Type:** AWS Lambda
- **Tech:** Node.js + wkhtmltopdf
- **What it does:** Pipeline 1 PDF generation. Takes Nunjucks HTML templates, renders to PDF using wkhtmltopdf, uploads to S3.
- **Templates:** Per document type (Patient Assessment, POC, Welcome Package, Emergency Kardex, Supervisory)

### taskhealth_patient_docs_pdf
- **Type:** PDF generation service
- **Tech:** Node.js + pdftk
- **What it does:** Pipeline 2 (legacy) PDF generation. Fills pre-built PDF templates with patient/visit data using pdftk.
- **Used for:** CMS-485, OCA-960, and other older document types

### taskhealth-socketio
- **Type:** WebSocket server
- **Tech:** Node.js + Socket.IO
- **Deployment:** Elastic Beanstalk
- **What it does:** Real-time event delivery to all platforms.
- **Channel patterns:**
  - `private-agency-{agencyId}` — All agency members
  - `private-agencymember-{memberId}` — Specific member
  - `private-caregiver-{caregiverId}` — Specific RN
  - `presence-agency-{agencyId}` — Online/offline tracking
- **Server push:** `POST /api/send-push-to-channels` (server-to-server, `X-Server-Auth-Token`)

### taskhealth-realtime-agent
- **Type:** Telephony AI bot
- **Tech:** Node.js + Hono + WebSocket
- **Deployment:** Elastic Beanstalk
- **What it does:** Automated phone call bot "Maria" for intake triage. Uses OpenAI Realtime API + Deepgram + ElevenLabs.
- **Status:** Experimental — not actively used per owner.

---

## Supporting Repos

### task-health-docs
- **Type:** Documentation (this repo)
- **What it does:** Centralized knowledge base for the entire Task Health platform. Read by Claude Code sessions for context loading.

---

## Integration Repos (UNVERIFIED — may exist)

These repos are expected based on the architecture but haven't been verified:

| Repo (expected) | Purpose |
|----------------|---------|
| Infrastructure/deployment configs | Terraform, CloudFormation, or similar |
| CI/CD pipelines | GitHub Actions workflows |
| Shared type definitions | Shared TypeScript types across repos |
| Analytics/reporting | Business intelligence, dashboards |

---

## Repo Dependency Map

```
                    taskhealth_server2 (backend API)
                   /        |        \          \
                  /         |         \          \
rn-platform-website   taskhealth_webapp   taskhealth-mobile2   taskhealth-rn
(agency portal)       (admin webapp)      (RN mobile app)      (recruitment)
                            |
                   Form Builder UI
                   (creates document templates
                    stored in server2 DB)

taskhealth_server2 --calls--> taskhealth-serverless (Lambda functions)
                   --calls--> html-to-pdf-lambda (PDF Pipeline 1)
                   --calls--> taskhealth_patient_docs_pdf (PDF Pipeline 2)
                   --pushes-> taskhealth-socketio (real-time events)

taskhealth-serverless --includes--> generateMfDocument (PDF Pipeline 3)
                      --receives--> SMS webhooks from Twilio/Plivo
```

---

## Tech Stack Summary Per Repo

| Repo | Language | Framework | Database | Deployment |
|------|----------|-----------|----------|------------|
| taskhealth_server2 | TypeScript | Express | PostgreSQL (zol) | EC2/EB |
| rn-platform-website | TypeScript | React | — | Static hosting |
| taskhealth_webapp | TypeScript | React | — | Static hosting |
| taskhealth-mobile2 | TypeScript | React + Capacitor 7 | — | iOS/Android |
| taskhealth-rn | TypeScript | React | — | Static hosting |
| taskhealth-serverless | TypeScript | Serverless Framework | — | AWS Lambda |
| html-to-pdf-lambda | TypeScript | — | — | AWS Lambda |
| taskhealth_patient_docs_pdf | TypeScript | — | — | Service |
| taskhealth-socketio | TypeScript | Socket.IO | — | EB |
| taskhealth-realtime-agent | TypeScript | Hono | — | EB |
| task-health-docs | Markdown | — | — | GitHub |
