# RN Mobile App

> React + Capacitor architecture, 25+ question types, conditional visibility, real-time saving, 4 AI features, signatures, resubmission flow.

---

## 1. Overview

The RN Mobile App (`taskhealth-mobile2`) is a hybrid native app that RNs use to fill out clinical assessment forms during patient visits. It runs on iOS and Android via Capacitor.

**Tech stack:**
- React 17 + Capacitor 7 (hybrid native, v4.20.19)
- App ID: `com.taskshealth.app`
- Build: Vite 5 + TypeScript 5.9
- State: Jotai + TanStack React Query 4 + Immutable.js
- UI: Emotion (CSS-in-JS) + OnsenUI + Framer Motion
- Forms: react-hook-form + Zod
- Maps: Mapbox GL + MapLibre GL
- Native: Capacitor plugins (camera, geolocation, push notifications, speech recognition)
- Signatures: react-signature-canvas
- AI: OpenAI Realtime API (WebRTC), server-side AI generation
- Monitoring: Sentry + LogRocket
- Networking: Axios + socket.io-client

---

## 2. Form Data Model

Every document form is a tree of `PatientDocumentContentItem` objects:

```typescript
{
  id: number,
  itemType: DocumentItemQuestionType,   // rendering type
  label: string,                         // question text
  columns: PatientDocumentContentItem[][], // nested children
  parentId: number | null,               // conditional visibility parent
  showIfParentEquals: boolean | null,    // show/hide logic
  ifParentEquals: string,                // value to match
  possibleAnswers: string[],             // options for radio/check
  isRequired: boolean,
  prefilledAnswer: string | null,
  htmlTemplateId: string,                // links to AI generation
  blockOnMobile: boolean,                // locked until AI generates
  isNarrative: boolean,                  // enables narrative editor
  isVital: boolean,                      // vital sign with extra details
  nursingQuestionLinked: number | null,  // cross-document data link
}
```

---

## 3. All Question Types (25+)

| Type | Renders As |
|------|-----------|
| `radio` | Single-select radio buttons |
| `check` | Multi-select checkboxes |
| `dropDown` | Dropdown selector |
| `yesNo` | Yes/No toggle |
| `bigHeader` | Section header (display only, page break) |
| `smallHeader` | Sub-section header |
| `textShort` | Single-line text input |
| `textLong` | Multi-line textarea (or narrative editor if `isNarrative`) |
| `number` | Numeric input (vital sign if `isVital`) |
| `employeeSignature` | RN signature pad |
| `patientSignature` | Patient signature pad (with unsigned fallback reasons) |
| `customSignature` | Name field + signature pad combo |
| `time` | Time picker |
| `date` | Date picker |
| `editor` | HTML content (display only) |
| `image` | Image display |
| `bodyDrawing` | Interactive body diagram (mark pain/wounds on 4 anatomy views) |
| `chart` | Repeatable row table with sub-questions |
| `medicationProfile` | Medication list management |
| `bloodPressure` | Systolic/diastolic dual input |
| `icdCodes` | ICD-10 diagnosis code selector |
| `sectionedIcdCodes` | Section-specific ICD codes |
| `finalIcdCodes` | Final diagnosis codes |
| `patientPhysician` | Physician selector |
| `POC` | Plan of Care duty items |
| `RNPlatformPatientPhysician` | Platform-linked physician |

---

## 4. Conditional Visibility

Questions can be conditionally shown/hidden based on parent answers:
- `parentId` → which question controls visibility
- `showIfParentEquals` + `ifParentEquals` → show this question only if parent answer matches
- Before rendering, the app checks `checkIfParentEqual(parentItemId, currentAnswers)`

---

## 5. Four AI Features

### A. Per-Question AI Generation
- Questions with `htmlTemplateId` can be AI-generated
- Server provides `questionGenerationAvailabilityMap` (via `GET .../generation_map2`)
- Questions may have **lock hints** — prerequisites that must be completed first
- `AIGenerationButton` shows "Generate by AI" (pulse animation when unlocked, lock icon when blocked)
- On click: `POST .../template_id/:htmlTemplateId/generate`
- Server returns `{ type: "AnswerGenerated", answer }` or `{ type: "Reject", rejections }`
- Items with `blockOnMobile: true` are LOCKED on mobile (read-only). Two scenarios:
  - **Database-linked questions**: Pre-filled from patient database
  - **AI-generated questions**: Blocked on both mobile AND webapp (`blockOnWebapp: true`)
- AI can generate **groups** of related questions at once via `alsoGenerates` relationships

### B. Speech-to-Text for Narratives
- `textLong` questions with `isNarrative: true` open `RNNarrativeScreen`
- Shows "Guiding Questions" + textarea with **RecordingMicrophone** button
- Uses `@capgo/capacitor-speech-recognition` (native plugin)
- Handles partial results, merges recognized text
- Platform differences: iOS (streaming), Android (single-result)

### C. Live Translation via OpenAI Realtime API
- Uses **OpenAI Realtime API via WebRTC** for real-time voice translation
- Flow: Get ephemeral key from backend → RTCPeerConnection → data channel `"oai-events"` → SDP to `api.openai.com/v1/realtime/calls?model=gpt-realtime`
- Bidirectional audio streaming — translates patient speech in real-time
- RN selects target language, opens `LiveTranslationModal`

### D. Copy From Last Time
- `CopyFromLastTimeButton` fetches answers from previous version of same document type
- All answers bulk-inserted into current form, saving time on recurring assessments (e.g., reassessments)

---

## 6. Answer Saving (Real-Time)

Answers are saved **immediately** on each interaction:
1. RN taps a radio/checks a box/types text
2. `handleOnInsertAnswer(id, value)` fires → updates local state + calls API
3. `POST /caregivers/:id/visit_instances/:id/patient_documents/:documentTypeId/answer`
4. "Document Saved" toast appears
5. Submit button disabled while answers in flight (re-enables 250ms after last answer resolves)

---

## 7. Submission & Validation

**Validation pass before submit:**
- Check all required fields filled
- Check unresolved AI rejections
- Validate medication profiles, ICD codes, vital signs
- If fails: red borders + shake animation + dialog listing missing fields

**Submit:** `POST /caregivers/:id/visit_instances/:id/patient_documents/:documentTypeId`
- Includes `submissionDate` and optional `regenerateNursingQuestionsOtherDocuments` flag

---

## 8. Resubmission Flow

Documents can be rejected (by AI review or human QA) with per-question rejections:
- `QuestionRejectionHeader` banners appear above rejected questions
- RNs resolve or decline rejections, then resubmit

---

## 9. Signature Capture

- `react-signature-canvas` in modal, stored as base64 data URL
- **Unsigned fallback reasons:** "Patient unable to sign", "Patient refused to sign", "Verbal consent given", "Other"

---

## 10. blockOnMobile Behavior

Questions with `nursingQuestionLinked` (database-linked) that already have data are set to `blockOnMobile = true` (read-only on mobile). This prevents modifying propagated answers on downstream documents.

**Rules:**
1. **Certification Period Questions** (from_date, to_date): blockOnMobile only if BOTH have values
2. **Allergies Question**: Never set blockOnMobile (special handling — always editable)
3. **All Other Database-Linked Questions**: blockOnMobile = true if answer has any value

---

## 11. Key Files

| File | Purpose |
|------|---------|
| `taskhealth-mobile2/src/components/POCDocumentQuestion/POCDocumentQuestionUI.tsx` | POC duty selection UI |
| `taskhealth-mobile2/src/components/AIGenerationButton/` | AI generation button component |
| `taskhealth-mobile2/src/components/RNNarrativeScreen/` | Speech-to-text narrative editor |
| `taskhealth-mobile2/src/components/LiveTranslationModal/` | Real-time translation UI |
| `taskhealth-mobile2/src/components/CopyFromLastTimeButton/` | Copy previous answers |
