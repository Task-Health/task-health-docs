# Task Health — Knowledge Base Ongoing Maintenance Guide

> **This file is the authoritative guide for how the Task Health knowledge base works, how it's structured, and how every Claude Code session should maintain it.**
>
> Read this file at the start of every session. Act on it throughout.

---

## 1. What Is This Knowledge Base

This repo (`Task-Health/task-health-docs`) is the centralized documentation for the entire Task Health platform. It exists so that any Claude Code session, in any repo, can quickly load the right context before starting work — instead of relearning the system from scratch every time.

**The knowledge base is a LIVING document.** It grows with every session. Every time you work on the Task Health codebase and learn something new — a business rule, a gotcha, a relationship, a code pattern — you update the relevant doc here.

---

## 2. Repo Structure

```
task-health-docs/
├── CLAUDE.md                              ← How to use this repo (read by Claude automatically)
├── KNOWLEDGE_BASE_GUIDE.md                ← THIS FILE — the ongoing maintenance guide
├── 00-index/
│   └── MASTER_INDEX.md                    ← THE entry point. Keyword routing table. Read FIRST every session.
├── 01-system-overview/
│   ├── ARCHITECTURE.md                    ← System architecture, deployment, 3 PDF pipelines, service map
│   ├── TECH_STACK.md                      ← Per-repo technology details
│   └── REPO_MAP.md                        ← Every repo in the org, what it does, dependencies
├── 02-data-model/
│   ├── FULL_SCHEMA.md                     ← Every database table, every column, every constraint
│   └── ENTITY_RELATIONSHIPS.md            ← FK map, junction tables, ERD, common JOIN patterns
├── 03-domains/
│   ├── TASK_LIFECYCLE.md                  ← Templates → Tasks → Instances → Visits, broadcasting, assignment
│   ├── CLINICAL_DOCUMENTS.md              ← All documents, form builder, PDF generation, cross-doc flow
│   ├── AI_SYSTEM.md                       ← AI generation, review system, POC rules engine, ICD codes
│   ├── BILLING_AND_CREDITS.md             ← Credits, authorizations, invoicing, pay rates, EDI
│   ├── USERS_AND_AUTH.md                  ← User types, auth flows, caregiver certifications, RN matching
│   ├── PATIENTS.md                        ← Patient entity, profile tabs, statuses, cert periods, dx codes
│   ├── CONTRACTS_AND_AGENCIES.md          ← Contract/agency setup, billing settings, template overrides
│   ├── NOTIFICATIONS_AND_COMMS.md         ← SMS, push, Socket.IO, webhooks, comm center
│   └── RN_MOBILE_APP.md                   ← Mobile form rendering, question types, AI features, signatures
├── 04-workflows/
│   ├── START_OF_CARE_FLOW.md              ← End-to-end SOC: broadcast → RN visit → docs → delivery
│   ├── REASSESSMENT_FLOW.md               ← How reassessments differ from SOC
│   ├── SUPERVISORY_VISIT_FLOW.md          ← POC↔Supervisory connection, aide evaluation
│   └── NURSE_ONBOARDING_FLOW.md           ← RN recruitment → onboarding → first assignment
├── 05-integrations/
│   ├── STRIPE.md                          ← Credit purchases, payment methods, webhooks
│   ├── SENDGRID.md                        ← Email templates, triggers, configuration
│   ├── GOOGLE_CALENDAR.md                 ← Calendar sync (if applicable)
│   └── WHATSAPP.md                        ← WhatsApp messaging integration
└── 06-screenshots/                        ← App screenshots (DO NOT DELETE)
```

---

## 3. Domain Descriptions

| Domain | File | What It Covers |
|--------|------|---------------|
| **Task Lifecycle** | `TASK_LIFECYCLE.md` | Task Templates → Tasks → Task Instances → Visit Instances. Broadcasting, RN assignment, scheduling, status transitions (Unassigned → Broadcasting → Assigned → Scheduled → Completed). The full 10-step creation pipeline. Certification periods. |
| **Clinical Documents** | `CLINICAL_DOCUMENTS.md` | The entire document system — Patient Assessment (v10, 8 pages), POC (v7, 42 duties), CMS-485 (28 fields), Emergency Kardex, Welcome Package, Aide Supervisory. Form builder, document templates, all 3 PDF generation pipelines, cross-document nursing database questions (61 DatabaseLinkType values), document versioning, agency branding. |
| **AI System** | `AI_SYSTEM.md` | All AI capabilities — 26 AI-generated questions, AI review system (20 section rules, HARD vs SUGGESTED, 7 medication-diagnosis clusters), POC rules engine (673-line deterministic prompt, 27 derived flags), ICD code generation, 5 invisible auto-generated questions, teaching narratives, lock hints/prerequisites. |
| **Billing & Credits** | `BILLING_AND_CREDITS.md` | Credit-based revenue ($200/assessment), authorizations (day-of-week, period hours), contract billing settings (rounding, tolerances, EDI), pay rates, surpluses, invoicing, ~30 issue types, service/payroll codes. |
| **Users & Auth** | `USERS_AND_AUTH.md` | Three user types (Agency, RN, Admin), auth per platform, caregiver entity, 40+ certification types, RN eligibility matching (language + distance + certs), roles and permissions. |
| **Patients** | `PATIENTS.md` | Patient entity — 6 profile tabs, 12 statuses, per-patient contracts, certification periods, diagnosis codes (ICD-10), medication profiles, staffing preferences, emergency contacts, multiple ID systems. |
| **Contracts & Agencies** | `CONTRACTS_AND_AGENCIES.md` | Contract = Agency. Setup fields, billing/rounding, EDI config, EVV, care rates, issue settings, agency-specific template overrides. |
| **Notifications & Comms** | `NOTIFICATIONS_AND_COMMS.md` | SMS delivery (Twilio + Plivo), FCM push, Socket.IO events (4 channel types), WebSocket presence, inbound SMS webhooks, comm center, fax. |
| **RN Mobile App** | `RN_MOBILE_APP.md` | React + Capacitor architecture, 25+ question types, conditional visibility, real-time saving, 4 AI features (generation, speech-to-text, live translation, copy from last), signatures, resubmission flow. |

---

## 4. What Each Doc Should Contain

### Domain Docs (03-domains/)
Every domain doc MUST have these sections:

1. **Overview** — What this domain covers, why it exists, key business concepts
2. **Entities** — Which tables belong to this domain (reference FULL_SCHEMA.md for details)
3. **Relationships** — How entities connect within this domain AND to other domains
4. **Status Transitions** — Every status enum, valid transitions, triggers
5. **Business Rules** — Logic in CODE not in DB: validation rules, calculations, constraints. Cite actual file paths.
6. **Key Code Locations** — Format: `repo/path/to/file.ts:functionName()` or `:lineNumber`
7. **API Endpoints** — Method, path, purpose, key parameters
8. **Common Patterns** — Typical queries, recurring code patterns
9. **Edge Cases & Gotchas** — Non-obvious behavior, past bugs, things that trip people up
10. **Real Data Examples** — Sanitized but realistic

### Workflow Docs (04-workflows/)
Every workflow doc MUST be an end-to-end story with:

1. **Trigger** — What kicks off this workflow
2. **Step-by-step flow** — Every step including: UI action → API call → DB changes → notifications → background jobs
3. **Decision Points** — Where the flow branches
4. **Error Handling** — What happens when things fail at each step
5. **Tables Touched** — Every table read or written
6. **Code Paths** — Actual files/functions that implement each step

### Integration Docs (05-integrations/)
Every integration doc MUST include:

1. **What it does** — Why we use this service
2. **Authentication** — Approach (NOT secrets)
3. **Key API calls** — Endpoints we use and why
4. **Configuration** — Env variable names (NOT values)
5. **Code Location** — Where the integration code lives
6. **Known Limitations** — Rate limits, quirks, gotchas

---

## 5. How to Maintain the Knowledge Base During Every Session

### CRITICAL RULE: Cascade Updates
**Every time you add, change, or remove content in ANY knowledge base file, you MUST think thoroughly about ALL other files that may be affected and update them too.** The knowledge base is interconnected — a change in one place almost always requires changes in others.

**Examples of cascade updates:**
- You update a table schema in FULL_SCHEMA.md → also update ENTITY_RELATIONSHIPS.md + the domain doc that owns that table + any workflow doc that references that table
- You discover a business rule belongs to a different domain → move it from the old domain doc to the new one + update MASTER_INDEX.md keyword routing if needed
- You learn an API endpoint changed → update the domain doc + the workflow doc that references it + ARCHITECTURE.md if it affects system-level routing
- You add a new domain doc → update MASTER_INDEX.md (routing table + domain map + repo map) + KNOWLEDGE_BASE_GUIDE.md (Section 3 + Section 8)

**Never update a single file in isolation.** Always ask: "What other files reference or depend on what I just changed?"

### CRITICAL RULE: Replace Stale Data — Don't Pile On
**When you learn something new that contradicts or supersedes existing documentation, DELETE the old/incorrect content and replace it with the fresh data.** Do this in the file you're working on AND in every other file that contains the stale information.

**Do NOT:**
- Add new content while leaving contradictory old content in place
- Add "UPDATE:" or "NOTE: this has changed" annotations — just fix the actual content
- Keep outdated examples, file paths, enum values, or business rules around "for reference"

**DO:**
- Find and remove every instance of the stale data across ALL knowledge base files
- Replace with the current, accurate information
- If you're unsure whether old data is stale or still valid, verify against the actual codebase before removing

### When starting a session:
1. Read `MASTER_INDEX.md` to understand the full structure
2. Read the domain docs relevant to your current task
3. Note what's documented well vs what's missing or outdated

### While working:
Keep a mental list of new things you learn:
- A business rule you discovered in the code
- A relationship between tables you didn't know about
- An edge case or gotcha that isn't documented
- A code pattern that's commonly used
- A correction to something that's wrong in the docs
- Something in the docs that is WRONG or OUTDATED and needs to be fixed

### Before ending a session:
1. **Update** the relevant domain/workflow docs with what you learned
2. **Cascade** — for every change you made, check ALL other files for related content that needs updating
3. **Delete stale data** — if your new knowledge contradicts existing docs, find and replace the old info everywhere
4. **Add** new entries to MASTER_INDEX.md keyword routing table if needed
5. **Create** new docs if you discovered a whole new area that isn't covered
6. **Split** any doc that exceeded ~40 pages — create sub-docs and update MASTER_INDEX.md
7. **Update Section 8** of this guide if you completed or partially completed any doc
8. **Commit and push**:
   ```bash
   cd /tmp/task-health-docs
   git add -A
   git commit -m "Knowledge base update from [repo name] session: [brief description of what was added/changed]"
   git push
   ```

### What to update (with cascade checklist):
- **New table discovered?** → Add to FULL_SCHEMA.md + ENTITY_RELATIONSHIPS.md + relevant domain doc + check if any workflow doc references related tables
- **New business rule found in code?** → Add to relevant domain doc under "Business Rules" + check if it affects workflow docs or other domain docs
- **New API endpoint used?** → Add to relevant domain doc under "API Endpoints" + check if ARCHITECTURE.md needs updating
- **Bug caused by non-obvious behavior?** → Add to relevant domain doc under "Edge Cases & Gotchas" + check if other domains have the same gotcha
- **New integration or service discovered?** → Add integration doc + update ARCHITECTURE.md + TECH_STACK.md + MASTER_INDEX.md
- **Workflow step was wrong or incomplete?** → Fix the workflow doc + check if the domain doc has conflicting info
- **New repo or service created?** → Update REPO_MAP.md + ARCHITECTURE.md + TECH_STACK.md + MASTER_INDEX.md
- **Table schema changed?** → Update FULL_SCHEMA.md + ENTITY_RELATIONSHIPS.md + every domain doc that references those columns + every workflow doc that touches that table
- **Enum values changed?** → Update FULL_SCHEMA.md + every domain doc that references that enum

---

## 6. Quality Standards

### Accuracy
- Every file path cited must be verified against the actual codebase
- Every table/column documented must match the actual database schema
- Every enum value must match the actual TypeScript types
- If you're not sure, say "UNVERIFIED" — never guess

### Formatting
- Use consistent markdown formatting throughout
- Tables for structured data (schemas, enums, field maps)
- Code blocks for file paths, SQL, TypeScript snippets
- Cross-reference other docs with relative links: `[FULL_SCHEMA.md](../02-data-model/FULL_SCHEMA.md)`

### Naming Conventions
- Database tables: `snake_case` (as in PostgreSQL)
- TypeScript types/enums: `PascalCase` (as in source code)
- File paths: exact case as in the repo
- "Contract" and "Agency" are interchangeable in this system
- "Medflyt" = legacy brand, "Task Health" = current product
- Document type prefix `MEDFLYT_*_HTML` = newer HTML pipeline

---

## 7. Key System Concepts to Always Keep in Mind

### The Three Parties
1. **Agencies (LHCSAs)** — Task Health's paying customers
2. **RNs** — Independent contractors managed by Task Health
3. **Patients** — The agency's patients, not Task Health's

### The Core Flow
Agency broadcasts case → Task Health assigns RN → RN visits patient → RN fills forms (with AI) → System generates branded PDFs → Agency downloads documents

### The Task Hierarchy
`patient_task_template` → `patient_task` → `patient_task_instance` → `visit_instance`

### The Document Pipeline
Form builder defines template → RN fills out form on mobile → Answers stored → AI generates invisible questions → Cross-document data flows → Lambda generates branded PDF → SMS delivery

### The Three PDF Pipelines
1. **Pipeline 1 (HTML)**: Nunjucks templates → `html-to-pdf-lambda` (wkhtmltopdf) → S3
2. **Pipeline 2 (Legacy PDF fill)**: `taskhealth_patient_docs_pdf` → pdftk fills templates → S3
3. **Pipeline 3 (MfDocument)**: `taskhealth-serverless/generateMfDocument` → Puppeteer → S3

### Cross-Document Data Flow
`nursingQuestionLinked` field on `PatientDocumentContentItem` → 61 `DatabaseLinkType` values → answers propagate across documents → `blockOnMobile = true` for read-only

---

## 8. What's Still Incomplete (As of Initial Build)

Track completion status here. Update as docs are filled in:

| Doc | Status | Notes |
|-----|--------|-------|
| MASTER_INDEX.md | ✅ Created | Keyword routing table, domain map, repo map, quick reference |
| ARCHITECTURE.md | ✅ Substantial | ~266 lines |
| TECH_STACK.md | ✅ Substantial | ~191 lines |
| REPO_MAP.md | ✅ Created | ~180 lines. 11 active repos, dependency map, tech stack summary |
| FULL_SCHEMA.md | ✅ Substantial | ~600 lines, ~60 core tables across 12 sections. 837-table catalog at bottom |
| ENTITY_RELATIONSHIPS.md | ✅ Substantial | ~350 lines. Full ERD, 9 junction tables, 8 relationship patterns, FK index reference |
| TASK_LIFECYCLE.md | ✅ Substantial | ~692 lines |
| CLINICAL_DOCUMENTS.md | ✅ Substantial | ~1,018 lines (renamed from CLINICAL.md) |
| AI_SYSTEM.md | ✅ Created | ~350 lines. 26 AI questions, review system, POC rules engine, ICD codes, CMS-485 mapping |
| BILLING_AND_CREDITS.md | ✅ Substantial | ~220 lines. Credit flow, invoice chain, billing rates, service/payroll codes, pay rate hierarchy |
| USERS_AND_AUTH.md | ✅ Substantial | ~220 lines. Auth tokens, roles/permissions, caregiver profile, multi-agency, gotchas |
| PATIENTS.md | ✅ Created | ~250 lines. 6 profile tabs, 12 statuses, cert periods, diagnosis codes, schema |
| CONTRACTS_AND_AGENCIES.md | ✅ Created | ~180 lines. Setup fields, billing/rounding, EDI, issue types, template overrides |
| NOTIFICATIONS_AND_COMMS.md | ✅ Created | ~130 lines. SMS, FCM, Socket.IO, telephony agent |
| RN_MOBILE_APP.md | ✅ Created | ~200 lines. 25+ question types, 4 AI features, answer saving, signatures |
| START_OF_CARE_FLOW.md | ✅ Created | ~250 lines. Full 11-step flow, tables touched, decision points, error handling |
| REASSESSMENT_FLOW.md | ✅ Created | ~120 lines. Differences from SOC, recurrence cycle, cert period continuity |
| SUPERVISORY_VISIT_FLOW.md | ✅ Created | ~150 lines. POC↔Supervisory mapping, duty evaluation, code paths |
| NURSE_ONBOARDING_FLOW.md | ✅ Created | ~100 lines. 5-step flow, HR infrastructure, compliance, open areas |
| STRIPE.md | ✅ Created | ~180 lines. 3 Stripe accounts, credit orders, webhooks, charging, code paths |
| SENDGRID.md | ✅ Created | ~80 lines. Email delivery, comm center emails, template rendering |
| GOOGLE_CALENDAR.md | ✅ Created | ~80 lines. Interview scheduling, Zoom integration, free/busy queries |
| WHATSAPP.md | ✅ Created | ~50 lines. Minimal — boolean flag on Twilio SMS infrastructure |

**When you complete a doc, update this table.**

---

## 9. Multi-Session Build Strategy

The knowledge base is too large to build in one session. Follow this priority order:

1. **MASTER_INDEX.md** — The routing table. Without this, the session starter protocol doesn't work.
2. **FULL_SCHEMA.md completion** — The foundation. Clone `taskhealth_server2`, read ALL `sql/migrations/`.
3. **Domain docs** — One at a time. Read actual source code for each.
4. **Workflow docs** — Trace actual code paths end-to-end.
5. **Integration docs** — Search codebase for each service.
6. **Add KB protocol to all repos** — Update CLAUDE.md in every active repo.

**At the start of each build session, clone both repos:**
```bash
git clone git@github.com:Task-Health/task-health-docs.git /tmp/task-health-docs 2>/dev/null || git -C /tmp/task-health-docs pull
git clone git@github.com:Task-Health/taskhealth_server2.git /tmp/taskhealth_server2 --depth=1 2>/dev/null || git -C /tmp/taskhealth_server2 pull
```

Then check Section 8 of this file to see what's incomplete, and pick up from there.
