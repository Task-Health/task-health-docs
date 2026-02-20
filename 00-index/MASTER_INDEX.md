# Task Health — Master Index

> **Read this file FIRST at the start of every session.**
> It tells you which docs to load based on the task at hand.

---

## 1. Keyword → Domain Routing Table

Use this table to decide which docs to read based on the user's task description.

| Keyword / Topic | Read These Docs |
|----------------|----------------|
| task, assignment, broadcast, scheduling, RN matching, visit, calendar, task instance, task template, cycle period, repeat | `03-domains/TASK_LIFECYCLE.md` |
| document, PDF, form, assessment, POC, plan of care, CMS-485, kardex, welcome package, supervisory, form builder, document template, question type, itemType | `03-domains/CLINICAL_DOCUMENTS.md` |
| AI, review, generation, ICD codes, teaching, narrative, rules engine, prognosis, functional limitations, activities permitted, safety measures, progress note, GPT, prompt, invisible question, lock hint | `03-domains/AI_SYSTEM.md` |
| billing, credits, invoice, authorization, payroll, pay rate, service code, payroll code, EDI, rounding, surplus, issue type | `03-domains/BILLING_AND_CREDITS.md` |
| user, auth, login, caregiver, RN, nurse, certification, credential, agency member, admin, role, permission | `03-domains/USERS_AND_AUTH.md` |
| patient, profile, status, diagnosis, ICD, medication, allergy, staffing preference, emergency contact, certification period, start of care, discharge | `03-domains/PATIENTS.md` |
| contract, agency, LHCSA, office, billing settings, EDI config, EVV, care rate, template override, wage parity | `03-domains/CONTRACTS_AND_AGENCIES.md` |
| SMS, push notification, FCM, socket, WebSocket, real-time, presence, Twilio, Plivo, comm center, fax, chat | `03-domains/NOTIFICATIONS_AND_COMMS.md` |
| mobile app, Capacitor, question rendering, speech-to-text, live translation, signature, copy from last, blockOnMobile, answer saving | `03-domains/RN_MOBILE_APP.md` |
| start of care, SOC, initial assessment, new patient | `04-workflows/START_OF_CARE_FLOW.md` |
| reassessment, renewal, recertification | `04-workflows/REASSESSMENT_FLOW.md` |
| supervisory, aide evaluation, competency, POC connection | `04-workflows/SUPERVISORY_VISIT_FLOW.md` |
| onboarding, recruitment, background check, credential upload | `04-workflows/NURSE_ONBOARDING_FLOW.md` |
| Stripe, payment, credit purchase | `05-integrations/STRIPE.md` |
| SendGrid, email, email template | `05-integrations/SENDGRID.md` |
| HHAeXchange, HHAX, IVR, POC codes | `03-domains/CLINICAL_DOCUMENTS.md` |
| database, schema, table, column, migration, FK, foreign key, enum | `02-data-model/FULL_SCHEMA.md` + `02-data-model/ENTITY_RELATIONSHIPS.md` |
| nursing database question, nursingQuestionLinked, DatabaseLinkType, cross-document, blockOnMobile, data flow | `03-domains/CLINICAL_DOCUMENTS.md` + `03-domains/AI_SYSTEM.md` |
| PDF generation, Lambda, wkhtmltopdf, pdftk, Puppeteer, MfDocument, html-to-pdf, Nunjucks | `01-system-overview/ARCHITECTURE.md` + `03-domains/CLINICAL_DOCUMENTS.md` |
| repo, codebase, technology, framework, dependency | `01-system-overview/REPO_MAP.md` + `01-system-overview/TECH_STACK.md` |

---

## 2. Domain Map

| Domain Doc | What It Covers |
|-----------|---------------|
| **TASK_LIFECYCLE.md** | Task Templates → Tasks → Task Instances → Visit Instances. Broadcasting, RN assignment, scheduling, status transitions, 10-step creation pipeline, certification periods. |
| **CLINICAL_DOCUMENTS.md** | All document types (PA, POC, CMS-485, Kardex, Welcome Package, Supervisory). Form builder, 25+ question types, 3 PDF pipelines, cross-document nursing database questions (61 DatabaseLinkType values), document versioning, agency branding. |
| **AI_SYSTEM.md** | 26 AI-generated questions, AI review system (20 section rules, HARD vs SUGGESTED, 7 medication-diagnosis clusters), POC rules engine (673-line deterministic prompt, 27 derived flags), ICD code generation, 5 invisible auto-generated questions, teaching narratives, lock hints. |
| **BILLING_AND_CREDITS.md** | Credit-based revenue ($200/assessment), authorizations (day-of-week, period hours), contract billing settings (rounding, tolerances, EDI), pay rates, surpluses, invoicing, ~30 issue types, service/payroll codes. |
| **USERS_AND_AUTH.md** | Three user types (Agency, RN, Admin), auth per platform, caregiver entity, 40+ certification types, RN eligibility matching (language + distance + certs), roles and permissions. |
| **PATIENTS.md** | Patient entity — 6 profile tabs, 12 statuses, per-patient contracts, certification periods, diagnosis codes (ICD-10), medication profiles, staffing preferences, emergency contacts, multiple ID systems. |
| **CONTRACTS_AND_AGENCIES.md** | Contract = Agency. Setup fields, billing/rounding, EDI config, EVV, care rates, issue settings, agency-specific template overrides. |
| **NOTIFICATIONS_AND_COMMS.md** | SMS delivery (Twilio + Plivo), FCM push, Socket.IO events (4 channel types), WebSocket presence, inbound SMS webhooks, comm center, fax. |
| **RN_MOBILE_APP.md** | React + Capacitor architecture, 25+ question types, conditional visibility, real-time saving, 4 AI features (generation, speech-to-text, live translation, copy from last), signatures, resubmission flow. |

---

## 3. Repo Map (Active Repos)

| Repo | Purpose | Tech |
|------|---------|------|
| `taskhealth_server2` | **Primary backend API** — serves all frontends | Node.js, PostgreSQL, zol SQL, TypeScript |
| `rn-platform-website` | **Agency Portal** (go.task-health.com) — agencies broadcast cases, track visits, download docs | React 19, Vite, Chakra UI v3, TanStack Router, Jotai |
| `taskhealth_webapp` | **Admin Webapp** (app.taskshealth.com) — full management | Hybrid AngularJS 1.8 + React 18, Chakra UI 2.7, Vite |
| `taskhealth-mobile2` | **RN Mobile App** — form filling during patient visits | React 17, Capacitor 7, Jotai, OnsenUI, Emotion |
| `taskhealth-serverless` | **Serverless functions** — doc generation, compliance checks, image processing | AWS Lambda, Puppeteer, Sharp |
| `taskhealth_patient_docs_pdf` | **Legacy PDF generator** — CMS-485, billing forms | Node.js 14, Lambda, pdftk, html-pdf |
| `html-to-pdf-lambda` | **HTML→PDF Lambda** — newer pipeline for MEDFLYT_*_HTML docs | wkhtmltopdf, Terraform, Node.js 18 |
| `taskhealth-socketio` | **Real-time notifications** — Socket.IO presence tracking | Socket.IO, Elastic Beanstalk |
| `taskhealth-realtime-agent` | **Telephony AI agent** — automated intake calls | OpenAI Realtime, Deepgram, ElevenLabs, Hono |
| `taskhealth-onboarding` | **RN onboarding system** | |
| `taskhealth-rn` | **RN recruitment landing page** (NOT the mobile app) | |
| `marketing-website` | **Marketing site** (www.task-health.com) | Next.js |
| `taskhealth-sst` | **SST infrastructure** | SST (Serverless Stack) |
| `taskhealth-langfuse-sst` | **LLM observability** — Langfuse setup | SST |
| `taskhealth-workflows-designer` | **Workflow designer tool** | |
| `taskhealth-dashboard` | **Dashboard** | |
| `task-health-docs` | **This knowledge base** | Markdown |

> **Repo name gotchas:**
> - `taskhealth_webapp` (underscore) = Admin Webapp (production). `taskhealth-webapp` (hyphen) = planned React rewrite (NOT in production).
> - `taskhealth-rn` = recruitment landing page, NOT the mobile app. Mobile app = `taskhealth-mobile2`.
> - `taskhealth-portal-website` = EMPTY. Portal migrated to `rn-platform-website`.
> - `taskhealth-lambda-html-documents` = ABANDONED (last commit Oct 2020). Active PDF generator = `taskhealth_patient_docs_pdf`.

See `01-system-overview/REPO_MAP.md` for full details on all ~120 repos.

---

## 4. Quick Reference

### The Three Parties
1. **Home care agencies (LHCSAs)** — Task Health's paying customers
2. **Registered Nurses (RNs)** — Independent contractors managed by Task Health
3. **Patients** — The agency's patients, not Task Health's

### The Core Flow
Agency broadcasts case → Task Health assigns RN → RN visits patient → RN fills forms (with AI) → System generates branded PDFs → Agency downloads documents

### The Task Hierarchy
```
patient_task_template → patient_task → patient_task_instance → visit_instance
(blueprint)            (assignment)    (one occurrence)         (calendar event)
```

### The Document Pipeline
Form builder defines template → RN fills form on mobile → Answers saved real-time → AI generates invisible questions → Cross-document data flows via nursingQuestionLinked → Lambda generates branded PDF → SMS delivery

### The Three PDF Pipelines
1. **Pipeline 1 (HTML)**: Nunjucks templates → `html-to-pdf-lambda` (wkhtmltopdf) → S3 — for MEDFLYT_*_HTML docs (PA, POC, Kardex, Supervisory, Welcome Package)
2. **Pipeline 2 (Legacy PDF fill)**: `taskhealth_patient_docs_pdf` → pdftk fills templates → S3 — for CMS-485, billing forms
3. **Pipeline 3 (MfDocument)**: `taskhealth-serverless/generateMfDocument` → Puppeteer → S3 — for internal/admin docs (profiles, invoices, HR forms)

### Revenue Model
Credit-based. Agencies pre-purchase credits. ~$200 per completed assessment.

### Company Identity
- **Legal entity:** Medflyt LLC
- **Product/brand:** Task Health
- API: `api.medflyt.com` | Portal: `go.task-health.com` | Admin: `app.taskshealth.com`

---

## 5. Always-Load Docs (Every Session)

These should be read at the start of every session:
- `01-system-overview/ARCHITECTURE.md`
- `01-system-overview/TECH_STACK.md`

Then load domain-specific docs based on the task at hand (use the routing table above).

---

## 6. Data Model Docs

When the task involves database changes, schema understanding, or entity relationships:
- `02-data-model/FULL_SCHEMA.md` — Every table, column, type, constraint
- `02-data-model/ENTITY_RELATIONSHIPS.md` — FK map, junction tables, ERD, common JOINs
