# Users & Auth

> Three user types, auth per platform, caregiver entity, certifications, RN eligibility matching.

---

## 1. Overview

Task Health has three user types across four platforms:

| User Type | Platform | URL/App |
|-----------|----------|---------|
| **Agency staff** | Agency Portal | `go.task-health.com` |
| **Task Health admins** | Admin Webapp | `app.taskshealth.com` |
| **Registered Nurses (RNs)** | RN Mobile App | `com.taskshealth.app` (Capacitor) |
| **RN recruits** | RN Recruitment Site | `taskhealth-rn` repo |

---

## 2. Authentication Per Platform

### Agency Portal
- URL: `https://go.task-health.com/login/email`
- Email + password login
- Each agency has its own credentials
- Agency can only see their own patients and visits
- Agency identified by initials avatar in top-right

### Admin Webapp
- URL: `https://app.taskshealth.com/login`
- Email + password login
- Full access to all patients across all agencies
- Role: Operator/Admin of Task Health platform

### RN Mobile App
- RNs log in with their own credentials
- See only their assigned tasks/visits
- PIN-based unlock after initial login

---

## 3. Caregiver Entity

RNs are stored as `caregiver` records in the database. Key aspects:

- **Independent contractors** — not employees of Task Health
- **Certifications** — must have valid RN certification (see Section 4)
- **Language matching** — RN must speak at least one of the patient's languages
- **Distance matching** — RN must be within broadcast radius of patient
- **Profile** — includes photo, certifications, languages spoken, location

---

## 4. Certification Types (40+)

The `CaregiverCertification` enum contains all valid certification types:

`APC, CBSA, CDPAP, CH, CMT, CNA, COMP, DCW, ESC, FS, GNA, HCSS, HHA, HM, HMK, HSK, ILST, LPN, MSW, NT, OT, PA, PBIS, PC, PCA, PT, PTA, RD, RESP, RN, RT, SCI, SCM, SDP, SHC, SHHA, SPC, ST, Other (Skilled)`

Task templates specify which certifications are required via `allowed_certifications` (JSONB array on `patient_task_template`).

---

## 5. RN Eligibility Matching

When a task is broadcast, eligible RNs are matched at two levels:

| Level | Used For | Criteria |
|-------|----------|----------|
| **Broad match** | Metrics | Active caregiver + matching certifications |
| **Strict match** | Push notifications | + Language matching + Distance filtering (haversine) |

### Language Matching
RN must speak at least one of the patient's languages (main or secondary).

### Distance Filtering
- If `broadcast_distance` is set AND patient has GPS coordinates → only RNs within that radius
- If no coordinates → ALL matching RNs get the broadcast
- Default broadcast radius: **40 miles** (if no county-specific override)
- County-specific radius overrides stored in `rn_platform_county_miles_broadcast_radius`
- Miles converted to meters for storage

### RN Acceptance Flow
1. RN sees available broadcasts in mobile app (`getAvailableTaskBroadcasts`)
2. RN taps "Accept" → atomic UPDATE: `is_broadcasting = TRUE AND caregiver_id IS NULL`
3. Sets `is_broadcasting = FALSE`, `caregiver_id = {RN}`
4. If 0 rows returned → 409 "ALREADY_ASSIGNED" (race condition protection)
5. RN must then **schedule** the visit date/time → creates `visit_instance`

---

## 6. Areas Still Open

- [ ] Full caregiver profile structure
- [ ] Roles and permissions model within admin webapp
- [ ] Admin user types and access levels
- [ ] Onboarding flow (see `04-workflows/NURSE_ONBOARDING_FLOW.md`)
