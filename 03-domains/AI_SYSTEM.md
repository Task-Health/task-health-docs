# AI System

> All AI capabilities in the Task Health platform — generation, review, rules engines, and ICD codes.

---

## 1. Overview

Task Health uses AI at multiple points in the clinical document workflow:

1. **Per-question AI generation** — 26 questions on the Patient Assessment are AI-generated (teaching narratives, ICD codes, invisible fields)
2. **AI review system** — Validates RN answers for clinical consistency (20 section rules, HARD vs SUGGESTED severity)
3. **POC rules engine** — Deterministic duty selection for Plan of Care (673-line prompt, 27 derived flags)
4. **ICD code generation** — Auto-suggests diagnosis codes per section and final consolidated list
5. **Post-submission generation** — Progress note and subsidiary questions generated after RN submits

**Primary AI model:** GPT-5.1 (`gpt-5.1-chat-latest`) for most questions. Temperature 0 for deterministic rules engines, temperature 0.5 for narrative generation, temperature 1 for ICD code matching.

---

## 2. Per-Question AI Generation (26 Questions on Patient Assessment v10)

Each AI-generated question has an `htmlTemplateId` that links it to a generation rule file. Questions with `blockOnMobile: true` or `blockOnWebapp: true` are locked until AI generates the answer.

### 2.1 Teaching Provided (14 questions)

AI generates short clinical teaching narratives (<=50 words) based on the RN's findings in each section.

| htmlTemplateId | Section | What It Generates |
|---------------|---------|-------------------|
| `fallRiskTeaching` | Fall Risk Assessment | Teaching based on fall risk factors identified |
| `psychologicalTeaching` | Neurological Assessment | Teaching based on psychological findings |
| `mouthThroatSpeechTeaching` | EENT | Teaching based on mouth/throat/speech findings |
| `respiratoryTeaching` | Cardiopulmonary | Teaching based on respiratory findings |
| `musculoskeletalTeachingProvided` | Musculoskeletal | Teaching based on MSK findings |
| `painAssessmentTeachingProvided` | Pain Assessment | Teaching based on pain findings |
| `giAssessmentTeachingProvided` | GI/GU/Reproductive | Teaching based on GI/GU findings |
| `nutritionalAssessmentTeachingProvided` | Allergies & Nutritional | Teaching based on nutritional findings |
| `iheTeachingProvided` | Integumentary/Hematopoietic/Endocrine | Teaching based on IHE findings |
| `medicationsTeachingProvided` | Medications | Teaching based on medication profile |
| `dmeTeachingProvided` | DME & Supplies | Teaching based on DME findings |
| `textImmunizationsTeachingProvided` | Immunization Status | Teaching based on immunization status |
| `emergencyContactsTeachingProvided` | Emergency | Teaching based on emergency preparedness |
| `environmentSafetyTeachingProvided` | Environment/Safety | Teaching based on environment hazards |

### 2.2 Section ICD Code Suggestions (8 questions)

AI suggests relevant ICD-10 codes based on findings in each clinical section. Model: GPT-5.1 at temperature 1 (higher creativity for code matching).

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

### 2.3 Final ICD Codes (1 question)

`finalIcdCodes` — Consolidated principal diagnosis + surgical procedure ICD codes. Combines suggestions from all 8 section ICD code questions into a structured output. Model: GPT-5.1.

### 2.4 Post-Submission Progress Note (1 question)

`summaryProgressNote` — Full clinical progress note (<=160 words). Generated AFTER the RN submits the Patient Assessment.

**Generation order:** First generates subsidiary questions (Functional Limitations, Activities Permitted, Safety Measures, Prognosis, Priority Code, TAL Status), then summarizes all sections into a coherent progress note.

### 2.5 Plan of Care (2 questions, separate document)

`poc` + `specialInstructions` — Generated AFTER Patient Assessment is submitted. Uses the POC rules engine (see Section 5 below). These are on the POC document, not the Patient Assessment.

---

## 3. Lock Hints / Prerequisites

AI generation buttons are locked until prerequisites are met. Two types of checks:

### "QuestionGroup" check
RN must answer specific prerequisite questions before AI can generate. Example: Fall Risk Teaching requires completion of: DOB, history of falls, musculoskeletal assessment, vision, GI/GU, mood, orientation, DME, environment safety, ICD codes.

### "Document" check
Entire document must be submitted first. Example: POC generation requires Patient Assessment to be submitted (`checks: [{ type: "Document", docType: PatientAssessment, check: "Submitted" }]`).

**Mobile UX:** `AIGenerationButton` shows pulse animation when unlocked, lock icon when blocked. On click: `POST .../template_id/:htmlTemplateId/generate`. Server returns `{ type: "AnswerGenerated", answer }` or `{ type: "Reject", rejections }`.

**Key file:** `taskhealth_server2/src/modules/patient_documents/html/patient-assessment/v10/rules/` — contains all rule files.

---

## 4. The 5 Invisible Auto-Generated Questions

These questions are NOT visible on the Patient Assessment form. They are generated by AI using assessment data and then propagated to other documents (CMS-485, POC) via the nursing database question system (`nursingQuestionLinked`).

| Question | htmlTemplateId | Output Type | Model | Temp | Destination |
|----------|---------------|-------------|-------|------|-------------|
| **Functional Limitations** | `functionalLimitations` | Multi-select (11 options) | GPT-5.1 | 0 | CMS-485 Field 18A |
| **Safety Measures** | `safetyMeasures` | Multi-select (13 options) | GPT-5.1 | 0 | CMS-485 Field 15, POC |
| **Activities Permitted** | `activitiesPermitted` | Multi-select (12 options) | GPT-5.1 | 0 | CMS-485 Field 18B, POC |
| **Prognosis** | `summaryPrognosis` | Single radio (5 values) | GPT-5.1 | 0 | CMS-485 Field 20 |
| **Progress Note** | `summaryProgressNote` | Narrative text (<=160 words) | GPT-5.1 | 0.5 | Patient Assessment Page 8 |

### 4.1 Functional Limitations (Field 18A)

**Rule file:** `taskhealth_server2/src/modules/patient_documents/html/patient-assessment/v10/rules/functional-limitations/functionalLimitations.rule.v10.ts`

Pure rules engine. AI analyzes Patient Assessment using rules-only (no clinical inference):
- **Musculoskeletal Assessment** → "Amputation", "Gait Abnormality" → "Ambulation", "Weakness" → "Endurance"
- **Neurological Symptoms** → "Paralysis", "Ataxia"
- **EENT/Hearing Assessment** → "Hearing Loss" → "Hearing", uses "Hearing Aid"
- **Speech Assessment** → "Speech Impairment" from MouthThroatSymptoms
- **Eyes/Vision Assessment** → "Legally Blind"
- **Cardiopulmonary Assessment** → "Fatigues Easily", "Activity Intolerance" → "Endurance"
- **GI/GU Symptoms** → "Incontinence" → "Bowel/Bladder (Incontinence)"
- **Diagnosis Text** → Literal substring matching for conditions

**Output array** (one or more of):
`["None", "Amputation", "Bowel/Bladder (Incontinence)", "Contracture", "Hearing", "Paralysis", "Endurance", "Ambulation", "Speech", "Legally Blind", "Dyspnea with Minimal Exertion"]`

**CMS-485 mapping** (cms485DocumentToPayload.ts lines 790-806): Maps to individual checkbox fields `FUNCTIONAL_LIMITATIONS_AMPUTATION`, `FUNCTIONAL_LIMITATIONS_BOWEL_BLADDER`, etc.

### 4.2 Safety Measures (Field 15)

**Rule file:** `taskhealth_server2/src/modules/patient_documents/html/patient-assessment/v10/rules/safety-measures/safetyMeasures.rule.v10.ts`

Pure rules engine. 13 safety measure options:

| Safety Measure | Triggered By |
|---------------|-------------|
| Fall Precautions | Gait abnormality, weakness, syncope, disorientation, cognitive issues, environment hazards |
| Medication Safety | Patient takes medications OR unsafe storage |
| Skin/Pressure Prevention | Wounds, immobility, incontinence |
| Infection Control | Wounds, ostomy, catheter, respiratory equipment |
| Emergency Plan | No documented plan OR high-risk conditions (chest pain, seizures, oxygen, anticoagulants, diabetes) |
| Environment | Environmental hazards present |
| Aspiration Precautions | Dysphagia OR textured diet OR tube feeding |
| Oxygen Safety | Home oxygen or respiratory support devices |
| Diabetes Precautions | Diabetes diagnosis or medication |
| Anticoagulant Precautions | Warfarin, heparin, apixaban medications |
| Cognitive Impairment/Wandering | Disoriented OR forgetful OR hallucinations OR dementia diagnosis |
| Seizure/Syncope Precautions | Seizures OR syncope diagnosis/symptoms |
| DME/Transfer Safety | Mobility equipment OR transfer limitations |

**CMS-485 mapping:** Maps to `SAFETY_MEASURES` text field (cms485Template.ts line 201).

### 4.3 Activities Permitted (Field 18B)

**Rule file:** `taskhealth_server2/src/modules/patient_documents/html/patient-assessment/v10/rules/activitiesPermitted/activitiesPermitted.rule.v10.ts`

Mostly rules with some inference:
- **Level of Consciousness** = "Comatose" → "Complete Bedrest"
- **Hoyer Lift** in bedroom equipment → "Transfer Bed/Chair"
- **Mobility Equipment** (Cane, Walker, Wheelchair) → Auto-select matching options
- **No impairments** → "No Restrictions"

**MANUAL-ONLY options** (RN must select, AI cannot auto-select):
Bedrest BRP, Up As Tolerated, Partial Weight Bearing, Independent At Home, Exercises Prescribed

**Output array** (one or more of):
`["Complete Bedrest", "Bedrest BRP", "Up As Tolerated", "Transfer Bed/Chair", "Exercises Prescribed", "Partial Weight Bearing", "Independent At Home", "Crutches", "Cane", "Wheelchair", "Walker", "No Restrictions"]`

**CMS-485 mapping** (lines 808-826): Maps to 13 individual checkbox fields.

### 4.4 Prognosis (Field 20)

**Rule file:** `taskhealth_server2/src/modules/patient_documents/html/patient-assessment/v10/rules/summary/prognosis.rule.v10.ts`

Flag-based decision tree with 6 derived boolean flags:

**Derived flags:**
- `SeriousConditionFlag` — Life-limiting diagnoses (cancer, ALS, end-stage failure)
- `HighDependencyFlag` — High mobility dependence (wheelchair, bedridden) OR high ADL dependence
- `SignificantInstabilityFlag` — Unstable vitals OR cardiopulmonary issues OR severe neuro issues
- `StableConditionFlag` — Vitals WNL AND no cardiopulmonary OR neuro crises
- `MildBurdenFlag` — Independent, no serious conditions, stable

**Decision tree** (lines 342-449):
```
IF SeriousConditionFlag AND HighDependencyFlag AND (Unstable OR ContinuousCare)
  → "Poor"
ELSE IF SeriousConditionFlag AND HighDependencyFlag AND Stable
  → "Guarded"
ELSE IF (SeriousConditionFlag OR HighDependencyFlag OR Elderly) AND Stable
  → "Fair" (default)
ELSE IF Stable AND NOT HighDependencyFlag AND (NOT SeriousCondition OR NOT Elderly)
  → "Good"
ELSE IF Stable AND MildBurdenFlag
  → "Excellent"
```

**Output:** Exactly one of: `["Poor", "Guarded", "Fair", "Good", "Excellent"]`

**CMS-485 mapping** (lines 845-851): Maps to checkbox fields `PROGNOSIS_POOR` through `PROGNOSIS_EXCELLENT`.

---

## 5. POC Rules Engine (Plan of Care Duty Selection)

### 5.1 Architecture

The POC AI prompt is a **deterministic rules engine**, NOT a free-form AI assistant. The system instruction explicitly states: **"You are a PURE RULES ENGINE"** — it is forbidden from doing any clinical reasoning outside the explicit rules.

**Key file:** `taskhealth_server2/src/modules/patient_documents/html/plan-of-care/v7/rules/planOfCare.rule.v7.ts` (757 lines)

**Configuration:**
```typescript
createQuestionGenerationRule({
    type: "AI",
    model: "gpt-5.1-chat-latest",
    temperature: 0,
    htmlTemplateId: "poc",
    checks: [{ type: "Document", docType: PatientAssessment, check: "Submitted" }],
    alsoGenerates: ["specialInstructions"],
})
```

### 5.2 Data Fed to the Prompt

`prepareInputs()` gathers two data sources:
1. **patientAssessmentFormattedQuestions** — ALL Patient Assessment sections' questions + answers, formatted as "Label: value" text
2. **standaloneFormattedQuestions** — POC-specific standalone questions (patient preferences like "needs aide for bathroom", "needs aide for shopping", etc.)

### 5.3 System Instruction Structure (6 Sections, 673 lines)

| Section | Content | Lines |
|---------|---------|-------|
| **Section 0** | IGNORE LIST — PA labels to skip (TAL, Priority Code, Functional Limitations, Safety Measures, etc.) | ~20 |
| **Section 1** | ALLOWED INPUT LABELS — 27 categories the engine can consider (Medications, Neuro, EENT, Cardio, MSK, GI/GU, IHE, Allergies/Nutrition, DME, Environment, Patient Preferences, Service Frequency) | ~50 |
| **Section 2** | PARSING RULES — how to read multi-select, narratives, service frequency | ~30 |
| **Section 3** | 27 DERIVED BOOLEAN FLAGS (CognitiveImpairment, MobilityImpairment, BedboundFunctional, etc.) | ~80 |
| **Section 4** | 39 DUTIES with default frequencies | ~40 |
| **Section 5** | ~250 lines of IF/THEN RULES organized by category (Personal Care, Toileting, Nutrition, Activities, Treatment, Household) | ~250 |
| **Section 6** | OUTPUT FORMAT (JSON schema) | ~20 |

### 5.4 The 27 Derived Boolean Flags

Examples: `hasIncontinence`, `hasFoley`, `hasOstomy`, `hasDysphagia`, `needsWoundCare`, `usesAssistiveDevice`, `hasLimitedMobility`, `hasDiabetes`, `takesMultipleMedications`, `hasPainIssues`, `CognitiveImpairment`, `MobilityImpairment`, `BedboundFunctional`, etc.

Each flag has explicit rules for how to derive it from PA answers.

### 5.5 Rule Examples

```
IF hasIncontinence = true THEN:
  - Select "Incontinence Supplies" with frequency "Every visit"
  - Select "Incontinence" with frequency "Every visit"

IF hasFoley = true THEN:
  - Select "Empty foley bag" with frequency "Every visit"
  - Select "Monitor Patient Safety" with frequency "Every visit"

IF NOT hasFoley AND NOT hasOstomy THEN:
  - Do NOT select "Ostomy/Catheter Care"
```

### 5.6 User Prompt

```
"Here are the questions of the patient assessment document with their answers:
${patientAssessmentFormattedQuestions}

Here are additional relevant questions with their answers for generating the plan of care:
${standaloneFormattedQuestions}"
```

### 5.7 Output Schema

```json
{
  "type": "POC",
  "result": {
    "items": [{ "duty": "Bath Shower", "frequency": "Every visit", "notes": null }],
    "specialInstructions": "N/A"
  }
}
```

### 5.8 Why a Rules Engine (Not Free-Form AI)

1. **Regulatory compliance** — POC duties must be clinically justified by PA findings
2. **Reproducibility** — Same PA answers should always produce same POC duties
3. **Auditability** — Every duty selection can be traced to a specific rule and PA finding
4. **Temperature 0** — Ensures deterministic output with no creative variation

---

## 6. AI Review System

> **Owner quote:** "The AI review is the most core aspect of our RN visit assessment app."

### 6.1 Overview

The AI Review System validates RN answers on the Patient Assessment form. It operates at two levels:
1. **Per-section review** — validates answers WITHIN each section
2. **Cross-section review** — validates answers ACROSS sections for consistency

### 6.2 When Reviews Run

Reviews run **both mid-form and at final submission**:
- **Mid-form:** After each section is completed, AI reviews that section
- **Final:** At submission, all sections are reviewed together for cross-section consistency

### 6.3 Two Severity Levels

- **HARD rules** — Must be fixed before submission can proceed
- **SUGGESTED rules** — RN can override by providing a narrative explanation

### 6.4 Narrative Override Mechanism

RN narratives from ANY section can suppress false-positive rejections. If the AI flags an inconsistency, but the RN has already written a narrative explaining the clinical reasoning, the review system checks narratives across ALL sections before rejecting.

### 6.5 The 20 Section Review Rules

**File location:** `taskhealth_server2/src/modules/patient_documents/html/patient-assessment/v10/review-rules/`

Each section has its own review rule file (e.g., `medications.review.v10.ts`, `diagnosis-info.review.v10.ts`).

### 6.6 Medication-Diagnosis Validation (7 Disease Clusters)

The most sophisticated review validates that medications and diagnoses are consistent. 7 disease clusters where certain medications MUST have corresponding diagnoses:

| Cluster | Example Medications | Expected Diagnoses |
|---------|-------------------|-------------------|
| **Diabetes** | Metformin, Insulin, Glipizide | E11.x (Type 2 DM), E10.x (Type 1 DM) |
| **Hypertension** | Lisinopril, Amlodipine, Losartan | I10 (Essential HTN) |
| **Heart Failure** | Furosemide, Carvedilol, Digoxin | I50.x (Heart failure) |
| **COPD/Asthma** | Albuterol, Fluticasone, Tiotropium | J44.x (COPD), J45.x (Asthma) |
| **Thyroid** | Levothyroxine, Methimazole | E03.x (Hypothyroidism), E05.x (Hyperthyroidism) |
| **Pain/Opioids** | Oxycodone, Gabapentin, Tramadol | Various pain codes |
| **Anticoagulation** | Warfarin, Apixaban, Rivaroxaban | I48.x (AFib), I82.x (DVT) |

Example: If a patient takes Metformin but has no diabetes diagnosis → AI flags it as inconsistency.

### 6.7 Cross-Section Validations

- Diagnosis ↔ DME consistency (e.g., wheelchair without mobility diagnosis)
- Findings ↔ Diagnosis consistency (e.g., wound finding without wound diagnosis)
- Medication ↔ Section findings (e.g., cardiac meds without cardiac findings)

---

## 7. ICD Code Auto-Generation

### 7.1 Per-Section ICD Codes (8 questions)

Each clinical section gets AI-suggested ICD-10 codes based on the RN's findings in that section (see Section 2.2 above). Model: GPT-5.1 at temperature 1.

### 7.2 Final ICD Codes

`finalIcdCodes` consolidates all section suggestions into:
- **Principal Diagnosis** — the primary reason for home care (one code)
- **Surgical Procedure codes** — if applicable
- **Other Pertinent Diagnoses** — additional relevant codes

These flow to CMS-485 Fields 11, 12, and 13.

---

## 8. CMS-485 Field Population (AI → PDF)

The CMS-485 **READS from saved answers** — it does NOT re-generate. AI generates once on the Patient Assessment → answers stored → CMS-485's `cms485DocumentToPayload.ts` reads them by semantic field name.

### AI-Generated Fields

| CMS-485 Field | Semantic Name | Source |
|---------------|--------------|--------|
| Field 11 — Principal Diagnosis | `PRINCIPAL_DIAGNOSIS_JSON` | `finalIcdCodes` AI generation |
| Field 12 — Surgical Procedure | `SURGICAL_PROCEDURE_JSON` | `finalIcdCodes` AI generation |
| Field 13 — Other Diagnoses | `OTHER_PERTINENT_DIAGNOSES_JSON` | `finalIcdCodes` AI generation |
| Field 15 — Safety Measures | `SAFETY_MEASURES` | `safetyMeasures` rules engine |
| Field 18A — Functional Limitations | `FUNCTIONAL_LIMITATIONS` | `functionalLimitations` rules engine |
| Field 18B — Activities Permitted | `ACTIVITIES_PERMITTED` | `activitiesPermitted` rules engine |
| Field 19 — Mental Status | `MENTAL_STATUS` | Direct mapping from PA neuro section (not AI) |
| Field 20 — Prognosis | `PROGNOSIS` | `prognosis` rules engine |
| Field 22 — Goals/Rehab | `GOALS_REHABILITATION_POTENTIAL_DISCHARGE_PLANS` | AI-generated + palliative care |

### Database-Linked Fields (not AI — via nursingQuestionLinked)

| CMS-485 Field | Source |
|---------------|--------|
| Field 3 — Certification Period | `CERTIFICATION_PERIOD_FROM/TO` |
| Field 10 — Medications | From PA medication profile |
| Field 14 — DME and Supplies | From PA DME section |
| Field 16 — Nutritional Requirements | `nursingQuestionLinked` |
| Field 17 — Allergies | `nursingQuestionLinked` |
| Field 21 — Orders for Discipline | Service type + frequency + free text |

### Semantic Field Mapping (legacy2semanticFields)

**File:** `taskhealth_server2/src/modules/pdf_templates/templates/cms485/cms485DocumentToPayload.ts` (lines 1004-1044)

```
"18a" → "FUNCTIONAL_LIMITATIONS"
"18b" → "ACTIVITIES_PERMITTED"
"19"  → "MENTAL_STATUS"
"20"  → "PROGNOSIS"
"15"  → "SAFETY_MEASURES"
"10"  → "MEDICATIONS"
"11"  → "PRINCIPAL_DIAGNOSIS_JSON"
"13"  → "OTHER_PERTINENT_DIAGNOSES_JSON"
"21"  → "ORDERS_FOR_DISCIPLINE_AND_TREATMENTS"
"22a" → "GOALS_REHABILITATION_POTENTIAL_DISCHARGE_PLANS"
```

---

## 9. Document Review Workflow

### 9.1 AI Per-Question Rejections (Automated)

After the RN submits the Patient Assessment:
1. AI reviews each section and generates per-question rejections
2. Rejections shown via `QuestionRejectionHeader` banners above each affected question
3. RN can either:
   - **"Mark as Fixed"** — edit the answer and resubmit
   - **"Decline with narrative"** — provide written justification for keeping the answer

### 9.2 Admin Task-Level Rejections (Manual)

Admin QA team can also reject at the task level with three statuses:
- `blocked` — must fix, no resubmit allowed until resolved
- `allowed` — approved despite flags
- `allowed_with_flags` — approved but with noted concerns

**Auto-blocking:** Rejections automatically become "blocked" if the task is more than 2 months old.

### 9.3 Document Status Flow

```
MISSING → IN_PROGRESS → COMPLETED → OPEN_FOR_RESUBMISSION → APPROVED → SENT_TO_PHYSICIAN → SIGNED
```

**Physician signature on CMS-485:** Manual date entry field — NOT an e-signature. Admin manually enters "sent to physician" date and "signed" date.

---

## 10. Key Code Locations

| File | Purpose |
|------|---------|
| `taskhealth_server2/src/modules/patient_documents/html/patient-assessment/v10/rules/` | All AI generation rule files |
| `taskhealth_server2/src/modules/patient_documents/html/patient-assessment/v10/review-rules/` | All AI review rule files |
| `taskhealth_server2/src/modules/patient_documents/html/plan-of-care/v7/rules/planOfCare.rule.v7.ts` | POC rules engine (757 lines) |
| `taskhealth_server2/src/modules/patient_documents/html/plan-of-care/v7/rules/planOfCate.items.v7.ts` | POC duty items definition |
| `taskhealth_server2/src/modules/pdf_templates/templates/cms485/cms485DocumentToPayload.ts` | CMS-485 answer-to-PDF field mapper |
| `taskhealth_server2/src/modules/pdf_templates/templates/cms485/cms485Template.ts` | CMS-485 PDF field definitions |
| `taskhealth_server2/src/modules/nursing_database_question/controllers/NursingQuestionCtrl.ts` | Nursing database question controller (1,684 lines) |
| `taskhealth_server2/src/modules/nursing_database_question/controllers/NursingQuestionConsts.ts` | Predefined nursing question constants |
| `taskhealth_server2/src/modules/patient_documents/controllers/RegenerateOtherDocsCtrl.ts` | Cross-document answer propagation |

---

## 11. Predefined Nursing Question Constants

From `NursingQuestionConsts.ts`:

| Constant | Question ID | Flows To |
|----------|------------|----------|
| `mentalStatusId` | 9869 | POC, CMS-485 Field 19 |
| `DMEandSuppliesId` | 9875 | CMS-485 Field 14, Emergency Kardex |
| `nutritionalRequirementsId` | 9873 | POC, CMS-485 Field 16, Emergency Kardex |
| `safetyMeasuresId` | 9874 | POC, CMS-485 Field 15 |
| `allergies` | 9967 | POC, CMS-485 Field 17, Emergency Kardex |
| `allergiesLongText` | 9872 | Emergency Kardex |
| `patientVisitFrequency` | 10000 | CMS-485 |
