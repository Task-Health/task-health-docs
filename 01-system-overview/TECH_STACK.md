# Task Health Technology Stack

## Backend API (`taskhealth_server2`)

| Component | Technology |
|-----------|-----------|
| Database | **PostgreSQL 8.7.1** with PostGIS |
| ORM | **None** -- uses `zol` (typed SQL builder), custom `mfCrudTables.ts` CRUD helper, raw SQL |
| SQL Type Checker | `@medflyt/mfsqlchecker` (custom) |
| Migrations | **Flyway-style** sequential SQL in `sql/migrations/` (V0001 through V1000+) |
| Types | TypeScript with shared types in `src/messages/` (230+ files) |

## Admin Webapp (`taskhealth_webapp` -- underscore)

| Component | Technology |
|-----------|-----------|
| Architecture | **Hybrid AngularJS 1.8 + React 18** via `@uirouter/react-hybrid` |
| Legacy UI | AngularJS + Bootstrap 3.3.7 + UI-Router |
| Modern UI | React 18 + Chakra UI 2.7 + TanStack React Query 5 |
| Forms (React) | react-hook-form + Zod |
| Build | **Vite** (with custom AngularJS plugins) |
| Package Manager | **pnpm** 8.6.6 (workspaces) |
| API | OpenAPI/REST (auto-generated types) + **GraphQL** (codegen) |
| Deployment | **AWS Amplify** |
| Communication | React-bridge via `CustomEvent` dispatching between AngularJS and React |

## Agency Portal (`rn-platform-website`)

| Component | Technology |
|-----------|-----------|
| Framework | **React 19** with **Vite** |
| Routing | **TanStack Router** (file-based routing) |
| UI Library | **Chakra UI v3** |
| State | **Jotai** atoms + TanStack React Query |
| Forms | Custom `useControlledForm` + **Zod** validation |
| API Client | Auto-generated from OpenAPI spec (`src/schema/schema.ts`) |
| Real-time | WebSocket via `src/lib/socket.ts` |
| Deployment | **SST** (Serverless Stack on AWS) |
| API Base | `https://api.medflyt.com` |

## RN Mobile App (`taskhealth-mobile2`)

| Component | Technology |
|-----------|-----------|
| Framework | **React 17 + Capacitor 7** (hybrid native app, v4.20.19) |
| App ID | `com.taskshealth.app` |
| Build | Vite 5 + TypeScript 5.9 |
| State | Jotai + TanStack React Query 4 + Immutable.js |
| UI | **Emotion** (CSS-in-JS) + **OnsenUI** + Framer Motion |
| Forms | react-hook-form + Zod |
| Maps | Mapbox GL + MapLibre GL |
| Native | Capacitor plugins (camera, geolocation, push notifications, speech recognition) |
| Signatures | **react-signature-canvas** |
| AI | OpenAI Realtime API (WebRTC), server-side AI generation |
| Monitoring | Sentry + LogRocket |
| Networking | Axios + socket.io-client |

## PDF Generator (`taskhealth_patient_docs_pdf`)

| Component | Technology |
|-----------|-----------|
| HTML to PDF | `html-pdf` (uses **wkhtmltopdf** via PhantomJS) |
| PDF Form Fill | `pdffiller` (uses **pdftk** binary) |
| Runtime | **Node.js 14** on **AWS Lambda** |
| Binaries | pdftk, Ghostscript, ImageMagick bundled in `bin/` |
| Storage | Generated PDFs uploaded to **S3** |
| Styling | `styles.css` -- Georgia font, 9px body, Material Icons for checkboxes |

## Serverless (`taskhealth-serverless`)

| Component | Technology |
|-----------|-----------|
| Runtime | AWS Lambda (Node.js) |
| PDF Rendering | Chromium / Puppeteer (headless browser) |
| PDF Form Filling | pdf-lib |
| Image Processing | Sharp + pdfjs-dist |
| Compliance Checks | Puppeteer (web scraping OMIG, NYSED, NY Health State) |
| IoT Telemetry | SQS queues |
| SMS Webhooks | Twilio + Plivo signature validation, SQS |

---

## Database Details

### PostgreSQL (No ORM)

The backend uses **PostgreSQL 8.7.1 with PostGIS** and deliberately avoids traditional ORMs. Instead, it relies on three custom tools for database access:

**`zol`** -- A typed SQL builder that provides compile-time type safety for SQL queries. Queries are written in a SQL-like DSL that compiles to raw SQL.

**`mfCrudTables.ts`** -- A custom CRUD helper that provides standard create/read/update/delete operations for defined table schemas. Tables are registered with their column definitions, and the helper generates type-safe operations.

**`@medflyt/mfsqlchecker`** -- A custom SQL type checker (internal package) that validates raw SQL strings at compile time against the actual database schema, catching type mismatches and invalid column references before runtime.

### Migrations (Flyway-style)

Database migrations are sequential SQL files in `sql/migrations/`, following the Flyway naming convention:

```
sql/migrations/
  V0001__Initial_Tables.sql          -- agency, user, caregiver, visit, chat, SMS
  V0090__PatientsTable.sql           -- patient table
  V0092__Treatments.sql              -- contract, contract_type, service_code
  V0163__PatientDocuments.sql        -- patient_documents_types, versions, scheduled, answers
  V0236__Add_lots_of_Billing_...sql  -- visit_instance, authorization, billing_rate, invoice
  V0504__patient_tasks.sql           -- patient_task_template, patient_task, patient_task_instance
  V0646__new_task.sql                -- Major task refactor (broadcasting, visit link)
  V0729__patient_start_of_care...sql -- patient_certification_period
  V0847                              -- Added certification_period_id to patient_task
  ...through V1000+
```

Each migration is a plain SQL file executed sequentially. There is no code-based migration framework -- just raw DDL and DML.

---

## Deployment Infrastructure

| Application | Deployment Target | Notes |
|-------------|-------------------|-------|
| Backend API | (not specified -- likely Elastic Beanstalk or ECS) | Serves `api.medflyt.com` |
| Admin Webapp | **AWS Amplify** | `app.taskshealth.com` |
| Agency Portal | **SST** (Serverless Stack on AWS) | `go.task-health.com` |
| RN Mobile App | App stores (Capacitor hybrid) | `com.taskshealth.app` |
| PDF Generator | **AWS Lambda** | Node.js 14, bundles native binaries |
| Serverless Functions | **AWS Lambda** | Multiple functions (doc gen, compliance, image, IoT, SMS) |
| Socket.IO | **AWS Elastic Beanstalk** | Real-time notifications and presence |
| Telephony AI Agent | **AWS Elastic Beanstalk** | Hono WebSocket server (experimental, not deployed) |
| Marketing Website | (not specified) | `www.task-health.com`, Next.js |
| Generated PDFs | **AWS S3** | All PDF output stored in S3 buckets |

---

## Key Third-Party Services

### AI and Machine Learning

| Service | Usage |
|---------|-------|
| OpenAI GPT-5.1 | Per-question AI generation in clinical forms (Patient Assessment) |
| OpenAI GPT-4.1 | Plan of Care generation |
| OpenAI Realtime API (WebRTC) | Live translation during patient visits (mobile app) |
| OpenAI gpt-4o-realtime | Voice bot for intake calls (experimental) |
| Deepgram Nova 3 | Speech-to-text for voice bot (experimental) |
| ElevenLabs | Text-to-speech for voice bot (experimental) |

### Communications

| Service | Usage |
|---------|-------|
| Twilio | SMS/MMS (inbound webhooks, document delivery) |
| Plivo | SMS/MMS (alternative provider, also telephony for voice bot) |
| Firebase Cloud Messaging (FCM) | Push notifications to RN mobile app |

### Payments

| Service | Usage |
|---------|-------|
| Stripe | Agency credit purchases (payment method setup in portal) |

### Maps and Location

| Service | Usage |
|---------|-------|
| Mapbox GL | Maps in mobile app |
| MapLibre GL | Maps in mobile app (open-source alternative) |
| PostGIS | Server-side geospatial queries (distance calculations for broadcasting) |

### Monitoring

| Service | Usage |
|---------|-------|
| Sentry | Error tracking (mobile app) |
| LogRocket | Session replay and monitoring (mobile app) |
| Langfuse | LLM observability (separate SST deployment: `taskhealth-langfuse-sst`) |

### Healthcare Integrations

| Service | Usage |
|---------|-------|
| HHAeXchange (HHAX) | Patient registry import (single and bulk), integration in admin webapp |
| OMIG (NY Office of Medicaid Inspector General) | Exclusion list compliance checks (scraped via Puppeteer) |
| NYSED (NY State Education Department) | RN license verification (scraped via Puppeteer) |
| NY Health State Worker Portal | Caregiver certification checks (scraped via Puppeteer) |

### IoT

| Service | Usage |
|---------|-------|
| IoT blood pressure devices | Patient telemetry forwarded to `iot.medflyt.com`, queued via SQS |
