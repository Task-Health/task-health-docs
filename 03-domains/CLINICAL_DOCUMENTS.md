# Clinical Domain

## Overview

The clinical domain covers everything related to clinical document creation, completion, and delivery in Task Health. The lifecycle is:

1. **Template design** -- An admin builds document templates in the form builder (admin webapp), defining sections, questions, conditional logic, and AI generation hooks.
2. **Task assignment** -- A task template bundles multiple documents together. When a task is created (by the agency or an admin), the bundled documents become the RN's assignment.
3. **Form completion** -- The RN opens each document in the mobile app, answers questions (with AI assistance), captures signatures, and submits.
4. **PDF generation** -- A Lambda function takes the stored answers, merges them with an HTML or PDF template, injects agency branding, and produces a downloadable PDF.
5. **Delivery** -- The PDF is stored in S3, available in the admin panel and agency portal, and optionally sent to the patient and caregiver via SMS.

All clinical documents are versioned. Each document template can have multiple versions, and the PDF footer prints the version number for traceability.

---

## Form Builder

### Document Settings Page

Located at `app.taskshealth.com/app/patient-document-settings`. The page has four tabs:

| Tab | Purpose |
|-----|---------|
| **Documents** | List of all document templates (forms) |
| **Task Templates** | Bundles of documents assigned to task types |
| **Prompts** | AI prompt configurations |
| (4th tab) | Possibly additional settings |

### Documents Tab

Before the document list, a **Plans Of Care** section shows which offices have an active Plan of Care document (e.g., Main Office, RN Platform -- each with a "Done" button).

Controls:

- **"Add Document"** button -- creates a new document template.
- Search field to filter documents.
- Each document row has an **Example** button (preview) and **Delete** button.

### Form Builder Interface

URL pattern: `app.taskshealth.com/app/patient-document-builder/{documentId}`

Layout:

- **Top toolbar** -- Save, preview, document metadata.
- **Main content area** -- Vertical list of questions/fields organized in sections.
- **Section headers** -- Gray bars grouping related questions (e.g., "Patient Information", "Vital Signs").
- **Question rows** -- Blue rows, each representing a single form field.
- **Right-side controls** per row -- Edit (pencil), Delete (trash), Move (drag), and other action icons.
- **Image upload areas** -- For signature fields and other image inputs.
- Questions are built one-by-one and reordered via drag-and-drop.

Key concepts:

- Each document template is a **versioned** collection of questions/sections.
- The form builder creates the **structure** that the RN mobile app renders as a fillable form.
- Form answers are stored in the database and consumed by Lambda to generate branded PDFs.

### Task Templates

Task templates define bundles of documents assigned together when creating a task. Instead of manually picking documents for each task, an admin selects a template that pre-configures everything.

| Column | Description |
|--------|-------------|
| Task Name | Template name (e.g., "Initial assessment") |
| Created At | When template was created |
| Certifications | Required nurse certification (e.g., "RN") |
| Patient Documents | Number of documents bundled |
| Duration (Minutes) | Expected visit duration |
| Priority | 1 (highest) to 5 (lowest) |
| Task Context | Context classification (e.g., "Regular") |
| Task Type | Assessment category: Start of Care / Reassessment / Other |

Complete template list:

| Task Name | Documents | Duration | Priority | Task Type |
|-----------|-----------|----------|----------|-----------|
| Initial assessment | 5 docs | 60 min | 2 | Start of Care |
| Tele-Reassessment | -- | -- | -- | -- |
| Fall Incident | -- | -- | -- | -- |
| Hospitalization | -- | -- | -- | -- |
| In person reassessment | -- | -- | -- | Reassessment |
| Caregiver assessments | -- | -- | -- | -- |
| Interim visit | 5 docs | 60 min | 1 | -- |
| FC-Start of Care | 7 docs | 60 min | 1 | -- |
| General Start of Care | 1 doc | 60 min | 1 | -- |
| General Reassessment | 1 doc | 45 min | 3 | -- |
| FC-reassessment | 5 docs | 60 min | 2 | -- |

Naming patterns:

- **"FC-"** prefix -- Family Care templates.
- **"General"** prefix -- Simplified templates with fewer documents.
- **"Tele-"** prefix -- Telehealth/remote assessment templates.
- **"In person"** -- Requires a physical visit.

### Template-to-Task Connection

There are two task creation flows:

**Agency Portal flow (automatic):** The agency selects a visit type (Start of Care / Reassessment / Supervisory). The system automatically selects the correct template based on the Task Type mapping configured in the admin panel. The agency never manually picks templates or individual documents.

**Admin Panel flow (full control):** The admin selects from a "Select From Task Templates" dropdown. Selecting a template auto-populates the task name, documents, duration, priority, and task type. The admin can override any of these before saving.

Both flows require selecting a **Certification Period** for the patient.

| Aspect | Agency Portal | Admin Panel |
|--------|--------------|-------------|
| Template selection | Automatic (based on visit type) | Manual (dropdown) |
| Document selection | Auto (from template) | Auto + can override |
| Customization | Minimal | Full |
| Who uses it | Agency staff | Task Health internal team |

---

## All Document Types

### Complete Document Template List

| # | Title | Versions | Type (Internal) |
|---|-------|----------|-----------------|
| 1 | CMS485 with AI verifications | 2 | `CMS485` |
| 2 | TEST - Emergency kardex Copy with AI verifications | 2 | `MEDFLYT_EMERGENCY_KARDEX_HTML` |
| 3 | TEST - POC with AI verifications | 2 | `MEDFLYT_PLAN_OF_CARE_HTML` |
| 4 | TEST - Patient Assessment with AI verifications | 2 | `PATIENT_ASSESSMENT_HTML_TEST` |
| 5 | NEW - CARE MANAGEMENT REFERRAL FORM | 2 | `General` |
| 6 | NEW - HOME HEALTH CERTIFICATION AND PLAN OF CARE (CMS-485) | 2 | `CMS485` |
| 7 | Test signature | 1 | `General` |
| 8 | TEST - evo question | 2 | `General` |
| 9 | Consent form - Receiving Electronic Medical Information | 1 | `General` |
| 10 | NEW - HOME HEALTH CERTIFICATION AND PLAN OF CARE (CMS-485) MD ORDER | 4 | `CMS485` |
| 11 | TEST - NEW - CMS-485 | 2 | `CMS485` |
| 12 | NEW - Emergency kardex | 2 | `MEDFLYT_EMERGENCY_KARDEX_HTML` |
| 13 | NEW - Patient Welcome Package | 2 | `MEDFLYT_WELCOME_PACKAGE_HTML` |
| 14 | NEW - Aide Supervisory Form | 2 | `MEDFLYT_PARAPROFESSIONAL_SUPERVISORY_HTML` |
| 15 | TEST - AI POC | 1 | `General` |
| 16 | TEST - validation/questions | 1 | `General` |
| 17 | P1 - SERVICES CONSENT / STATEMENT OF SERVICES AND CHARGES / BILLING... | 1 | `General` |
| 18 | NEW - Patient Assessment | 2 | `MEDFLYT_PATIENT_ASSESSMENT_HTML` |
| 19 | TEST - Intake/Order | 1 | `General` |
| 20 | TEST - evo question | -- | `General` |
| 21 | TEST - PIA | 1 | `MEDFLYT_PIA` |
| 22 | NEW - POC | 2 | `MEDFLYT_PLAN_OF_CARE_HTML` |
| 23 | New PCC file | 1 | `General` |
| 24 | Test POC file | 1 | `General` |
| 25 | P1 - Paraprofessional Supervisory Evaluation/Competency Checklist | 1 | `General` |
| 26 | P1 - Care Management Referral | 1 | `General` |

### Naming Conventions

| Prefix | Meaning |
|--------|---------|
| `NEW -` | Production templates currently in use |
| `TEST -` | Test/development templates (AI verifications, validation testing) |
| `P1 -` | Phase 1 templates (upcoming or alternate versions) |
| `FC -` | Family Care specific templates (seen in Task Templates) |
| (no prefix) | Miscellaneous/utility templates |

### Internal Document Types

| Internal Type | Human Name | Notes |
|--------------|-----------|-------|
| `CMS485` | CMS-485 Form | Federal government form (multiple versions exist) |
| `MEDFLYT_PATIENT_ASSESSMENT_HTML` | Patient Assessment | Main clinical assessment (8 pages) |
| `MEDFLYT_PLAN_OF_CARE_HTML` | Plan of Care (POC) | Care plan checklist (2 pages) |
| `MEDFLYT_EMERGENCY_KARDEX_HTML` | Emergency Kardex | Emergency preparedness doc (2 pages) |
| `MEDFLYT_WELCOME_PACKAGE_HTML` | Welcome Package | Legal/consent package (8 pages) |
| `MEDFLYT_PARAPROFESSIONAL_SUPERVISORY_HTML` | Aide Supervisory Form | Aide evaluation (2 pages) |
| `MEDFLYT_PIA` | PIA | Purpose TBD |
| `PATIENT_ASSESSMENT_HTML_TEST` | Patient Assessment (Test) | Test version with AI verifications |
| `General` | General | Generic/custom form type |

### Document Set per Task Type

For a **Start of Care** task, 6 documents are required (26 total pages):

| # | Document | Pages | Template Type | PDF Footer Version |
|---|----------|-------|---------------|-------------------|
| 1 | Patient Assessment | 8 | `MEDFLYT_PATIENT_ASSESSMENT_HTML` | v10 |
| 2 | Aide Supervisory Form | 2 | `MEDFLYT_PARAPROFESSIONAL_SUPERVISORY_HTML` | v2 |
| 3 | POC (Plan of Care) | 2 | `MEDFLYT_PLAN_OF_CARE_HTML` | v7 |
| 4 | Patient Welcome Package | 8 | `MEDFLYT_WELCOME_PACKAGE_HTML` | v2 |
| 5 | Emergency Kardex | 2 | `MEDFLYT_EMERGENCY_KARDEX_HTML` | v7 |
| 6 | CMS-485 (Home Health Certification) | 4 | `CMS485` | N/A (federal form) |

Other task types likely use subsets (e.g., Reassessment may skip the Welcome Package).

---

## All Question Types (DocumentItemQuestionType)

Every question in a document template has a `DocumentItemQuestionType` that determines how it renders in the mobile app and how it appears in the PDF.

### Form Data Model

Each question is a `PatientDocumentContentItem`:

```
{
  id: number,
  itemType: DocumentItemQuestionType,   // rendering type
  label: string,                         // question text
  columns: PatientDocumentContentItem[][], // nested children
  parentId: number | null,               // conditional visibility parent
  showIfParentEquals: boolean | null,     // show/hide logic
  ifParentEquals: string,                // value to match
  possibleAnswers: string[],             // options for radio/check
  isRequired: boolean,
  prefilledAnswer: string | null,
  htmlTemplateId: string,                // links to AI generation
  blockOnMobile: boolean,                // locked until AI generates
  isNarrative: boolean,                  // enables narrative editor
  isVital: boolean,                      // vital sign with extra details
}
```

### Complete Type Reference (26 types)

| Type | Renders As (Mobile) | Renders As (PDF) |
|------|---------------------|------------------|
| `radio` | Single-select radio buttons | Checkboxes (checked/unchecked Material Icons) |
| `check` | Multi-select checkboxes | Multi-select checkboxes |
| `dropDown` | Dropdown selector | Checkboxes |
| `yesNo` | Yes/No toggle | Checkboxes |
| `bigHeader` | Section header (display only, page break) | `<h3>` with page break |
| `smallHeader` | Sub-section header | `<h4>` |
| `textShort` | Single-line text input | Label + answer text |
| `textLong` | Multi-line textarea (or narrative editor if `isNarrative`) | Label + answer text |
| `number` | Numeric input (vital sign UI if `isVital`) | Label + answer text |
| `employeeSignature` | RN signature pad | Name + Signature image + Date |
| `patientSignature` | Patient signature pad (with unsigned fallback reasons) | Same, with "no signature reason" fallback |
| `customSignature` | Name field + signature pad combo | Name + Signature image + Date |
| `time` | Time picker | Label + answer text |
| `date` | Date picker | Label + answer text |
| `editor` | HTML content (display only) | Raw HTML injection |
| `image` | Image display | `<img>` from base64-fetched URL |
| `bodyDrawing` | Interactive body diagram (mark pain/wounds on 4 anatomy views: front, right, back, left) | 4 anatomy views with pain overlay |
| `chart` | Repeatable row table with sub-questions | HTML `<table>` with headers + data rows |
| `medicationProfile` | Medication list management | Medication table |
| `bloodPressure` | Systolic/diastolic dual input | Two values displayed |
| `icdCodes` | ICD-10 diagnosis code selector | Diagnosis codes |
| `sectionedIcdCodes` | Section-specific ICD codes | ICD codes grouped by section |
| `finalIcdCodes` | Final diagnosis codes | Principal + surgical ICD codes |
| `patientPhysician` | Physician selector | Physician info |
| `POC` | Plan of Care items | POC checklist |
| `RNPlatformPatientPhysician` | Platform-linked physician | Physician info |

---

## Conditional Visibility

Questions can be conditionally shown or hidden based on the answer to a parent question. This is driven by three fields on `PatientDocumentContentItem`:

- **`parentId`** -- The ID of the parent question that controls visibility.
- **`showIfParentEquals`** -- Boolean flag enabling the conditional logic.
- **`ifParentEquals`** -- The specific value the parent answer must match for this question to be visible.

Before rendering any question, the mobile app calls `checkIfParentEqual(parentItemId, currentAnswers)`. If the parent's current answer does not match `ifParentEquals`, the child question is hidden entirely.

This mechanism is used throughout the clinical forms. For example, a "Diabetic Education" section only appears when the Endocrine assessment indicates "Diabetes", and detailed pain characteristics only appear when Pain Status is "Present".

---

## AI Co-Pilot Features

The mobile app provides four distinct AI capabilities for clinical document completion.

### A. Per-Question AI Generation

Questions with an `htmlTemplateId` value can be generated by AI. The system works as follows:

1. The server provides a `questionGenerationAvailabilityMap` via `GET .../generation_map2` that tells the app which questions are ready for generation and which are still locked.
2. Each question may have **lock hints** -- prerequisites that must be completed before generation is available.
3. The `AIGenerationButton` renders as "Generate by AI" with a pulse animation when unlocked, or a lock icon when blocked.
4. On tap: `POST .../template_id/:htmlTemplateId/generate`.
5. The server returns `{ type: "AnswerGenerated", answer }` on success, or `{ type: "Reject", rejections }` on failure.
6. Items with `blockOnMobile: true` are LOCKED -- the RN cannot manually edit them. Two scenarios:
   - **Database-linked questions**: Pre-filled from the patient database (blocked on mobile only).
   - **AI-generated questions**: Blocked on both mobile AND webapp (`blockOnWebapp: true`).
7. AI can generate **groups** of related questions at once via `alsoGenerates` relationships.
8. Models used: **GPT-5.1** (`gpt-5.1-chat-latest`) for most questions, **GPT-4.1** for Plan of Care.

#### All 26 AI-Generated Questions in Patient Assessment v10

**Teaching Provided (14 questions)** -- AI generates short clinical teaching narratives (50 words or fewer):

| htmlTemplateId | Section |
|---------------|---------|
| `fallRiskTeaching` | Fall Risk Assessment |
| `psychologicalTeaching` | Neurological Assessment |
| `mouthThroatSpeechTeaching` | EENT |
| `respiratoryTeaching` | Cardiopulmonary |
| `musculoskeletalTeachingProvided` | Musculoskeletal |
| `painAssessmentTeachingProvided` | Pain Assessment |
| `giAssessmentTeachingProvided` | GI/GU/Reproductive |
| `nutritionalAssessmentTeachingProvided` | Allergies and Nutritional |
| `iheTeachingProvided` | Integumentary/Hematopoietic/Endocrine |
| `medicationsTeachingProvided` | Medications |
| `dmeTeachingProvided` | DME and Supplies |
| `textImmunizationsTeachingProvided` | Immunization Status |
| `emergencyContactsTeachingProvided` | Emergency |
| `environmentSafetyTeachingProvided` | Environment/Safety |

**Section ICD Code Suggestions (8 questions)** -- AI suggests relevant ICD-10 codes per clinical section:

| htmlTemplateId | Section |
|---------------|---------|
| `painIcdCodes` | Pain Assessment |
| `cardiopulmonaryIcdCodes` | Cardiopulmonary |
| `musculoskeletalIcdCodes` | Musculoskeletal |
| `eentIcdCodes` | EENT |
| `giGuReproductiveIcdCodes` | GI/GU/Reproductive |
| `iheIcdCodes` | Integumentary/Hematopoietic/Endocrine |
| `medicalHistoryIcdCodes` | Medical History |
| `neurologicalIcdCodes` | Neurological |

**Final ICD Codes (1 question):** `finalIcdCodes` -- Structured principal + surgical ICD codes. Uses GPT-5.1.

**Post-Submission Progress Note (1 question):** `summaryProgressNote` -- Full clinical progress note (160 words or fewer) generated AFTER the RN submits the assessment. The system first generates subsidiary questions (Functional Limitations, Activities Permitted, Safety Measures, Prognosis, Priority Code, TAL Status), then summarizes all sections into a narrative.

**Plan of Care (2 questions, separate document):** `poc` + `specialInstructions` -- Generated AFTER the Patient Assessment is submitted. Uses GPT-4.1 at temperature 0.

#### Lock Hints / Prerequisites

Two types of prerequisite checks gate AI generation:

- **"QuestionGroup" check**: The RN must answer specific prerequisite questions before AI can generate. For example, Fall Risk Teaching requires: DOB, history of falls, musculoskeletal assessment, vision, GI/GU, mood, orientation, DME, environment safety, and ICD codes.
- **"Document" check**: An entire document must be submitted first. For example, POC generation requires the Patient Assessment to be submitted.

### B. Speech-to-Text for Narratives

`textLong` questions with `isNarrative: true` open a dedicated `RNNarrativeScreen` that provides:

- **Guiding Questions** displayed above the text area to help the RN structure their narrative.
- A **RecordingMicrophone** button that uses `@capgo/capacitor-speech-recognition` (native plugin).
- Handles partial results, merges recognized text, and supports both iOS (streaming mode) and Android (single-result mode).

### C. Live Translation via OpenAI Realtime API

Real-time voice translation for communicating with non-English-speaking patients:

- Uses **OpenAI Realtime API via WebRTC** for bidirectional audio streaming.
- Flow: Get ephemeral key from backend, establish `RTCPeerConnection`, open data channel `"oai-events"`, negotiate SDP with `api.openai.com/v1/realtime/calls?model=gpt-realtime`.
- The RN selects a target language, opens `LiveTranslationModal`, and the system translates patient speech in real-time.

### D. Copy From Last Time

- `CopyFromLastTimeButton` fetches answers from the previous version of the same document type.
- All answers are bulk-inserted into the current form, saving significant time on recurring assessments (e.g., Reassessments where much of the patient data has not changed).

---

## Answer Saving

Answers are saved **in real-time on every keystroke/interaction**:

1. RN taps a radio button, checks a box, or types text.
2. `handleOnInsertAnswer(id, value)` fires -- updates local state and calls the API.
3. `POST /caregivers/:id/visit_instances/:id/patient_documents/:documentTypeId/answer`
4. A "Document Saved" toast appears.
5. The Submit button is disabled while answers are in flight (re-enables 250ms after the last answer resolves).

This per-keystroke approach means no work is lost even if the app crashes or the RN loses connectivity mid-form.

---

## Submission and Validation

### Validation Pass

Before submission, the app runs a validation pass that checks:

- All required fields are filled.
- No unresolved AI rejections remain.
- Medication profiles, ICD codes, and vital signs are valid.
- If validation fails: red borders + shake animation + a dialog listing all missing fields.

### Submit

`POST /caregivers/:id/visit_instances/:id/patient_documents/:documentTypeId`

The payload includes `submissionDate` and an optional `regenerateNursingQuestionsOtherDocuments` flag (which triggers AI generation of dependent documents like the POC).

### Resubmission Flow

Documents can be rejected (by AI review or human QA) with per-question rejections:

1. `QuestionRejectionHeader` banners appear above each rejected question.
2. The RN resolves or declines each rejection.
3. The RN resubmits the document.

---

## Signature Capture

- Uses `react-signature-canvas` rendered in a modal.
- The signature is stored as a base64 data URL.
- Two signature types exist: `employeeSignature` (RN) and `patientSignature` (patient).
- `customSignature` combines a name text field with a signature pad.

### Unsigned Fallback

When a patient cannot or will not sign, `patientSignature` provides fallback reasons:

- Patient unable to sign
- Patient refused to sign
- Verbal consent given
- Other

The selected reason is stored in place of the signature and rendered on the PDF.

---

## Three PDF Generation Pipelines

Task Health has three distinct PDF generation systems. All three are invoked from `DocumentGenerator.ts` in the `taskhealth_server2` backend.

### Pipeline 1: Newer HTML Patient Documents (Puppeteer)

**Used for:** Patient Assessment, POC, Emergency Kardex, Aide Supervisory, Welcome Package (all `MEDFLYT_*_HTML` types).

**Technology:** Server-side HTML rendering + `html-pdf` (wkhtmltopdf via PhantomJS).

**Flow:**

1. Lambda receives event with `form.docData` containing:
   - `content` array -- form builder structure (sections, questions).
   - `answers` array -- `{ questionId, answer, chartRow }` objects.
   - `generalData` -- agency info, caregiver info, patient info.
2. `formatLabels()` replaces template variables in all text (see Template Variable Replacement below).
3. Agency logo fetched as base64 from S3.
4. `patientDocHtml.js` builds HTML by iterating the `content` array.
5. Each `itemType` renders as specific HTML:

| itemType | Renders As |
|----------|-----------|
| `bigHeader` | `<h3>` with page break |
| `smallHeader` | `<h4>` |
| `textShort`, `textLong`, `number`, `time`, `date` | Label + answer text |
| `radio`, `dropDown`, `yesNo` | Checkboxes (checked/unchecked Material Icons) |
| `check` | Multi-select checkboxes |
| `editor` | Raw HTML injection |
| `chart` | HTML `<table>` with headers + data rows |
| `employeeSignature` | Name + Signature image + Date |
| `patientSignature` | Same, with "no signature reason" fallback |
| `image` | `<img>` from base64-fetched URL |
| `bodyDrawing` | 4 anatomy views (front/right/back/left) with pain overlay |

6. HTML rendered to PDF via `html-pdf` (wkhtmltopdf).
7. PDF uploaded to S3.

### Pipeline 2: Legacy PDF Form Fill (pdftk -- Government Forms)

**Used for:** CMS-485, OCA-960, CMS-1500, UB-04, Welcome Package (legacy).

**Technology:** `pdffiller` (uses pdftk binary).

**Flow:**

1. `answerUtils.buildAnswersMap()` maps form answers to question IDs.
2. Form-specific module (e.g., `cms485.js`) maps answers to PDF field names.
3. PDF template downloaded from S3 (`PDFS_TEMPLATE_BUCKET`).
4. `pdffiller` fills PDF form fields via the pdftk binary.
5. `pdfStamp.js` overlays signature images at specific pixel coordinates.
6. Filled PDF uploaded to S3.

**Pre-made PDF templates in repo (`pdfs/files/`):**
- `CMS-485-addendum.pdf`
- `UB04.pdf`
- `authorized_rep_form.pdf`
- `cms1500.pdf`
- `oca960.pdf`
- `private-pay-agreement.pdf`
- `supplement-form.pdf`
- `welcome-package.pdf`

### Pipeline 3: MfDocument (Internal/Admin Documents)

**Used for:** Caregiver profiles, patient profiles, HR forms, invoices, paystubs, duty sheets, compliance forms, training certificates, reference documents.

**Technology:** Puppeteer + custom DSL (`buildDocument.ts`).

**MfDocument DSL capabilities:**
- Headers with agency logos, titles, subtitles.
- Key-value pairs, tables, checkboxes, radio buttons.
- Signatures (image or text), images, dividers, page breaks.
- Rows, columns, boxes for layout.
- Text formatting (SSN, currency, phone, dates).
- Branded footer: "Powered by Medflyt/Task Health".

**Upstream Lambdas that build MfDocuments:**

| Lambda | Document Type |
|--------|---------------|
| `generateCaregiverProfile` | Caregiver profile PDF |
| `generatePatientProfile` | Patient profile PDF |
| `generateFullProfile` | Multi-page caregiver profile + HR docs + attachments |
| `generateDutySheet` / `generatePatientDutySheet` | Duty sheets |
| `generateInvoicePaper` | Billing invoices |
| `generateHrDocument` | HR forms (W4, I-9, pay agreements -- 25+ question types) |
| `generateTrainingCenterCertificate` | Training completion certificates |
| `generateCaregiverNotes` / `generatePatientNotes` | Notes documents |

**Server-side callers (in `taskhealth_server2`):**
- `DocumentGenerator.ts` -- main orchestrator.
- `compliance_forms_controller.ts` -- compliance documents (annual health, TB screening, flu declination).
- `PatientSurplusCtrl.ts` -- surplus/billing invoices.
- `instaPayController.ts` -- paystubs and pay receipts.
- `CommunicationCenterMessageActionController.ts` -- docs triggered by comm center actions.
- `caregiverReferenceGenerate.ts` -- reference check documents.

### Routing Logic in DocumentGenerator.ts

`DocumentGenerator.ts` is the main orchestrator in the `taskhealth_server2` backend. It routes document generation to the correct pipeline:

| Document Type Pattern | Pipeline |
|----------------------|----------|
| `MEDFLYT_PATIENT_ASSESSMENT_HTML`, `MEDFLYT_PLAN_OF_CARE_HTML`, `MEDFLYT_EMERGENCY_KARDEX_HTML`, `MEDFLYT_WELCOME_PACKAGE_HTML`, `MEDFLYT_PARAPROFESSIONAL_SUPERVISORY_HTML` | Pipeline 1 (newer HTML) |
| `CMS485`, `UB04`, `CMS1500`, `OCA960`, legacy forms | Pipeline 2 (`patient-document-pdf-generator`) |
| HR docs (new format), profiles, invoices, compliance | Pipeline 3 (`generateMfDocument`) |

Migration note: HR documents have been migrated from Pipeline 2 to Pipeline 3. One legacy agency (ID 4423) still uses the old path.

### Lambda Entry Point (Pipeline 2)

File: `server.js`, function: `exports.start(event, context, callback)`.

Routing logic:

| Event Shape | Handler | Documents |
|-------------|---------|-----------|
| `event.form.docData` | `patientDocHtml.js` | Generic patient documents |
| `event.form.pocData` | `pocDocHtml.js` | Plan of Care |
| `event.form.certificateData` | `certificateOfCompletionHtml.js` | Training certificates |
| `event.form.testData` | `orientationTest.js` | Orientation tests |
| `event.messageKind === 'TS837I'` | `ub04.js` | Institutional billing (UB-04) |
| `event.messageKind === 'TS837P'` | `cms1500.js` | Professional billing (CMS-1500) |

---

## Agency Branding Injection

Every PDF document includes agency branding. The branding is injected differently depending on the pipeline.

### Pipeline 1 (HTML Patient Docs)

The HTML header template:

```html
<div id="pageHeader">
  <img src="${agency.logoBase64}" />
  <span class="agency-name-top">${agency.name}</span>
  <span class="agency-address-top">${agency.address}</span>
</div>
```

Agency data passed in the Lambda event:

```json
{
  "agency": {
    "id": 55,
    "name": "Platinum Home Health Care",
    "address": "170 53rd St, Brooklyn, NY 11232, USA",
    "logoUrl": "https://medflyt-assets.s3.amazonaws.com/agency_logos/agency-55-logo.png",
    "officePhone": "7185502775"
  }
}
```

Agency-specific overrides exist in code, hardcoded per agency ID.

### PDF Footer (All Pipelines)

Every PDF includes a standard footer:

> Powered by Task Health. All rights reserved, Task Health, 2026. 2329 Nostrand Avenue, Brooklyn, NY, USA. support@task-health.com / (718) 550-2775, version: X

The version number in the footer tracks the template version.

### Pipeline 3 (MfDocument)

Uses a branded footer: "Powered by Medflyt/Task Health" with agency logo and header rendered via the MfDocument DSL.

---

## Template Variable Replacement

Pipeline 1 uses `formatLabels()` to replace template variables in all text content before rendering:

| Variable | Replaced With |
|----------|--------------|
| `{agency_name}` | Actual agency name |
| `{patient_name}` | Patient name |
| `{caregiver_name}` | Clinician name |
| `{agency_address}` | Agency address |
| `{agency_phone}` | Agency phone number |
| `{certification_type}` | Certification type |

These variables can be used in section headers, question labels, and static text blocks within document templates. This allows a single template to produce correctly branded documents for any agency.

---

## Complete Document Field Maps

### Patient Assessment (8 pages, version 10)

The Patient Assessment is the most comprehensive document. Every section and field is listed below.

#### Page 1

**Header:** Agency name + address + logo | "Patient Assessment Form" title.

**Patient Information:**
- Patient Name | DOB
- Gender | Clinician Name
- Address
- Phone # | Alt. Phone #
- Primary Language | Language Barrier (Yes/No)
- Living Arrangement: Lives Alone / With Spouse / Lives with family / Lives with Friend/Significant Other

**Visit Information:**
- Date of Visit | Time In (datetime) | Time Out (datetime)
- Type of Assessment: Initial / Reassessment (checkbox)
- Priority Code: Level 1 (High - requires immediate attention) / Level 2 (Moderate - needs scheduled care) / Level 3 (Low - stable, preventive care)
- TAL Status: TAL-1 Non-ambulatory stretcher / TAL-1 Non-ambulatory vent / TAL-1 Non-ambulatory bariatric / TAL-2 Wheelchair / TAL-3 Ambulatory
- RN Narrative/Notes (free text)

**Vital Signs:**
- Temperature: value (F) | Method: Oral / Axillary / Temporal / Rectal
- Blood Pressure: value mmHg | Arm: Right Arm / Left Arm
- Pulse: value bpm | Regular / Irregular
- Respirations: value bpm | Regular / Irregular / Shallow / Labored
- Blood Glucose: value mg/dL (if applicable)
- RN Narrative/Notes

**Fall Risk Assessment:**
- Risk Factors (checkboxes): Age 65+, History of falls in past 3 months, 3+ medical diagnoses, Taking 4+ medications, Impaired balance/gait, Visual impairment, Cognitive impairment, Urinary frequency/incontinence, Use of assistive device, Environmental hazards present
- Total Score (number)
- Risk Level: Low (0-3) / Moderate (4-6) / High (7+)
- RN Narrative/Notes

#### Page 2

**Neurological Assessment:**
- Mental Status (checkboxes): Oriented, Comatose, Forgetful, Depressed, Disoriented, Agitated, Lethargic, Alert
- Additional Neurological: WNL, Seizures, Tremors, Paralysis, Headache, Ataxia, Dizziness, Other (with text field)
- Psychological: WNL, Depression, Anxiety, Fear, Suicidal Thoughts, Hallucinations, Delusions, Poor Insight/Judgment, Memory Loss, History of previous psych illness, Other
- Teaching Provided (free text)
- RN Narrative/Notes

#### Page 3

**EENT (Eyes, Ears, Nose, Throat):**
- Head/Face: WNL, Drainage, Alopecia, Epistaxis, Congestion, Facial Twitching, Sinus Abnormality, Other
- Eyes/Vision: WNL, Visual Impairment, Legally Blind, Glasses, Contact Lenses, Glaucoma, Cataracts, Discharge, Other
- Ears/Hearing: WNL, Hearing Loss, Hearing Aid, Deaf, Tinnitus, Discharge, Other
- Mouth/Throat/Speech: WNL, Bleeding Gums, Dysphagia, Gingivitis, Speech Impairment, Dentures, Missing Teeth, Hoarseness, Sore Throat, Ageusia, Anosmia, Other
- Teaching Provided, RN Narrative/Notes

**Cardiopulmonary Assessment:**
- Cardiovascular: WNL, Chest Pain, Palpitations, Pacemaker, Fatigues Easily, Edema, Murmur, Clubbing, Cyanosis, Syncope, Activity Intolerance, Other
- Respiratory: WNL, SOB at rest, Orthopnea, PND, Cough, Sputum, Tracheostomy, Ventilator, BIPAP, CPAP, Other
- Lung Sounds: Clear, Rales, Wheezing, Rhonchi, Diminished, Absent, Other
- Teaching Provided, RN Narrative/Notes

**Musculoskeletal Assessment:**
- Assessment: WNL, Weakness, Gait Abnormality, Amputation, Numbness, Stiffness, Deformities, Coordination Problems, Limited ROM, Other
- Teaching Provided, RN Narrative/Notes

**Pain Assessment:**
- Pain Status: Not Present / Present
- Pain Intensity (0-10)
- Characteristics: Burning, Aching, Throbbing, Sharp, Crushing, Radiating, Other
- Location and Duration
- Pain Management: Relief Methods, Effective (Yes/No), Pain Intensity after intervention (0-10)
- Non-Verbal Pain Assessment: None Reported/Observed, Facial Grimaces, Restlessness, Guarding, Rigidity, Moaning, Crying
- Teaching Provided, RN Narrative/Notes

#### Page 4

**GI/GU/Reproductive Assessment:**
- Gastrointestinal: WNL, Hernia, Nausea/Vomiting, Ulcers, Incontinence, Rectal Bleeding, Hemorrhoids, Diarrhea, Indigestion, Tenderness, Pain, Constipation, Other, Ostomy (type and location)
- Genitourinary: WNL, Incontinence, Frequency, Urgency, Burning, Hesitancy, Oliguria, Dysuria, Polyuria, Anuria, Hematuria, Nocturia, Dialysis, Retention, Other, Urinary Catheter (type and location)
- Reproductive: MALE (No Problems, Prostatectomy, Scrotal Edema, Prostate Disorder, Other) / FEMALE (No Problems, Hysterectomy, Mastectomy, Discharge/Bleeding, Breast Abnormalities, Other)
- Teaching Provided, RN Narrative/Notes

**Nutritional Assessment:**
- Appetite: Good / Fair / Poor / Excessive
- Weight and Fluids: Weight (lbs), Stable/Loss/Gain, Fluid Restriction (No/Yes with detail)
- Food Intake: Independent, Needs Assistance, Dependent, Tube Feeding, NPO, Other
- Nutritional Requirements: Regular/No Restrictions, Cardiac, Pureed, Low Sodium, Low Fat, Low Cholesterol, Low Sugar, No Concentrated Sweets, High Fiber, Soft, Renal, 1800 Cal ADA, Other
- Teaching Provided, RN Narrative/Notes

#### Page 5

**Allergies:**
- Medication Allergies (free text)
- Food Allergies (free text)
- Substance/Environmental Allergies (free text)

**Integumentary/Hematopoietic/Endocrine:**
- Integumentary: WNL, Dry, Rash, Pallor, Fistula, Wound, Pressure areas, Incisions, Poor Turgor, Scars, Bruises, Pruritus, Lesions, Other
- Hematopoietic: WNL, Anemia, Excessive Bleeding or Bruising, Intolerance to Heat and Cold, Clotting Disorder, Other
- Endocrine: No Problems, Diabetes, Hypothyroidism, Hyperthyroidism, Other
- Diabetic Education (if needed): Importance of blood glucose monitoring, Sharps safety, Signs of hypo/hyperglycemia, Importance of medication regimen, Notify MD if glucose <55 or >240
- Skin Properties: Color (WNL / Pale / Cyanotic / Jaundice)
- Edema (free text)
- Wound Assessment (free text)
- Teaching Provided, RN Narrative/Notes

**Medication Profile (table):**

| Column | Example |
|--------|---------|
| Medication Name | Losartan (Oral Pill) |
| Dosage | 25 mg Tab |
| Frequency | Once daily |
| Notes | Route confirmed as oral |

- Teaching Provided, RN Narrative/Notes

**Diagnosis Information (table):**

| Type | Diagnosis | ICD Code |
|------|-----------|----------|
| Primary | Alzheimer's disease, unspecified | G30.9 |
| Other Pertinent | Unspecified abnormalities of gait and mobility | R26.9 |
| Other Pertinent | Depression, unspecified | F32.A |

#### Page 6

**DME and Supplies (checkboxes):** None, Cane, Quad cane, Walker, Wheelchair, Hospital Bed, Bedside Commode, Shower Chair, Grab Bars, Hand Rails, Shower Rails, Hoyer Lift, Bed Rails, Adjustable Bed, Trapeze Bar, Sleeps In Recliner, Oxygen, BiPAP, CPAP, Tracheostomy, Ventilator, Glucometer/Strips, Wound Care Supplies, Incontinence Supplies, Other.
- Teaching Provided, RN Narrative/Notes

**Functional Limitations (checkboxes):** None, Amputation, Bowel/Bladder (Incontinence), Contracture, Hearing, Paralysis, Endurance, Ambulation, Speech, Legally Blind, Dyspnea With Minimal Exertion, Other.

**Environment/Safety Assessment (checkboxes):** None, House/Apartment structure inadequate, Inadequate heating/cooling, Inadequate plumbing/water, Inadequate electricity, Non-functioning smoke detectors, No carbon monoxide detector, Telephone not accessible, Stairs without handrails, No bathroom grab bars, Inadequate lighting, Obstructed pathways, Throw rugs unsecured, Electrical cords unsafely placed, No emergency exit plan, Medications not safely stored, Other.
- Teaching Provided, RN Narrative/Notes

**Emergency Contacts (table):**

| Contact Type | Name | Address | Phone | Fax |
|-------------|------|---------|-------|-----|
| Local Emergency Contact | (name) | (address) | (phone) | |
| Primary Physician | (name, NPI) | (address) | (phone) | (fax) |

**Emergency Plan Discussed:** Yes/No

**Emergency Preparedness (checkboxes):** Medication list current and accessible, 7-day supply of medications available, Medical equipment backup/alternative plan, Emergency phone numbers posted, Evacuation plan established, Medical alert device if needed.

**Advance Directives:** None / Healthcare Proxy / DNR / Other.

#### Page 7

**Safety Measures:** Free text (e.g., "Fall Precautions, Medication Safety, Skin/Pressure Prevention, Cognitive Impairment/Wandering Precautions, DME/Transfer Safety").

**Activities Permitted (checkboxes):** No Restrictions, Complete Bedrest, Bedrest BRP, Up As Tolerated, Transfer Bed/Chair, Independent At Home, Partial Weight Bearing, Exercises Prescribed, Crutches, Cane, Wheelchair, Walker, Other.

**Immunization Status (checkboxes with dates):** None, Influenza, Pneumonia, COVID-19 (with date), Tetanus, Hepatitis B, Other, Refused.
- Teaching Provided, RN Narrative/Notes

#### Page 8

**Summary:**
- Prognosis: Poor / Guarded / Fair / Good / Excellent
- RN Visit Frequency (e.g., "One visit every 180 days")
- Services Needed: HHA / PCA / Other
- Orders for Discipline and Treatments (long free text with clinical orders)
- Service Frequency (e.g., "7 days 4 hours")
- Goals of Care (long free text with clinical goals)
- Aide POC completed, copy left in home and copy submitted to agency: Yes/No
- Plan of Care Discussed: Yes/No
- Patient/Caregiver verbalized understanding of all teaching: Yes/No
- **Progress Note** (long narrative free text summarizing the entire visit)

**Signatures:**
- Patient/Representative Signature (digital) | Patient/Representative Name | Date
- RN Signature (digital) | RN Name | Date

---

### CMS-485 (4 pages)

Federal government form: Department of Health and Human Services, Centers for Medicare and Medicaid Services. Form CMS-485 (C-3) (12-14). OMB No. 0938-0357.

#### Page 1: CMS-485 Main Form (28 numbered fields)

1. Patient's HI Claim No.
2. Start Of Care Date
3. Certification Period (From / To)
4. Medical Record No.
5. Provider No.
6. Patient's Name and Address
7. Provider's Name, Address and Telephone Number
8. Date of Birth
9. Sex (M/F checkboxes)
10. Medications: Dose/Frequency/Route (New/Changed)
11. ICD Principal Diagnosis (code + description + date)
12. ICD Surgical Procedure (code + date)
13. ICD Other Pertinent Diagnoses (codes + descriptions + dates)
14. DME and Supplies
15. Safety Measures
16. Nutritional Req. (e.g., "Cardiac, Low Sodium, Low Cholesterol")
17. Allergies
18A. Functional Limitations (numbered 1-9, A-B checkboxes)
18B. Activities Permitted (numbered 1-9, A-D checkboxes)
19. Mental Status (numbered 1-8 checkboxes: Oriented, Comatose, Forgetful, Depressed, Disoriented, Lethargic, Agitated, Other: Alert)
20. Prognosis (numbered 1-5: Poor, Guarded, Fair, Good, Excellent)
21. Orders for Discipline and Treatments (Specify Amount/Frequency/Duration)
22. Goals/Rehabilitation Potential/Discharge Plans
23. Nurse's Signature and Date of Verbal SOC Where Applicable
24. Physician's Name and Address
25. Date of HHA Received Signed POT
26. Certification statement (physician certifies patient is confined to home and needs care)
27. Attending Physician's Signature and Date Signed
28. Penalty warning (misrepresentation = fine, imprisonment, or civil penalty)

#### Pages 2-3: Addendum to Home Care (DOH-3725, Rev. 12/05)

New York State Department of Health form.

- Addendum type: Plan of Treatment (checkbox) or Medical Update (checkbox)
- References CMS-485 item numbers and expands on them:
  - Item 13: Additional diagnosis codes
  - Item 15: Safety measures detail
  - Item 17: Allergies detail
  - Item 21: Full orders for discipline and treatments, including service type and aide frequency
  - Item 22: Full goals of care text + discharge planning
- Signature of Physician (field 9) + Date (field 10)
- Optional Name/Signature of Nurse/Therapist (field 11) + Date (field 12)

#### Page 4: Privacy Act Statement + Paperwork Burden Statement

---

### Plan of Care / POC (2 pages)

Header shows: Patient Name, Gender, Certification Period, Patient Address, DOB, Call Agency 24/7 phone number.

**Task/Activity Frequency Grid:**

| Category | Tasks |
|----------|-------|
| **Personal Care** | Bath Shower, Bath Bed, Hair Care - Shampoo, Hair Care - Comb/Brush, Mouth Care, Oral Hygiene - Denture Care, Grooming-Shave, Grooming-Nails (file only), Dressing, Skin Care, Foot Care |
| **Toileting** | Incontinence Supplies, Bedpan/Urinal, Toilet, Commode, Incontinence |
| **Nutrition** | Prepare meals - Breakfast, Prepare meals - Lunch, Prepare meals - Dinner, Prepare meals - Snack, Assist with Feeding, Record intake - Food, Patient is on a prescribed diet, Record Intake - Fluid |
| **Activities** | Transferring, Assist with walking, Patient walks with assistive devices, Assist with home exercise program (HHA Only), Turning and positioning (At least Q2) |
| **Treatment** | Empty foley bag, Remind to take medication, Ask Patient About Pain, Observe/Report Physical/Mental Changes, Monitor Patient Safety, Ostomy/Catheter Care |
| **Household** | Change Bed Linen, Patient Laundry, Light Housekeeping (Dust, Vacuum, Clean), Shopping and Errands, Accompany Patient to medical appointment |

Each task has a frequency column (e.g., "Every visit", "As needed").

**Emergency Reporting Guidelines:**
- Call 911 for emergency: severe bleeding, chest pain, shortness of breath, loss of consciousness
- Bleeding, Blood Sugar Problem, Heart/Lung Problems, Infection, Abdominal Problems, Circulatory Problems, Safety guidelines

**General Patient Information:**
- Services Needed (e.g., PCA)
- Aide Frequency (e.g., "7 days 4 hours")
- Mental Status
- Allergies
- Safety Measures
- Activities Permitted
- Nutritional Requirements
- Devices used

**Signatures:** RN Signature + RN Name + Date.

---

### Welcome Package (8 pages)

Agency-branded legal/consent document.

**Page 1: Cover page**
- Clinician Name, Patient Name, Gender, DOB, Mobile Phone, Home Phone, Address
- List of included documents (7 items)
- Instruction: "You will be presented with these documents and asked to sign them as an acknowledgment."

**Page 2: Services Consent / Statement of Services and Charges**
- 8 authorization checkboxes (consent to services, release of information, HIPAA, licensing, emergency procedures, rights acknowledgment, non-solicitation)
- Current Payer Source: Managed Long-Term Care / Certified Home Health Agency / Private / Other
- Service/Cost table:

| Service | Frequency | Cost | Patient's Financial Responsibility |
|---------|-----------|------|-----------------------------------|
| PCA | 7 days 4 hours | $35/hour | $0 |
| RN Initial | 1 visit | $125/visit | $0 |
| RN Visit | Every 6 months and as needed | $100/visit | $0 |

- Managed care notice about prior approval
- Financial responsibility agreement

**Page 3: Patient Bill of Rights** -- 21 enumerated rights.

**Page 3 (continued): Patient Responsibility** -- 10 enumerated responsibilities.

**Page 4: HIPAA Consent** -- Privacy practices consent text.

**Page 4 (continued): EVV Orientation Document for Patients**
- What is EVV, What Information is Reported, Privacy, Why EVV, How Caregivers Use EVV, Your Role
- EVV = Electronic Visit Verification, mandated by New York Medicaid

**Page 5: Client Complaint/Grievance Procedure**
- Agency contact info for complaints
- After-hours procedure
- Complaint routing (Professional staff to Director, Paraprofessional to Staffing Coordinator, Payroll/Billing to Business office, HIPAA to Privacy Officer)
- 15 business day response time
- Appeal to Governing Authority within 30 days
- NYS Health Department contact: Metropolitan Area Regional Office, 90 Church Street, New York, NY 10007, 800-628-5972

**Page 5 (continued): Acknowledgment of Welcome Package access**
- States documents are accessible via SMS link
- Lists all available documents
- Patient Acknowledgment text
- Signatures: Patient + RN (both with name and date)

**Page 6: Notice of Privacy Practices** -- Legal duty, uses/disclosures, patient rights, complaints.

**Page 6 (continued): Information Regarding Palliative Care and Counseling Services**
- What is Palliative Care, When appropriate, Services available, Counseling Services, How to access

**Page 7: Information Regarding Advanced Directives**
- Living Will, Health Care Proxy, DNR Order, MOLST
- Patient rights under NYS law
- How to create advanced directives
- Important notes

**Page 8: Patient Sign-Off Checklist**
- "I HAVE BEEN PROVIDED WITH:" -- 10 items checked
- Final Signatures: Patient + RN

---

### Aide Supervisory Form (2 pages)

**Header:** Patient Name, DOB, Gender, Caregiver Name, Supervisor Name, Visit Date, "Is aide present?" (Yes/No checkbox).

**Supervisory Tasks (~40 tasks, each rated: Meets / Needs Improvement / N/A):**

| Column 1 | Column 2 |
|----------|----------|
| Assists with bathing (incl. bedbound) | Assists with hair washing |
| Assists with hair grooming | Provides oral care |
| Assists with denture care | Assists with shaving |
| Assists with nail care (filing only) | Assists with dressing/undressing |
| Provides general skin care | Provides foot care |
| Manages incontinence supplies | Assists with bedpan/urinal |
| Assists with toileting | Assists with commode use |
| Provides incontinence care | Prepares meals as assigned |
| Assists with feeding | Documents food intake accurately |
| Follows prescribed diet requirements | Documents fluid intake accurately |
| Performs transfers using proper body mechanics | Assists with ambulation safely |
| Uses assistive devices correctly | Assists with prescribed exercises |
| Performs repositioning per schedule | Empties/measures foley output correctly |
| Provides medication reminders | Assesses and reports pain levels |
| Observes and reports condition changes | Maintains safe environment |
| Provides ostomy/catheter care properly | Changes linens properly |
| Performs patient laundry | Performs light housekeeping |
| Completes shopping/errands | Accompanies patient to appointments |

**Competency Evaluation (~20 competencies, each rated: Meets / Needs Improvement / N/A):**

| Column 1 | Column 2 |
|----------|----------|
| Demonstrates proper hand hygiene | Uses Standard Precautions |
| Maintains safe hazard-free environment | Ensures client safety during ADLs |
| Reports changes in client condition | Follows written Plan of Care |
| Completes required documentation | Respects client's rights privacy dignity |
| Maintains confidentiality (HIPAA) | Demonstrates proper body mechanics |
| Wears ID badge and follows dress code | Conducts self professionally |
| Develops rapport with client/family | Explains procedures to client |
| Demonstrates punctuality/dependability | |

**Supervisory Visit Observations:** Free text narrative.

**Additional Supervisor Comments:** Free text.

**Signatures:**
- Supervisor Signature + Name and Title (e.g., "Shauntina Williams, Registered Nurse") + Date
- Caregiver Signature + Caregiver Name + Date

---

### Emergency Kardex (2 pages)

**Page 1:**
- Header: Clinician Name, Patient Name, Gender, DOB, Mobile Phone Number, Home Phone Number, Address
- Emergency evacuation warning: "If you are evacuated, this form MUST be brought to the shelter"
- Priority Level definitions:
  - LEVEL 1 - High Priority: Uninterrupted services needed, highly unstable, requires life sustaining equipment
  - LEVEL 2 - Moderate Priority: Can be postponed with telephone contact, somewhat unstable
  - LEVEL 3 - Low Priority: Stable, can safely miss a visit with family/informal support
- Priority Code: Level 1 / Level 2 / Level 3 checkboxes
- TAL Status: TAL-1 Non-ambulatory stretcher / TAL-1 Non-ambulatory vent / TAL-1 Non-ambulatory bariatric / TAL-2 Wheelchair / TAL-3 Ambulatory
- Contact Information table: Contact Type, Name, Address, Phone, Fax
- Advance Directives: None / Healthcare Proxy / DNR / Other
- Nutritional Requirements: Same checkbox grid as Patient Assessment
- Allergies: Medication, Food, Substance/Environmental

**Page 2:**
- DME and Supplies: Same checkbox grid as Patient Assessment
- "Please bring the following items to the shelter" list:
  - 7-10 days' supply of medication/medical supplies/special equipment
  - Special dietary foods
  - Blankets or sleeping bags
  - Flashlights and batteries
  - Portable radio and batteries
  - Extra Clothing
  - Lightweight folding chairs and cots
  - Personal care items
  - Important papers, including identification
  - Home chart (including physician orders)
- Advanced Directives Acknowledgement: "I acknowledge that I have received the Advanced Directives Packet..."
- RN Signature + RN Name + Date
