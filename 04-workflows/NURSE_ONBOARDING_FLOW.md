# Nurse Onboarding Flow

> RN recruitment → application → onboarding → credentialing → first assignment.

---

## 1. Trigger

New RN discovers Task Health through:
- Recruitment website (`taskhealth-rn` repo)
- Facebook ads / referral links
- Word of mouth from existing RNs

---

## 2. Step-by-Step Flow

### Step 1: RN Applies via Recruitment Site

**Repo:** `taskhealth-rn` (React recruitment website)

**What happens:**
1. RN visits the recruitment landing page
2. Fills out basic application: name, phone, email, certifications, languages, location
3. Application submitted → creates initial `caregiver` record with status tracking
4. Landing page data stored in `landing_page_onboarding_caregiver_data` and `landing_page_onboarding_caregiver_certification`

### Step 2: HR Application Process

**Repo:** `taskhealth_server2` (HR infrastructure from V0068)

**Tables involved:**
- `hr_application_section` → `hr_application_subsection` → `hr_application_question_group` → `hr_application_question`
- `hr_application_caregiver_answer` (per agency, per caregiver, per question)
- `hr_application_agency_question_settings` (per-agency overrides for mandatory/visibility)
- `hr_application_agency_document_settings` (per-agency document requirements)

**What happens:**
1. RN completes multi-section application form
2. Sections progress through HR stages tracked in `hr_section_stage`
3. Document uploads required (licenses, certifications, ID, etc.) stored via `hr_document`
4. Each document has a type (`hr_document_type`) with expiration tracking

### Step 3: Credentialing & Compliance

**What happens:**
1. Task Health admin reviews submitted documents
2. Certifications verified against `CaregiverCertification` enum (40+ types)
3. Background checks and exclusion checks:
   - `caregiver_exclusions` — federal/state exclusion list checks
   - `caregiver_exclusion_fetched_data_source` — data source tracking
4. Compliance items tracked in `caregiver_compliance_instance` with field-level answers
5. Admin approves or requests additional documents

### Step 4: Profile Activation

**What happens:**
1. Admin sets `caregiver_agency_assoc.status` to active for the RN's agencies
2. RN's profile is now complete:
   - Certifications verified
   - Languages set (for matching)
   - Address + GPS location set (for distance matching)
   - Phone number(s) in `caregiver_phonenumber`
3. RN can now download and log into the mobile app (`com.taskshealth.app`)

### Step 5: First Assignment

**What happens:**
1. RN's mobile app starts receiving task broadcasts (via FCM push + Socket.IO)
2. Broadcasting matches based on:
   - Certification match (RN cert ∈ template's `allowed_certifications`)
   - Language match (RN speaks at least one patient language)
   - Distance match (RN within `broadcast_distance` of patient, default 40 miles)
3. RN accepts a broadcast → enters the SOC/Reassessment flow (see [START_OF_CARE_FLOW.md](START_OF_CARE_FLOW.md))

---

## 3. Tables Touched

| Table | Operation | Step |
|-------|-----------|------|
| caregiver | INSERT, UPDATE | 1, 4 |
| user | INSERT | 1 |
| caregiver_phonenumber | INSERT | 1 |
| caregiver_agency_assoc | INSERT, UPDATE | 1, 4 |
| landing_page_onboarding_caregiver_data | INSERT | 1 |
| landing_page_onboarding_caregiver_certification | INSERT | 1 |
| hr_application_caregiver_answer | INSERT | 2 |
| hr_document | INSERT | 2 |
| caregiver_compliance_instance | INSERT, UPDATE | 3 |
| caregiver_exclusions | INSERT | 3 |
| user_fcm_registration_token | INSERT | 5 |

---

## 4. Key Repos

| Repo | Role |
|------|------|
| `taskhealth-rn` | RN recruitment website (React) |
| `taskhealth_server2` | Backend HR infrastructure, compliance, caregiver management |
| `taskhealth-mobile2` | RN mobile app (onboarded RNs use this) |
| `taskhealth-serverless` | Background jobs for compliance checks |

---

## 5. Areas Still Open

- [ ] Detailed onboarding engagement flow (`onboarding_caregiver_engagement_*` tables — 15+ tables for automated follow-ups)
- [ ] Mock visit flow (`onboarding_mock_visit`, `onboarding_mock_visit_instance`)
- [ ] Driver's license / passport / SSN validation flows
- [ ] Interview scheduling (`caregiver_interview_meeting`, `caregiver_interview_link`)
- [ ] Selfie comparison for identity verification (`onboarding_caregiver_selfie_comparison`)
