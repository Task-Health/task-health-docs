# AI System

> All AI capabilities in the Task Health platform — generation, review, rules engines, ICD codes, actual prompt content, and complete rule inventories.

---

## 1. Overview

Task Health uses AI at multiple points in the clinical document workflow:

1. **Per-question AI generation** — 36 rule files on Patient Assessment v10 (teaching narratives, ICD codes, invisible fields)
2. **AI review system** — 20 section review rules validate RN answers for clinical consistency (HARD vs SUGGESTED severity)
3. **POC rules engine** — Deterministic duty selection for Plan of Care (673-line prompt, 27 derived flags, 42 duties)
4. **ICD code generation** — Auto-suggests diagnosis codes per section and final consolidated list
5. **Post-submission generation** — Progress note and subsidiary questions generated after RN submits

### 1.1 Models Used

| Context | Model | Temperature | Purpose |
|---------|-------|-------------|---------|
| AI generation (narratives/teaching) | `gpt-5.1-chat-latest` | 0.5 | Semi-deterministic, allows creative variance |
| AI generation (rules engines) | `gpt-5.1-chat-latest` | 0 | Fully deterministic, no creative variance |
| ICD code suggestions | `gpt-5.1-chat-latest` | 1 | Higher creativity for diagnosis code matching |
| AI review (all 20 sections) | `gpt-4.1-mini` | 0 | Fast, deterministic validation |

### 1.2 Prompt Architecture Pattern

All rule files follow a consistent TypeScript structure:

```typescript
import { sanitizePrompt } from "...OpenAI";
import { createQuestionGenerationRule } from "...patient-document-generation";

const systemInstructions = sanitizePrompt(`
  ... multi-line system prompt ...
`);

const rule = createQuestionGenerationRule({
    type: "AI",
    model: "gpt-5.1-chat-latest",
    temperature: 0,             // or 0.5 for narratives
    htmlTemplateId: "...",
    checks: [...],               // prerequisites
    alsoGenerates: ["..."],      // companion questions
    instructions: async (context) => [
        { role: "system", content: [{ type: "input_text", text: systemInstructions }] },
        { role: "user", content: [{ type: "input_text", text: userPrompt }] }
    ]
});
```

**Key patterns:**
- All system prompts use `sanitizePrompt()` wrapper (dedent-formatted, multiline)
- User prompts dynamically injected from `formatQuestionGroups()` or section summaries
- Three rule creator functions: `createQuestionGenerationRule()`, `createQuestionGenerationAsInputRule()`, `createFinalReviewRule()`

### 1.3 AI Rules Are Version-Specific

**Every code version has its own complete set of AI rules.** A task locked to v9 uses v9's rules; a task on v10 uses v10's rules. They never interfere.

**Version registries** (in each document type's `index.ts`):
```typescript
patientAssessmentDocumentGenerationRules = {
    4: patientAssessmentV4GenerationRules,   // 31 rules
    5: patientAssessmentV5GenerationRules,   // 75 rules
    // ... through v10 (36 rules + 20 review rules)
};
```

**Why this matters for development:**
- **Bug fixes in AI rules cannot reach old versions.** If v9's Functional Limitations rule incorrectly triggers "Ambulation," you can fix it in v10 — but v9 tasks keep the bug.
- **NEVER modify an existing version's rules if tasks are active on it** — this could invalidate already-generated AI answers.
- **When form questions change (add/remove/rename), AI rules MUST be updated** — rules reference specific `htmlTemplateId` values and string-match answer options. A renamed answer option causes silent failures.

See [DOCUMENT_VERSIONING.md](DOCUMENT_VERSIONING.md) for the full versioning system and development checklists.

### 1.4 Data Injection Patterns

| Rule Type | Data Source | Injection Method |
|-----------|------------|------------------|
| Teaching (per-section) | Specific section Q&A only | `formatQuestionGroups(context, dependencies, excludeIds)` |
| Rules engines (FL, AP, SM) | Full assessment data | `orderDocumentQuestionGroups() + getFormattedQuestionGroup()` |
| POC rules engine | All PA sections + standalone | `formatQuestionGroups(context, sections, overrides)` → two text blocks |
| Progress note | AI-generated section summaries | `generateSectionSummaries()` → `{name, summary}` array |
| ICD codes | Specific section Q&A | `formatQuestionGroups(context, dependencies)` |
| Review rules | Full assessment data | All sections' Q&A concatenated |

---

## 2. Per-Question AI Generation (36 Rule Files on Patient Assessment v10)

Each AI-generated question has an `htmlTemplateId` that links it to a generation rule file. Questions with `blockOnMobile: true` or `blockOnWebapp: true` are locked until AI generates the answer.

### 2.1 Teaching Provided (14 questions)

AI generates short clinical teaching narratives (<=50 words / <=400 characters) based on the RN's findings in each section. Model: GPT-5.1 at temperature 0.5.

| htmlTemplateId | Section | Rule File |
|---------------|---------|-----------|
| `fallRiskTeaching` | Fall Risk Assessment | `fall-risk/fallRiskTeachingProvided.rule.v10.ts` |
| `psychologicalTeaching` | Neurological Assessment | `neurological/neurologicalTeachingProvided.rule.v10.ts` |
| `mouthThroatSpeechTeaching` | EENT | `eent/eentTeachingProvided.rule.v10.ts` |
| `respiratoryTeaching` | Cardiopulmonary | `cardiopulmonary/cardiopulmonaryTeachingProvided.rule.v10.ts` |
| `musculoskeletalTeachingProvided` | Musculoskeletal | `musculoskeletal/musculoskeletalTeachingProvided.rule.v10.ts` |
| `painAssessmentTeachingProvided` | Pain Assessment | `pain/painTeachingProvided.rule.v10.ts` |
| `giAssessmentTeachingProvided` | GI/GU/Reproductive | `gi-gu-reproductive/giGuReproductiveTeachingProvided.rule.v10.ts` |
| `nutritionalAssessmentTeachingProvided` | Allergies & Nutritional | `nutritional/nutritionalTeachingProvided.rule.v10.ts` |
| `iheTeachingProvided` | Integumentary/Hematopoietic/Endocrine | `ihe/iheTeachingProvided.rule.v10.ts` |
| `medicationsTeachingProvided` | Medications | `medications/medicationsTeachingProvided.rule.v10.ts` |
| `dmeTeachingProvided` | DME & Supplies | `dme-and-supplies/dmeTeachingProvided.rule.v10.ts` |
| `textImmunizationsTeachingProvided` | Immunization Status | `immunization/immunizationTeachingProvided.rule.v10.ts` |
| `emergencyContactsTeachingProvided` | Emergency | `emergency/emergencyTeachingProvided.rule.v10.ts` |
| `environmentSafetyTeachingProvided` | Environment/Safety | `environment-safety/evironmentSafetyTeachingProvided.rule.v10.ts` |

**Teaching Prompt Pattern (actual from pain teaching rule):**

System prompt provides:
1. Role: "You are an AI for generating clinical teaching text"
2. Constraint: <=50 words / <=400 characters, plain text only, no formatting
3. Gate condition: If status is "Not Present" or baseline is normal, output "N/A"
4. 20+ condition-specific teaching templates with 3 examples each
5. Side effect profiles for high-risk medications (Warfarin, Insulin, Lisinopril, Metformin, Furosemide, Gabapentin, etc.)

User prompt: Section Q&A formatted as "Label: value" pairs

### 2.2 Section ICD Code Suggestions (8 questions)

AI suggests relevant ICD-10 codes based on findings in each clinical section. Model: GPT-5.1 at temperature 1 (higher creativity for code matching).

| htmlTemplateId | Section | Rule File |
|---------------|---------|-----------|
| `painIcdCodes` | Pain Assessment | `pain/pain.icdCodes.rule.v10.ts` |
| `cardiopulmonaryIcdCodes` | Cardiopulmonary | `cardiopulmonary/cardiopulmonary.icdCodes.rule.v10.ts` |
| `musculoskeletalIcdCodes` | Musculoskeletal | `musculoskeletal/musculoskeletal.icdCodes.rule.v10.ts` |
| `eentIcdCodes` | EENT | `eent/eent.icdCodes.rule.v10.ts` |
| `giGuReproductiveIcdCodes` | GI/GU/Reproductive | `gi-gu-reproductive/giGuReproductive.icdCodes.rule.v10.ts` |
| `iheIcdCodes` | Integumentary/Hematopoietic/Endocrine | `ihe/ihe.icdCodes.rule.v10.ts` |
| `medicalHistoryIcdCodes` | Medical History | `medicalHistory/medicalHistory.icdCodes.rule.v10.ts` |
| `neurologicalIcdCodes` | Neurological | `neurological/neurological.icdCodes.rule.v10.ts` |

### 2.3 Final ICD Codes (2 questions)

- `finalIcdCodes` — Consolidated ICD codes. Rule: `diagnosis/final.icdCodes.rule.v10.ts`
- `finalIcdCodesPrincipal` — Principal diagnosis selection. Rule: `diagnosis/final.icdCodes.principal.rule.v10.ts`

### 2.4 Post-Submission Progress Note (1 question)

`summaryProgressNote` — Full clinical progress note (<=160 words). Rule: `progress-note/progressNote.rule.v10.ts`

**Actual prompt pattern:**
- System: Generates progress note from section summaries. Provides 7 detailed examples showing narrative style, detail level, and structure. Key instructions: return structured text without formatting, no paragraph breaks, clinical narrative style mixing vital information with assessment findings.
- Input: `generateSectionSummaries()` → array of `{name, summary}` objects → transformed to "Section name: X, summary: Y" format
- Temperature: 0.5

### 2.5 Non-AI Calculated Rules (4 questions)

These are computed deterministically without LLM calls:

| htmlTemplateId | Rule File | Logic |
|---------------|-----------|-------|
| `fallRiskFactor` | `fall-risk/fallRiskFactor.ts` | Automated fall risk factor detection |
| `fallRiskScore` | `fall-risk/fallRiskScore.ts` | Score = count of selected risk factors |
| `fallRiskLevel` | `fall-risk/fallRiskLevel.ts` | 0-3=Low, 4-6=Moderate, 7-10=High |
| `priorityCode` | `visit-info/priorityCode.rule.v10.ts` | Priority code calculation |
| `talStatus` | `visit-info/talStatus.rule.v10.ts` | TAL status determination |

### 2.6 Plan of Care (2 questions, separate document)

`poc` + `specialInstructions` — Generated AFTER Patient Assessment is submitted. Uses the POC rules engine (see Section 5 below). These are on the POC document, not the Patient Assessment.

---

## 3. Lock Hints / Prerequisites

AI generation buttons are locked until prerequisites are met. Two types of checks:

### "QuestionGroup" check
RN must answer specific prerequisite questions before AI can generate. Example: Fall Risk Teaching requires completion of: DOB, history of falls, musculoskeletal assessment, vision, GI/GU, mood, orientation, DME, environment safety, ICD codes.

### "Document" check
Entire document must be submitted first. Example: POC generation requires Patient Assessment to be submitted (`checks: [{ type: "Document", docType: PatientAssessment, check: "Submitted" }]`).

**Mobile UX:** `AIGenerationButton` shows pulse animation when unlocked, lock icon when blocked. On click: `POST .../template_id/:htmlTemplateId/generate`. Server returns `{ type: "AnswerGenerated", answer }` or `{ type: "Reject", rejections }`.

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

### 4.1 Functional Limitations (Field 18A) — 738-Line Rules Engine

**Rule file:** `rules/functional-limitations/functionalLimitations.rule.v10.ts`
**Type:** `AsInput` (receives ALL assessment data)

**Output array** (one or more of):
`["None", "Amputation", "Bowel/Bladder (Incontinence)", "Contracture", "Hearing", "Paralysis", "Endurance", "Ambulation", "Speech", "Legally Blind", "Dyspnea with Minimal Exertion"]`

**System Prompt Structure (738 lines):**

**Section 1 — INPUT DATA:** Specifies 15+ input fields with exact htmlTemplateIds and expected options:
- MUSCULOSKELETAL: 9 options (None, Numbness, Weakness, Gait Abnormality, Amputation, Coordination Problems, Stiffness, Deformities, Limited ROM)
- NEUROLOGICAL: LOC, Orientation, Additional Neurological (Tremors, Seizures, Paralysis, Ataxia, Headache, Dizziness)
- EENT: Eye conditions, Hearing conditions, Hearing device, Mouth/Throat/Speech
- CARDIOPULMONARY: Cardiovascular acute symptoms, Respiratory symptoms
- GI/GU: GI symptoms, GU symptoms (with Incontinence options)
- DME: Mobility equipment, Bedroom/positioning equipment, Medical supplies
- IHE: Integumentary, Hematopoietic, Endocrine

**Section 2 — FUNCTIONAL LIMITATION RULES (10 rule groups):**

| Rule ID | Limitation | Trigger Conditions |
|---------|-----------|-------------------|
| FL-Amputation-1 | Amputation | MSK contains "Amputation" |
| FL-Amputation-2 | Amputation | Diagnosis contains substring "amputat" |
| FL-BowelBladder-1 | Bowel/Bladder | GI contains "Incontinence" |
| FL-BowelBladder-2 | Bowel/Bladder | GU contains "Incontinence (leakage of urine)" |
| FL-BowelBladder-3 | Bowel/Bladder | Has Incontinence Supplies OR diagnosis "urinary/fecal incontinence" |
| FL-Contracture-1 | Contracture | Narrative substring "contracture" (case-insensitive). NOT inferred from Stiffness/ROM |
| FL-Hearing-1 | Hearing | Hearing "Hearing Loss"/"Deaf"/"Tinnitus"/"Discharge" OR HearingDevice = "Uses Hearing Aid" |
| FL-Paralysis-1 | Paralysis | Neuro contains "Paralysis" |
| FL-Paralysis-2 | Paralysis | Diagnosis contains "paraplegia"/"quadriplegia"/"hemiplegia"/"tetraplegia"/"paralysis" |
| FL-Endurance-1 | Endurance | Cardio contains "Fatigues Easily" OR "Activity Intolerance". NOT from generic fatigue/anemia |
| FL-Ambulation-1 | Ambulation | MSK weakness/gait/amputation/coordination/ROM/deformities |
| FL-Ambulation-2 | Ambulation | Neuro "Ataxia" |
| FL-Ambulation-3 | Ambulation | Any mobility equipment (Cane/Quad Cane/Walker/Wheelchair) |
| FL-Ambulation-4 | Ambulation | Hospital Bed or Hoyer Lift in bedroom equipment |
| FL-Speech-1 | Speech | Mouth contains "Speech Impairment" |
| FL-Speech-2 | Speech | Narrative contains "aphasia"/"dysarthria"/"cannot speak" |
| FL-LegallyBlind-1 | Legally Blind | Eye contains "Legally Blind (very low vision)" |
| FL-LegallyBlind-2 | Legally Blind | Diagnosis "legal blindness"/"legally blind". NOT from "Visual Impairment" or glasses |
| FL-Dyspnea-1 | Dyspnea w/ Min Exertion | Narrative literal "dyspnea" substring. NOT from SOB/Orthopnea/PND/Activity Intolerance |

**Section 3 — OUTPUT LOGIC:** If no flags true → `["None"]`. If any flags true → never include "None", order by specification, only include true flags.

**CMS-485 mapping** (cms485DocumentToPayload.ts lines 790-806): Maps to individual checkbox fields `FUNCTIONAL_LIMITATIONS_AMPUTATION`, `FUNCTIONAL_LIMITATIONS_BOWEL_BLADDER`, etc.

### 4.2 Safety Measures (Field 15) — Rules Engine

**Rule file:** `rules/safety-measures/safetyMeasures.rule.v10.ts`

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

### 4.3 Activities Permitted (Field 18B) — 515-Line Rules Engine

**Rule file:** `rules/activitiesPermitted/activitiesPermitted.rule.v10.ts`
**Type:** `AsInput`

**Output array** (one or more of):
`["Complete Bedrest", "Bedrest BRP", "Up As Tolerated", "Transfer Bed/Chair", "Exercises Prescribed", "Partial Weight Bearing", "Independent At Home", "Crutches", "Cane", "Wheelchair", "Walker", "No Restrictions"]`

**System Prompt Structure (515 lines):**

**Section 2 — INPUT DATA:** 15 input fields (LOC, Orientation, Neuro symptoms, MSK symptoms, Cardio acute/respiratory, GI/GU incontinence, Endocrine, Mobility equipment, Bedroom equipment)

**Section 3 — 12 ACTIVITY RULES:**

| Rule ID | Activity | Trigger |
|---------|---------|---------|
| AP-CompleteBedrest-1 | Complete Bedrest | LOC = "Comatose" |
| AP-Transfer-1 | Transfer Bed/Chair | Hoyer Lift in bedroom equipment |
| AP-Crutches-1 | Crutches | Literal "crutch"/"crutches" in DME Other or narrative (optional/rare) |
| AP-Cane-1 | Cane | Cane OR Quad Cane in mobility equipment |
| AP-Wheelchair-1 | Wheelchair | Wheelchair in mobility equipment |
| AP-Walker-1 | Walker | Walker in mobility equipment |
| AP-NoRestrictions-1 | No Restrictions | Complex 7-condition gate: LOC=Alert, fully oriented, all systems "None", no incontinence, no endocrine issues |

**5 MANUAL-ONLY options** (AI cannot auto-select, RN must select):
- Bedrest BRP, Up As Tolerated, Partial Weight Bearing, Independent At Home, Exercises Prescribed

**CMS-485 mapping** (lines 808-826): Maps to 13 individual checkbox fields.

### 4.4 Prognosis (Field 20) — Flag-Based Decision Tree

**Rule file:** `rules/summary/prognosis.rule.v10.ts`

**6 Derived Boolean Flags:**
- `SeriousConditionFlag` — Life-limiting diagnoses (cancer, ALS, end-stage failure)
- `HighDependencyFlag` — High mobility dependence (wheelchair, bedridden) OR high ADL dependence
- `SignificantInstabilityFlag` — Unstable vitals OR cardiopulmonary issues OR severe neuro issues
- `StableConditionFlag` — Vitals WNL AND no cardiopulmonary OR neuro crises
- `MildBurdenFlag` — Independent, no serious conditions, stable

**Decision tree:**
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

---

## 5. POC Rules Engine (Plan of Care Duty Selection)

### 5.1 Architecture

The POC AI prompt is a **deterministic rules engine**, NOT a free-form AI assistant. The system instruction explicitly states: **"You are a PURE RULES ENGINE"** — it is forbidden from doing any clinical reasoning outside the explicit rules.

**Key file:** `plan-of-care/v7/rules/planOfCare.rule.v7.ts` (754 lines)

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

`prepareInputs()` (in the rule file) gathers two data sources:

1. **patientAssessmentFormattedQuestions** — Fetches Patient Assessment data via `getPatientAssessmentFromContext()`, then formats PA questions via `formatQuestionGroups()` into "Label: value" text for all sections
2. **standaloneFormattedQuestions** — POC-specific standalone questions (e.g., `needsAideBathroomShower`, `needsAideShopping`, `needsAideMedicalAppointments`, `needsAideHairShaving`, `needsAideMealPrep`, `needsAssistanceFeeding`)

**Note:** `prepareInputs()` currently does **NOT** pass `patient.service_type` to the prompt — service type is stored on the patient record (see PATIENTS.md) but is not included in the AI context for duty selection.

**User prompt:**
```
"Here are the questions of the patient assessment document with their answers:
${patientAssessmentFormattedQuestions}

Here are additional relevant questions with their answers for generating the plan of care:
${standaloneFormattedQuestions}"
```

### 5.3 System Instruction Structure (6 Sections, 673 lines)

#### Section 0 — IGNORE LIST (~20 lines)
PA labels the engine must skip entirely:
- TAL, Priority Code, Functional Limitations, Safety Measures, Activities Permitted, Teaching Provided fields, ICD Code fields, Progress Note

#### Section 1 — ALLOWED INPUT LABELS (~80 lines)
Strict whitelist of 27 input categories the engine may consider:

| Category | Allowed Labels |
|----------|---------------|
| MEDICATIONS | "Patient Taking Medications", "Medication Profile" |
| NEUROLOGICAL | Level of Consciousness, Patient Orientation, Abnormal Mood Behavior, Additional Neurological, RN Narrative |
| EENT | Eyes/Vision, Ears/Hearing, Mouth/Throat/Speech |
| CARDIOPULMONARY | Heart symptoms, Respiratory symptoms, Support devices |
| MUSCULOSKELETAL | Assessment options |
| GI/GU | Symptoms, Ostomy, Catheter, Dialysis |
| IHE | Integumentary, Wound Assessment, Endocrine, Blood Glucose |
| ALLERGIES & NUTRITION | Appetite, Weight Status, Food Intake, Diet restrictions |
| DME AND SUPPLIES | Mobility, Bathroom, Bedroom equipment |
| ENVIRONMENT AND SAFETY | Living arrangement, hazards |
| PREFERENCES | Bathroom/shower, shopping, medical appointments, hair/shaving, meal prep, feeding assistance |
| SERVICE FREQUENCY | For meal-count logic |

#### Section 2 — PARSING RULES (~30 lines)
How to extract and process text values: multi-select parsing, narrative reading, service frequency interpretation.

#### Section 3 — 27 DERIVED BOOLEAN FLAGS (~160 lines)

| Flag | Derivation Logic |
|------|-----------------|
| CognitiveImpairment | LOC not "Alert" OR Orientation has gaps OR Mood has Confusion/Hallucinations/Delusions |
| MobilityImpairment | MSK Gait Abnormality/Weakness/Limited ROM/Deformities OR Neuro Ataxia |
| UsesAssistiveDevice | Any mobility equipment present (Cane, Walker, Wheelchair, etc.) |
| BedboundFunctional | MSK "Non-ambulatory" OR Hoyer Lift/Hospital Bed present. **Explicit prohibition:** "non-ambulatory" alone does NOT trigger |
| SevereVisionImpairment | Eyes "Legally Blind" or "Visual Impairment" |
| HearingImpairment | Hearing "Hearing Loss"/"Deaf"/"Tinnitus" |
| IncontinencePresent | GI or GU "Incontinence" options selected |
| SkinRiskOrWounds | Integumentary issues OR wound assessment present |
| DiabetesPresent | Endocrine diabetes options OR diabetes medications |
| NutritionRisk | Complex 6-part rule: appetite abnormality OR weight loss/gain OR special diet OR tube feeding OR NPO OR lab values abnormal |
| FluidManagementCritical | Fluid restriction OR CHF diagnosis OR renal diagnosis with fluid monitoring |
| HighFallRisk | Multiple MSK/Neuro/Vision/Hearing/Cognitive impairments combined |
| BathingTransferAbility | Maps to 4 states: Independent / HelpOne / HelpTwoOrLift / BedLevelOnly |
| ShoppingHelpPreference | From standalone "Does patient need aide for shopping?" |
| EscortHelpPreference | From standalone "Does patient need aide for medical appointments?" |
| HairShampooAssistPreference | From standalone preferences |
| ShavingAssistPreference | From standalone preferences |
| MealPrepPreference | From standalone "Does patient need aide for meal preparation?" |
| FeedingAssistSelected | Explicit binary from "Does patient need assistance with feeding?" question |
| MedCount | Count of medications from "Medication Profile" using `" - frequency:"` pattern matching |

#### Section 4 — 42 DUTIES WITH DEFAULT FREQUENCIES (~60 lines)

| Category | Duties |
|----------|--------|
| **PERSONAL CARE** (10) | Bath Shower, Bath Bed, Hair Care (Shampoo), Hair Care (Comb/Brush), Mouth Care, Denture Care, Grooming-Shave, Grooming-Nails, Dressing Patient, Skin Care, Foot Care |
| **TREATMENT** (6) | Empty foley bag, Remind to take medication, Ask Patient About Pain, Observe/Report, Monitor Patient Safety, Ostomy/Catheter Care |
| **HOUSEHOLD** (5) | Laundry, Light Housekeeping, Shopping and Errands, Change Bed Linen, Accompany to medical appointment |
| **TOILETING** (5) | Incontinence Supplies, Bedpan/Urinal, Toilet, Commode, Incontinence |
| **NUTRITION** (6) | Prepare meals (Breakfast/Lunch/Dinner/Snack), Assist with Feeding, Record intake (Food/Fluid), Patient on prescribed diet |
| **ACTIVITIES** (5) | Transferring, Assist with walking, Patient walks with assistive devices, Assist with home exercise program (HHA Only), Turning and positioning |

#### Section 5 — IF/THEN RULES BY CATEGORY (~250 lines)

##### 5.1 PERSONAL CARE Rules (11 duties)

| Duty | Rule Logic |
|------|-----------|
| Bath Shower | Preference-driven: if patient selects shower/tub preference → "Every visit". Fallback: if CognitiveImpairment OR MobilityImpairment → include |
| Bath Bed | BedboundFunctional = true → "Every visit". Mutually exclusive with Bath Shower |
| Hair Care (Shampoo) | HairShampooAssistPreference = true, OR fallback: CognitiveImpairment OR Neuro impairment OR SevereVisionImpairment |
| Hair Care (Comb/Brush) | Same triggers as Shampoo |
| Mouth Care | Dysphagia OR oral bleeding OR SOB → "Every visit" |
| Denture Care | Assessment indicates dentures |
| Grooming-Shave | ShavingAssistPreference = true, OR fallback: CognitiveImpairment OR MobilityImpairment |
| Grooming-Nails | DiabetesPresent OR SevereVisionImpairment OR SkinRiskOrWounds |
| Dressing Patient | Bath duty selected OR CognitiveImpairment OR Neuro OR MSK limitations |
| Skin Care | SkinRiskOrWounds OR IncontinencePresent OR BedboundFunctional |
| Foot Care | DiabetesPresent OR SevereVisionImpairment OR SkinRiskOrWounds |

##### 5.2 TOILETING Rules (5 duties)

| Duty | Rule Logic |
|------|-----------|
| Incontinence Supplies | BedboundFunctional OR paralysis → "Every visit" |
| Bedpan/Urinal | BedboundFunctional OR paralysis |
| Toilet | MobilityImpairment AND needs safety assistance |
| Commode | Bedside commode in bathroom equipment |
| Incontinence | IncontinencePresent = true |

##### 5.3 NUTRITION Rules (6 duties)

| Duty | Rule Logic |
|------|-----------|
| Prepare Breakfast/Lunch/Dinner | MealPrepPreference = true, OR fallback: food intake abnormal + CognitiveImpairment/lives alone. Count meals from service frequency |
| Prepare Snack | DiabetesPresent OR NutritionRisk |
| Assist with Feeding | **ONLY** if FeedingAssistSelected = true (explicit question, never inferred) |
| Record Food Intake | Tube feeding OR NPO OR appetite concerns OR DiabetesPresent |
| Record Fluid Intake | **ONLY** if FluidManagementCritical = true |
| Patient on Prescribed Diet | Medical/nutrient diet restrictions OR DiabetesPresent |

##### 5.4 ACTIVITIES Rules (5 duties)

| Duty | Rule Logic |
|------|-----------|
| Transferring | MobilityImpairment OR uses transfer equipment (Hoyer Lift) |
| Assist with Walking | BedboundFunctional = false AND (MobilityImpairment OR UsesAssistiveDevice OR HighFallRisk) |
| Patient walks with assistive devices | Any Mobility Equipment present in DME |
| Assist with HEP | Narrative contains "home exercise program" OR "HEP" OR "ROM exercises with HHA" (HHA Only) |
| Turning and Positioning | BedboundFunctional OR pressure areas OR active wounds |

##### 5.5 TREATMENT Rules (6 duties)

| Duty | Rule Logic |
|------|-----------|
| Empty foley bag | HasFoley = true (catheter) |
| Remind to take medication | MedCount >= 2 OR CognitiveImpairment |
| Ask Patient About Pain | **Always selected** (every visit) |
| Observe/Report | CognitiveImpairment OR mood issues OR neuro issues OR MSK OR cardio OR GI symptoms |
| Monitor Patient Safety | Environmental hazards OR disorientation OR lethargic OR vision/hearing impairment OR HighFallRisk OR BedboundFunctional |
| Ostomy/Catheter Care | HasOstomy OR HasCatheter |

##### 5.6 HOUSEHOLD Rules (5 duties)

| Duty | Rule Logic |
|------|-----------|
| Change Bed Linen | IncontinencePresent OR SkinRiskOrWounds OR BedboundFunctional OR HasFoley |
| Laundry | IncontinencePresent, OR (lives alone AND MobilityImpairment/SevereVisionImpairment/CognitiveImpairment) |
| Light Housekeeping | Unsafe environment, OR (lives alone AND MobilityImpairment/environmental hazards) |
| Shopping & Errands | ShoppingHelpPreference = true, OR fallback: lives alone AND MobilityImpairment/SevereVisionImpairment/CognitiveImpairment |
| Accompany to Appointment | EscortHelpPreference = true, OR fallback: SevereVisionImpairment/HearingImpairment/disoriented/wheelchair |

#### Section 6 — OUTPUT FORMAT (~35 lines)

The POC generation returns structured JSON (not just text):

```json
{
  "type": "POC",
  "result": {
    "items": [
      { "item": "Bath Shower", "attributes": { "type": "EveryVisit" }, "notes": null },
      { "item": "Remind to take medication", "attributes": { "type": "EveryVisit" }, "notes": null },
      { "item": "Shopping and Errands", "attributes": { "type": "OnDaysOfWeek" }, "notes": null },
      { "item": "Assist with home exercise program", "attributes": { "type": "AsRequestedByPatient" }, "notes": null }
    ],
    "specialInstructions": "text or N/A"
  }
}
```

The `attributes.type` field determines the frequency shown on mobile and PDF. Valid values: `"EveryVisit"`, `"OnDaysOfWeek"`, `"AsRequestedByPatient"`.

### 5.4 Answer Processing

Results are processed in `PatientDocumentAITextGenerationCtrl.ts:243`:
- `case "POC": answer = response.result.items` — the items array is extracted and saved to the `patient_documents_answer` table
- Special instructions are saved separately via `savePocSpecialInstructionsAnswer()`

### 5.5 Why a Rules Engine (Not Free-Form AI)

1. **Regulatory compliance** — POC duties must be clinically justified by PA findings
2. **Reproducibility** — Same PA answers should always produce same POC duties
3. **Auditability** — Every duty selection can be traced to a specific rule and PA finding
4. **Temperature 0** — Ensures deterministic output with no creative variation

---

## 6. AI Review System

> **Owner quote:** "The AI review is the most core aspect of our RN visit assessment app."

### 6.1 Overview

The AI Review System validates RN answers on the Patient Assessment form using 20 section-specific review rules. It operates at two levels:
1. **Per-section review** — validates answers WITHIN each section
2. **Cross-section review** — validates answers ACROSS sections for consistency

**Model:** `gpt-4.1-mini` at temperature 0 for all review rules.

### 6.2 When Reviews Run

Reviews run **both mid-form and at final submission**:
- **Mid-form (`createMidReviewRule`):** After each section is completed, AI reviews that section
- **Final (`createFinalReviewRule`):** At submission, all sections are reviewed together for cross-section consistency

### 6.3 Two Severity Levels

- **HARD rules** — Must be fixed before submission can proceed. Cannot be overridden.
- **SUGGESTED rules** — RN can override by providing a narrative explanation.

### 6.4 Narrative Override Mechanism

RN narratives from ANY section can suppress false-positive rejections. If the AI flags an inconsistency, but the RN has already written a narrative explaining the clinical reasoning, the review system checks narratives across ALL sections before rejecting.

### 6.5 The 20 Section Review Rules (Complete)

**Base path:** `patient-assessment/v10/review-rules/`

#### 6.5.1 Vital Signs Review (`vital-signs.review.v10.ts`)
**Type:** Final review

**HARD rules:**
- Temperature: 93.0–108.0°F range
- Blood Pressure: Systolic 60–260, Diastolic 30–160, Systolic > Diastolic
- Pulse: 30–180 bpm
- Respirations: 8–40 bpm

**Cross-checks (only if sections completed):**
- If Respiratory Support "Ventilator" → Respirations must be numeric and plausible
- If Cardiopulmonary has critical symptoms (Chest Pain/Syncope/Cyanosis/SOB) but all vitals normal → reject unless documented justification

**Output format:** Lists each question with GOOD/BAD status and explanations.

#### 6.5.2 Fall Risk Review (`fall-risk.review.v10.ts`)
**Type:** Final review

**HARD rules:**
- If Fall Risk Factors empty → Total Score = 0, Risk Level = "Low (Score 0-3)"
- Total Score must equal count of selected Fall Risk Factors
- Risk Level must match score: 0-3=Low, 4-6=Moderate, 7-10=High

**Cross-checks with other sections (only if present):**

| Risk Factor | Cross-Check Against |
|------------|-------------------|
| "Age 65+" | Verify patient age in demographics |
| "3+ medical diagnoses" | Count unique ICD codes in Diagnosis Information |
| "Taking 4+ medications" | Verify 4+ in Medication Profile |
| "Impaired balance/gait" | Verify MSK has gait abnormality OR justification narrative |
| "Visual Impairment" | Verify EENT has vision conditions (Visual Impairment/Glaucoma/Cataracts/Legally Blind/Discharge) |
| "Cognitive Impairment" | Verify Neuro has Disoriented/Forgetful/Delusions/Hallucinations/Memory Loss/Poor Insight |
| "Urinary frequency/incontinence" | Verify GU has "Incontinence" |
| "Use of assistive device" | Verify DME has Cane/Quad Cane/Walker/Wheelchair |
| "Environmental hazards present" | Verify Environment/Safety has at least one hazard (not "None") |

**Teaching Provided check:** Must match Fall Risk findings; if empty/low → Teaching must be "N/A"

#### 6.5.3 Diagnosis Information Review (`diagnosis-info.review.v10.ts`)
**Type:** Mid review (triggered during document generation)

**HARD rules:**
- ICD code format validation
- No duplicate ICD codes (same code, type, description)

**Cross-checks:**
- Every medication in Medication Profile must have supporting diagnosis
- Every significant symptom/abnormal finding must have corresponding diagnosis code
- Disease-to-symptom mapping: Diabetes, CHF, COPD, Dementia diagnoses must be reflected in assessment findings/symptoms/medications
- DME equipment (oxygen, wound supplies, glucometer) must have justifying diagnosis
- Wounds/pressure injuries/stroke/hypoglycemia/chest pain/neuro impairment must have diagnosis support
- Diet restrictions must have corresponding diagnosis (cardiac/renal/diabetes)
- **Missing-findings rule:** Every listed diagnosis must have corresponding finding in assessment or supportive medication

#### 6.5.4 Emergency & Advance Directives Review (`emergency.review.v10.ts`)
**Type:** Mid review

Enforces internal structural consistency:
- Local emergency contact completeness
- Primary physician presence
- Emergency Plan Discussed vs Emergency Preparedness items consistency
- Uses global RN narratives for edge case resolution

#### 6.5.5 Medications Review (`medications.review.v10.ts`)
**Type:** Review

**7 Disease Cluster Validations:**

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

**Medication-specific side effect validation** for 12 high-risk drugs:
Warfarin, Apixaban, Rivaroxaban, Insulin, Lisinopril, Amlodipine, Metformin, Aspirin, Furosemide, Gabapentin, Donepezil, Levothyroxine

#### 6.5.6 Cardiopulmonary Review (`cardiopulmonary.review.v10.ts`)
**Type:** Review
- Validates cardio symptom → diagnosis consistency
- Respiratory support equipment → diagnosis match
- Vital signs ↔ cardio findings cross-check

#### 6.5.7 Neurological Review (`neurological.review.v10.ts`)
**Type:** Review
- LOC → Orientation consistency (Comatose can't be oriented)
- Neuro symptoms → diagnosis match
- Mood/behavior → medication cross-reference

#### 6.5.8 Musculoskeletal Review (`musculoskeletal.review.v10.ts`)
**Type:** Review
- MSK symptoms → DME consistency (wheelchair should have mobility diagnosis)
- Amputation → diagnosis cross-check
- Gait abnormality → fall risk cross-check

#### 6.5.9 EENT Review (`eent.review.v10.ts`)
**Type:** Review
- Vision findings → diagnosis consistency
- Hearing findings → fall risk "Visual Impairment" factor
- Speech → diagnosis (stroke, aphasia)

#### 6.5.10 Pain Review (`pain.review.v10.ts`)
**Type:** Review
- Pain present → must have pain description, location, intensity
- Pain medications → pain findings consistency
- Teaching provided appropriateness

#### 6.5.11 GI/GU/Reproductive Review (`gi-gu-reproductive.review.v10.ts`)
**Type:** Review
- Incontinence → fall risk factor, supplies
- Ostomy/catheter → diagnosis support
- GI symptoms → nutrition assessment consistency

#### 6.5.12 IHE Review (`ihe.review.v10.ts`)
**Type:** Review
- Wound findings → wound assessment completeness
- Diabetes → endocrine findings
- Skin conditions → diagnosis codes

#### 6.5.13 Allergies & Nutritional Review (`allergiesAndNutritional.review.v10.ts`)
**Type:** Review
- Allergy ↔ medication conflict check
- Diet restrictions ↔ diagnosis
- Nutritional risk ↔ assessment findings

#### 6.5.14 DME Review (`dme.review.v10.ts`)
**Type:** Review
- DME equipment → diagnosis justification
- Oxygen → respiratory diagnosis
- Mobility aids → MSK/neuro findings

#### 6.5.15 Environment/Safety Review (`environment-safety.review.v10.ts`)
**Type:** Review
- Hazards → fall risk factor "Environmental hazards"
- Living arrangement → safety measures

#### 6.5.16 Immunization Review (`immunization.review.v10.ts`)
**Type:** Review
- Immunization status completeness
- Teaching provided appropriateness

#### 6.5.17 Functional Limitations Review (`functionalLimitations.review.v10.ts`)
**Type:** Review
- Selected limitations → assessment findings consistency
- "None" → verify no contradicting findings

#### 6.5.18 Activities Permitted Review (`activitiesPermitted.review.v10.ts`)
**Type:** Review
- Complete Bedrest → LOC must be Comatose
- No Restrictions → verify no impairments
- Equipment → matching activities

#### 6.5.19 Safety Measures Review (`safety-measures.review.v10.ts`)
**Type:** Review
- Selected measures → assessment findings consistency
- Missing measures for present conditions

#### 6.5.20 Standalone Questions Review (`standaloneQuestions.review.v10.ts`)
**Type:** Review
- POC standalone preferences → assessment consistency
- Patient capability statements → functional assessment

### 6.6 Cross-Section Validation Summary

The review system enforces 4 major categories of cross-section checks:

1. **Diagnosis ↔ Findings** — Every diagnosis must have supporting findings; every significant finding must have a diagnosis
2. **Diagnosis ↔ Medications** — Medications must have corresponding diagnoses (7 disease clusters)
3. **Diagnosis ↔ DME** — Equipment must have justifying diagnosis
4. **Findings ↔ Findings** — Cross-section consistency (e.g., fall risk factors vs actual section findings)

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

**File:** `cms485DocumentToPayload.ts` (lines 1004-1044)

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

## 10. Complete Rule File Inventory

### 10.1 Patient Assessment v10 — AI Generation Rules (36 files)

**Base path:** `patient-assessment/v10/rules/`

| Subdirectory | Files | Purpose |
|-------------|-------|---------|
| `activitiesPermitted/` | `activitiesPermitted.rule.v10.ts`, `activitiesPermittedTeachingProvided.rule.v10.ts` | Activities Permitted + teaching |
| `cardiopulmonary/` | `cardiopulmonary.icdCodes.rule.v10.ts`, `cardiopulmonaryTeachingProvided.rule.v10.ts` | Cardio ICD + teaching |
| `diagnosis/` | `final.icdCodes.rule.v10.ts`, `final.icdCodes.principal.rule.v10.ts` | Final ICD consolidation |
| `dme-and-supplies/` | `dmeTeachingProvided.rule.v10.ts` | DME teaching |
| `eent/` | `eent.icdCodes.rule.v10.ts`, `eentTeachingProvided.rule.v10.ts` | EENT ICD + teaching |
| `emergency/` | `emergencyTeachingProvided.rule.v10.ts` | Emergency teaching |
| `environment-safety/` | `evironmentSafetyTeachingProvided.rule.v10.ts` | Environment teaching |
| `fall-risk/` | `fallRiskFactor.ts`, `fallRiskLevel.ts`, `fallRiskScore.ts`, `fallRiskTeachingProvided.rule.v10.ts` | Fall risk calc + teaching |
| `functional-limitations/` | `functionalLimitations.rule.v10.ts` | 738-line rules engine |
| `gi-gu-reproductive/` | `giGuReproductive.icdCodes.rule.v10.ts`, `giGuReproductiveTeachingProvided.rule.v10.ts` | GI/GU ICD + teaching |
| `ihe/` | `ihe.icdCodes.rule.v10.ts`, `iheTeachingProvided.rule.v10.ts` | IHE ICD + teaching |
| `immunization/` | `immunizationTeachingProvided.rule.v10.ts` | Immunization teaching |
| `medicalHistory/` | `medicalHistory.icdCodes.rule.v10.ts` | Medical history ICD |
| `medications/` | `medicationsTeachingProvided.rule.v10.ts` | Medication teaching |
| `musculoskeletal/` | `musculoskeletal.icdCodes.rule.v10.ts`, `musculoskeletalTeachingProvided.rule.v10.ts` | MSK ICD + teaching |
| `neurological/` | `neurological.icdCodes.rule.v10.ts`, `neurologicalTeachingProvided.rule.v10.ts` | Neuro ICD + teaching |
| `nutritional/` | `nutritionalTeachingProvided.rule.v10.ts` | Nutritional teaching |
| `pain/` | `pain.icdCodes.rule.v10.ts`, `painTeachingProvided.rule.v10.ts` | Pain ICD + teaching |
| `progress-note/` | `progressNote.rule.v10.ts` | Progress note narrative |
| `safety-measures/` | `safetyMeasures.rule.v10.ts`, `safetyMeasuresTeachingProvided.rule.v10.ts` | Safety measures + teaching |
| `summary/` | `prognosis.rule.v10.ts` | Prognosis decision tree |
| `visit-info/` | `priorityCode.rule.v10.ts`, `talStatus.rule.v10.ts` | Priority + TAL |

### 10.2 Patient Assessment v10 — Review Rules (20 files)

**Base path:** `patient-assessment/v10/review-rules/`

| File | Section | Type |
|------|---------|------|
| `activitiesPermitted.review.v10.ts` | Activities Permitted | Final |
| `allergiesAndNutritional.review.v10.ts` | Allergies & Nutritional | Final |
| `cardiopulmonary.review.v10.ts` | Cardiopulmonary | Final |
| `diagnosis-info.review.v10.ts` | Diagnosis Information | Mid |
| `dme.review.v10.ts` | DME & Supplies | Final |
| `eent.review.v10.ts` | EENT | Final |
| `emergency.review.v10.ts` | Emergency | Mid |
| `environment-safety.review.v10.ts` | Environment/Safety | Final |
| `fall-risk.review.v10.ts` | Fall Risk | Final |
| `functionalLimitations.review.v10.ts` | Functional Limitations | Final |
| `gi-gu-reproductive.review.v10.ts` | GI/GU/Reproductive | Final |
| `ihe.review.v10.ts` | IHE | Final |
| `immunization.review.v10.ts` | Immunization | Final |
| `medications.review.v10.ts` | Medications | Final |
| `musculoskeletal.review.v10.ts` | Musculoskeletal | Final |
| `neurological.review.v10.ts` | Neurological | Final |
| `pain.review.v10.ts` | Pain | Final |
| `safety-measures.review.v10.ts` | Safety Measures | Final |
| `standaloneQuestions.review.v10.ts` | Standalone Questions | Final |
| `vital-signs.review.v10.ts` | Vital Signs | Final |

### 10.3 Plan of Care v7 — Rules (2 files)

| File | Purpose |
|------|---------|
| `planOfCare.rule.v7.ts` | 754-line POC rules engine |
| `planOfCate.items.v7.ts` | POC duty items data mapping |

### 10.4 Version History

| Version | Generation Rules | Review Rules | Notes |
|---------|-----------------|-------------|-------|
| v4 | 31 | 5 | Limited review coverage |
| v5 | 75 | 16 | Major expansion |
| v6 | 30 | 16 | Consolidation |
| v7 | — | 16 | Review rules only |
| v8 | 37 | 16 | Incremental |
| v9 | 36 | 16 | Pre-current |
| **v10** | **36** | **20** | **Current — full coverage** |

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

---

## 12. Key Code Locations

| File | Purpose |
|------|---------|
| `taskhealth_server2/src/modules/patient_documents/html/patient-assessment/v10/rules/` | All 36 AI generation rule files |
| `taskhealth_server2/src/modules/patient_documents/html/patient-assessment/v10/review-rules/` | All 20 AI review rule files |
| `taskhealth_server2/src/modules/patient_documents/html/plan-of-care/v7/rules/planOfCare.rule.v7.ts` | POC rules engine (754 lines) |
| `taskhealth_server2/src/modules/patient_documents/html/plan-of-care/v7/rules/planOfCate.items.v7.ts` | POC duty items definition |
| `taskhealth_server2/src/modules/pdf_templates/templates/cms485/cms485DocumentToPayload.ts` | CMS-485 answer-to-PDF field mapper |
| `taskhealth_server2/src/modules/pdf_templates/templates/cms485/cms485Template.ts` | CMS-485 PDF field definitions |
| `taskhealth_server2/src/modules/nursing_database_question/controllers/NursingQuestionCtrl.ts` | Nursing database question controller (1,684 lines) |
| `taskhealth_server2/src/modules/nursing_database_question/controllers/NursingQuestionConsts.ts` | Predefined nursing question constants |
| `taskhealth_server2/src/modules/patient_documents/controllers/RegenerateOtherDocsCtrl.ts` | Cross-document answer propagation |
