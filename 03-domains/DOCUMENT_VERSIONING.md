# Document Versioning

> How document templates are versioned, when versions get locked, the two-layer versioning system, and critical development considerations.

---

## 1. Overview

Document versioning is one of the most complex and bug-prone areas of the Task Health platform. Every document template (Patient Assessment, POC, CMS-485, etc.) can have multiple versions. When a new version is published, existing in-progress work must be protected from changes.

### Why Versioning Exists

**The core problem:** An RN starts filling a 200-question Patient Assessment on Monday, saves 150 answers, and comes back Wednesday. If the admin published a new template version on Tuesday (adding/removing/renaming questions), the RN's saved answers would be corrupted — orphaned answers, broken AI rules, mismatched cross-document links.

**The solution:** Snapshot-based versioning. Once an RN touches a document, the version is frozen. The admin can publish new versions freely — they only affect future tasks, never in-progress work.

### Key Principle

**Versioning protects mid-fill stability.** It is NOT about controlling which version a task gets at creation time. The version locks at the moment of first interaction, because that's when there are saved answers to protect.

---

## 2. Database Schema

### 2.1 `patient_documents_types` — Document Type Registry

One row per document type (e.g., "Patient Assessment", "Plan of Care"). No version info here.

| Column | Type | Purpose |
|--------|------|---------|
| id | SERIAL PK | Document type ID |
| title | TEXT | Display name |
| type | TEXT | Type classifier |
| agency | INT FK → agency(id) | Owning agency |
| createdAt / removedAt / updatedAt | TIMESTAMPTZ | Lifecycle |

### 2.2 `patient_documents_types_versions` — Version History

Multiple versions per document type. This is the core versioning table.

| Column | Type | Purpose |
|--------|------|---------|
| id | SERIAL PK | Version ID (higher = newer) |
| patientDocumentTypeId | INT FK → patient_documents_types(id) | Parent document type |
| content | JSONB | **Complete form structure** — all questions, options, layout, settings |
| isPublished | BOOLEAN (default FALSE) | Can new tasks use this version? |
| html_template_version_id | INT | Links to TypeScript adapter code version (v1, v2...v10) |
| createdAt / removedAt / updatedAt | TIMESTAMPTZ | Lifecycle |

**Key behaviors:**
- `isPublished = FALSE` → draft, only visible in form builder
- `isPublished = TRUE` → available for new tasks
- `ORDER BY id DESC LIMIT 1` where `isPublished = TRUE` → current version for new tasks
- Old published versions are never deleted — they remain for in-progress tasks

### 2.3 `patient_documents_scheduled` — Document Instance (Where Version Gets Locked)

Each row represents a specific document instance for a specific task/visit. **This is where the version gets frozen.**

| Column | Type | Purpose |
|--------|------|---------|
| id | SERIAL PK | Scheduled document ID |
| patient_document_type_id | INT FK | Document type |
| **version_id** | **INT FK → patient_documents_types_versions(id)** | **THE LOCKED VERSION** |
| task_instance_id | INT FK | Associated task instance |
| visit_instance_id | INT FK | Associated visit instance |
| caregiver_id | INT FK (nullable) | RN filling the document |
| patient_id | INT FK | Patient |
| agency_member_id | INT FK | Agency member (for agency submissions) |
| created_at / submitted_at / approved_at | TIMESTAMPTZ | Lifecycle |
| file_url | TEXT | Generated PDF URL |
| document_scanned | BOOLEAN | Whether this is a free-form scan |
| removed_at | TIMESTAMPTZ | Soft delete |

**Unique constraint:** `(caregiverId, patientDocumentTypeId, versionId, task_instance_id)` — one document instance per caregiver per type per version per task.

**Note:** `version_id` is nullable (since V0283). When null, the system falls back to the latest published version via the `visit_instance_current_patient_document` SQL view using `COALESCE`.

### 2.4 `patient_task_instance_document` — Task-to-Document-Type Link

Links task instances to document TYPES (not versions). Created at task creation time.

| Column | Type | Purpose |
|--------|------|---------|
| task_instance_id | INT FK | Task instance |
| document_id | INT FK → patient_documents_types(id) | Document TYPE (not version) |
| generation_dependent_document_type_ids | JSONB | Which other doc types must be submitted before this one can generate |

**Critical:** This table has NO version column. Versions are resolved later, at first interaction.

---

## 3. Version Selection Logic

### 3.1 The Core Function

**File:** `PatientDocumentsCtrl.ts:2176-2197`

```typescript
async function getCurrentPatientDocumentVersion(
    conn, documentTypeId
): Promise<PatientDocumentVersionId> {
    const versionId = await conn.queryOneOrNone(conn.sql`
        SELECT id FROM patient_documents_types_versions
        WHERE "patientDocumentTypeId" = ${documentTypeId}
          AND "isPublished" = TRUE
        ORDER BY id DESC
        LIMIT 1
    `);
    if (versionId === null) throw new Router.StatusError(400);
    return versionId.id.val();
}
```

**Logic:** Highest published version ID wins. No date-based selection, no agency-specific overrides — simply the newest published version.

### 3.2 SQL View for Fallback

**File:** `patient_documents_views.ts`

```sql
-- latest_patient_document_version view
SELECT patient_documents_types.id AS patient_document_type_id,
       latest.id AS patient_document_version_id,
       latest.content AS patient_document_content
FROM patient_documents_types
JOIN LATERAL (
    SELECT id, content FROM patient_documents_types_versions
    WHERE patientDocumentTypeId = patient_documents_types.id
      AND isPublished IS TRUE
      AND removedAt IS NULL
    ORDER BY id DESC LIMIT 1
) AS latest ON TRUE
```

```sql
-- visit_instance_current_patient_document view
SELECT ...
    COALESCE(
        patient_documents_scheduled.version_id,
        latest_patient_document_version.patient_document_version_id
    ) AS version_id
FROM patient_documents_scheduled ...
```

**Fallback strategy:** If `version_id` is null on `patient_documents_scheduled`, use latest published version. This means some older records auto-upgrade silently.

---

## 4. The Version Locking Timeline

### 4.1 What Happens at Each Step

```
STEP 1: TASK CREATION (Agency broadcasts / Admin creates task)
├─ patient_task_instance created
├─ patient_task_instance_document rows created
│   └─ Stores document TYPE IDs only — NO version info
├─ Version: NOT LOCKED YET
└─ The task knows WHICH documents it needs, not which versions

STEP 2: RN ACCEPTS BROADCAST
├─ caregiver_id set on task instance
├─ Version: STILL NOT LOCKED
└─ No document rows created yet

STEP 3: RN OPENS DOCUMENT ON MOBILE (First Touch)
├─ findOrCreateScheduledDocIdTask() called
├─ Checks: does patient_documents_scheduled row exist for this task+docType?
│   ├─ YES → return existing (version already locked from previous touch)
│   └─ NO → getCurrentPatientDocumentVersion() called
│           └─ Gets highest isPublished=TRUE version at THIS moment
│           └─ Creates patient_documents_scheduled row with version_id locked
├─ Version: *** LOCKED NOW ***
└─ From this point, this document instance is frozen to this version

STEP 4: RN FILLS FORM, SAVES ANSWERS
├─ All answers stored against this scheduled doc ID
├─ AI rules for THIS version run
├─ Version: LOCKED (same as step 3)

STEP 5: ADMIN PUBLISHES NEW VERSION (can happen at any time)
├─ New patient_documents_types_versions row with isPublished=TRUE
├─ In-progress documents: UNAFFECTED (their version_id already frozen)
├─ Future documents: will get the new version at their first touch
```

### 4.2 Why Lazy Locking (Not at Task Creation)

The system uses lazy initialization — the version locks at first touch, not at task creation. This is because:

1. **At task creation, there's no `patient_documents_scheduled` row** — the table that holds `version_id` only gets populated when someone interacts with the document
2. **The RN isn't assigned yet** — tasks are broadcast first, assigned later. The `caregiver_id` is part of the unique constraint
3. **Nothing to protect before first touch** — there are no saved answers to corrupt until someone starts filling

**Consequence:** A task created on Monday might get v9 or v10 depending on when the RN first opens the form, not when the task was created.

### 4.3 Parallel Versions Running Simultaneously

At any given time, multiple versions of the same document can be active across different tasks:

```
Task A: RN opened form Jan 5 → locked to v9
Task B: RN opened form Jan 12 → locked to v10
Task C: RN opened form Jan 20 → locked to v10
Task D: RN opened form Feb 1 → locked to v11

All four tasks may be active simultaneously.
Each uses its own version's form structure, AI rules, and PDF adapter.
```

**There is NO mechanism to force-upgrade in-progress tasks to a new version.** There is NO cleanup or expiration logic for old-version tasks. Tasks on old versions remain on those versions until completed or manually removed.

---

## 5. Two-Layer Versioning System

This is the most critical thing to understand. There are TWO independent version systems:

### Layer 1: Database Content Version

| Aspect | Details |
|--------|---------|
| **What it is** | The `content` JSONB column in `patient_documents_types_versions` |
| **Who creates it** | Admin, via the Form Builder UI |
| **What it contains** | Complete form structure: questions, answer options, display settings, conditional visibility, question types, database question links |
| **How it's versioned** | Auto-increment ID, `isPublished` flag |
| **Can change without code deploy** | YES — admin can edit form builder and publish |

### Layer 2: Code/HTML Adapter Version

| Aspect | Details |
|--------|---------|
| **What it is** | TypeScript adapter folders (`v1/`, `v2/`...`v10/`) with adapters, sections, AI rules, review rules |
| **Who creates it** | Developers, via code changes |
| **What it contains** | HTML rendering logic, section definitions, AI generation rules (36 files), AI review rules (20 files), PDF adapters |
| **How it's versioned** | Folder-based (`patient-assessment/v10/`), linked via `html_template_version_id` |
| **Can change without form builder edit** | YES — developers can deploy new code version independently |

### The Link Between Layers

```
patient_documents_types_versions.html_template_version_id
    → maps to → code folder version number (1, 2, 3...10)
    → selects → the TypeScript adapter, AI rules, review rules for rendering
```

### Code-Side Version Registries

**File:** `patient-assessment/index.ts`
```typescript
export const patientAssessmentDocumentAdapterVersions: Record<number, DocumentFillerFn> = {
    1: convertPatientAssessmentDocToHtmlTemplateV1,
    2: convertPatientAssessmentDocToHtmlTemplateV2,
    // ... through V10
};

export const patientAssessmentDocumentGenerationRules = {
    4: patientAssessmentV4GenerationRules,
    5: patientAssessmentV5GenerationRules,
    // ... through V10 (v1-v3 had no AI rules)
};
```

**File:** `plan-of-care/index.ts`
```typescript
export const planOfCareDocumentAdapterVersions: Record<number, DocumentFillerFn> = {
    1: convertPlanOfCareDocToHtmlTemplateV1,
    // ... through V7
};

export const planOfCareDocumentGenerationRules = {
    3: planOfCareV3Rules,
    4: planOfCareV3Rules,  // v4 reuses v3 rules
    5: planOfCareV5Rules,
    6: planOfCareV6Rules,
    7: planOfCareV7Rules
};
```

### Current Version Counts

| Document Type | Content Versions | Code Adapter Versions | AI Generation Rule Versions | Review Rule Versions |
|--------------|-----------------|----------------------|---------------------------|---------------------|
| Patient Assessment | Many (DB-managed) | 10 (v1–v10) | 7 (v4–v10) | 7 (v4–v10, growing from 5→20 rules) |
| Plan of Care | Many (DB-managed) | 7 (v1–v7) | 5 (v3–v7) | None |
| Emergency Kardex | Many (DB-managed) | 7 (v1–v7) | None | None |
| Welcome Package | Many (DB-managed) | 2 (v1–v2) | None | None |
| Paraprofessional Supervisory | Many (DB-managed) | 2 (v1–v2) | None | None |

---

## 6. Form Builder Version Workflow

### Creating a New Version (Admin)

**File:** `PatientDocumentsCtrl.ts:715-788` — `createOrUpdatePatientDocumentVersion()`

1. Admin opens form builder, edits questions
2. System checks for existing unpublished (draft) version
3. **If no draft exists:** Creates new `patient_documents_types_versions` row with `isPublished = FALSE`
4. **If draft exists:** Updates existing draft's `content` JSONB
5. Admin clicks "Publish":
   - Sets `isPublished = TRUE` on the draft
   - Also marks any older unpublished versions as published (cleanup)
6. New tasks that haven't been touched yet will now get this version

### Publishing Does NOT Affect In-Progress Work

```sql
-- This is all that happens on publish:
UPDATE patient_documents_types_versions
SET isPublished = TRUE
WHERE id = {new_version_id};
```

No migration, no conversion, no notification. Existing `patient_documents_scheduled` rows are untouched.

---

## 7. AI Prompt Versioning (Separate System)

AI text generation prompts have their own versioning:

**Table:** `patient_document_ai_text_generation_prompt`

| Column | Type | Purpose |
|--------|------|---------|
| id | SERIAL PK | |
| ai_generation_type | TEXT | e.g., 'PATIENT_ASSESSMENT_PROGRESS_NOTE' |
| prompt | TEXT | The actual prompt text |
| version_number | INT (default 1) | Incremental version |
| created_at | TIMESTAMPTZ | |
| created_by | INT FK → user(id) | |

**Unique constraint:** `(ai_generation_type, version_number)`

**Immutability enforced by trigger:** `prevent_prompt_updates()` — once a prompt version is created, it cannot be modified. You must create a new version.

---

## 8. Development Considerations — CRITICAL

### 8.1 When Updating Form Structure (Form Builder)

**Before publishing a new form version:**

- [ ] Verify `html_template_version_id` points to a code version that supports the new questions
- [ ] If you added/removed/renamed questions, a NEW code version may be needed
- [ ] Check `nursingQuestionLinked` references — do cross-document links still resolve?
- [ ] Check `htmlTemplateId` values — do AI generation rules reference all the right IDs?
- [ ] Check conditional visibility (`Show if parent answer is`) — do parent question IDs still exist?

**After publishing:**

- [ ] Test with a NEW task (gets new version)
- [ ] Verify existing in-progress tasks still work on the old version
- [ ] Check PDF generation for both old and new versions

### 8.2 When Updating Code (AI Rules, Adapters, Review Rules)

**Critical rule: NEVER modify an existing version's code if tasks are active on that version.**

If you need to fix a bug in v9's AI rules:
- You CANNOT simply edit the v9 files — this could break in-progress v9 tasks that have already generated AI answers based on the old rules
- The safe approach: fix it in v10 (or create v10 with the fix), and accept that v9 tasks keep the old behavior
- If the bug is critical and v9 tasks MUST be fixed: you need to carefully verify that the fix doesn't invalidate any saved answers or generated content

**When creating a new code version (e.g., v11):**

- [ ] Copy the previous version's folder as a starting point
- [ ] Update the version registry in `index.ts` (add `11: convertPatientAssessmentDocToHtmlTemplateV11`)
- [ ] Update generation rules registry (add `11: patientAssessmentV11GenerationRules`)
- [ ] Update review rules registry
- [ ] Update `html_template_version_id` on the new DB version to point to the new code version
- [ ] Test all AI generation rules with the new form structure
- [ ] Test all review rules with the new form structure
- [ ] Test PDF generation with the new adapter

### 8.3 Two-Layer Mismatch Bugs (Most Common Source of Issues)

The most dangerous bugs come from the two layers being out of sync:

| Scenario | What Breaks | How to Detect |
|----------|------------|--------------|
| Form builder adds question, code not updated | New question not rendered on PDF, AI rules don't see it | PDF missing fields, AI gives incomplete results |
| Form builder removes question, code still references it | Adapter/rules crash on missing data | Runtime errors, null reference exceptions |
| Form builder renames answer option (e.g., "Gait Abnormality" → "Abnormal Gait") | AI rules don't match the new string, rules fail silently | AI generates wrong results (silent failure — hardest to detect) |
| Code version updated, form builder not published | New code logic runs against old form structure | May work (if backwards compatible) or break |
| `html_template_version_id` points to wrong code version | Rendering uses wrong adapter, wrong AI rules | Visual bugs on PDF, wrong AI behavior |

### 8.4 Cross-Document Version Compatibility

When the Patient Assessment version changes, it can affect ALL downstream documents:

```
Patient Assessment v10
    ├─ nursingQuestionLinked → POC (values flow to POC fields)
    ├─ nursingQuestionLinked → CMS-485 (values flow to CMS fields)
    ├─ nursingQuestionLinked → Emergency Kardex
    ├─ nursingQuestionLinked → Welcome Package
    └─ AI-generated invisible fields → CMS-485 (Functional Limitations, Activities Permitted, etc.)
```

**If PA v10 changes the answer format for a linked question, ALL downstream documents that consume that linked value may break — even if those documents haven't changed versions themselves.**

Checklist when changing PA version:
- [ ] Check all 61 `DatabaseLinkType` values — do they still resolve?
- [ ] Check `NursingQuestionConsts.ts` — do hardcoded question IDs still exist?
- [ ] Check CMS-485 field mapping (`cms485DocumentToPayload.ts`) — do semantic field names still work?
- [ ] Check POC standalone questions — do they still feed into the POC rules engine correctly?
- [ ] Check Supervisory Visit mapping (`poc-to-supervisory-mapping.v2.ts`) — does duty list still align?

### 8.5 Version Cleanup / End-of-Life

**There is currently NO mechanism for:**
- Forcing in-progress tasks to upgrade to a new version
- Expiring old versions after a certain time
- Detecting how many active tasks are on each version
- Preventing a version from being used by new tasks (short of soft-deleting it)

**To check how many tasks are on each version:**
```sql
SELECT version_id, COUNT(*) as active_tasks
FROM patient_documents_scheduled
WHERE submitted_at IS NULL AND removed_at IS NULL
GROUP BY version_id
ORDER BY version_id;
```

**To prevent new tasks from getting an old version:** Ensure a newer version is published. The system always picks the highest published ID.

### 8.6 Nullable version_id Edge Case

Some older `patient_documents_scheduled` rows have `version_id = NULL` (from before versioning was enforced). These fall back to the latest published version via `COALESCE` in the SQL view. This means:

- They silently auto-upgrade every time a new version is published
- Their form structure can change unexpectedly
- If saved answers reference questions that don't exist in the new version, they become orphaned

**This only affects very old records.** Newer records always have `version_id` set.

---

## 9. Key Code Locations

| File | Purpose |
|------|---------|
| `sql/migrations/V0163__PatientDocuments.sql` | Core schema: document types and versions tables |
| `sql/migrations/V0283__add_columns_to_patient_documents_scheduled_visit.sql` | Made version_id nullable, added constraints |
| `sql/migrations/V0504__patient_tasks.sql` | Added unique constraint on (caregiver, docType, version, task) |
| `sql/migrations/V0752__alter_patient_document_scheduled.sql` | Table restructuring, column renames |
| `sql/migrations/V1435__patient_document_html_version_id.sql` | Added html_template_version_id column |
| `src/modules/patient_documents/controllers/PatientDocumentsCtrl.ts` | `getCurrentPatientDocumentVersion()`, `findOrCreateScheduledDocId()`, `createOrUpdatePatientDocumentVersion()` |
| `src/modules/patient_documents/sql_views/patient_documents_views.ts` | `latest_patient_document_version` view, `visit_instance_current_patient_document` view |
| `src/modules/patient_documents/html/patient-assessment/index.ts` | PA adapter version registry + generation rules registry |
| `src/modules/patient_documents/html/plan-of-care/index.ts` | POC adapter version registry + generation rules registry |
| `src/modules/patient_documents/html/{type}/v{N}/adapter.ts` | Per-version rendering adapter |
| `src/modules/patient_documents/html/{type}/v{N}/rules/` | Per-version AI generation rules |
| `src/modules/patient_documents/html/{type}/v{N}/review-rules/` | Per-version AI review rules |
| `src/modules/patient_task/controllers/PatientTaskCtrl.ts` | Task instance creation, document type linking (no version) |

---

## 10. Summary Decision Matrix

| I want to... | What to do | Risk level |
|-------------|-----------|------------|
| Fix a typo in a question label | Edit in form builder, publish new version | Low — but verify AI rules don't string-match the old label |
| Add a new question to PA | Edit form builder + likely need new code version with updated adapter/rules | Medium — cross-document impact |
| Remove a question from PA | Edit form builder + need new code version | High — check all nursingQuestionLinked, AI rules, PDF mappings |
| Fix an AI rule bug | Create new code version, publish new DB version pointing to it | Medium — old tasks keep the bug |
| Change answer option text | Edit form builder + update all AI rules that string-match the option | **Critical — silent failures if any rule misses the rename** |
| Update PDF layout | Update adapter in code version | Low — if form structure unchanged |
| Rename a DatabaseLinkType | Update in code + check ALL downstream documents | **Critical — can break cross-document flow** |
