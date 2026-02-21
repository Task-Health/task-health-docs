# Users & Auth

> Three user types, auth per platform, caregiver entity, certifications, RN eligibility matching, roles and permissions.

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
- RNs log in with phone number + SMS code (`phone_login_sms_code` table)
- See only their assigned tasks/visits and available broadcasts
- PIN-based unlock after initial login
- FCM push notifications registered via `user_fcm_registration_token`

### Token Management
- **Auth tokens:** Stored in `active_auth_token` table (token + user FK)
- **Access keys:** Stored in `active_access_key` table (for API access)
- **SMS verification:** `phone_login_sms_code` table (phone + code, unique per phone)
- **Email OTP:** `email_otp` table for email-based verification
- **Two-factor auth:** `user_two_factor_auth_code` table

---

## 3. Database Entity Model

### user (auth layer)
All users share the `user` table for authentication:

| Column | Purpose |
|--------|---------|
| id | Primary key |
| email | Login email (UNIQUE on lowercase) |
| passwordHash | Bcrypt hash |
| active | Account enabled |
| superuser | Super admin flag |
| emailVerified | Email confirmed |
| resetPasswordToken | Password reset token (UNIQUE) |

### agency_member (agency staff)
Extends `user` for agency context:

| Column | Purpose |
|--------|---------|
| user | FK to user(id) |
| agency | FK to agency(id) — scopes all data access |
| agencyAdmin | Boolean — full agency admin rights |
| firstName, lastName | Display name |
| jobTitle | Role title |
| actions | JSONB — permission actions (see Section 5) |

### caregiver (RNs)
Extends `user` for caregiver context:

| Column | Purpose |
|--------|---------|
| user | FK to user(id) |
| firstName, lastName, middleName | Name |
| gender | M/F |
| languages | JSONB array of spoken languages |
| address, addressGeoLocation | Location for distance matching |
| certification | Primary CaregiverCertification enum value |
| photoUrl | Profile photo |

**Multi-agency:** Caregivers link to agencies via `caregiver_agency_assoc` (many-to-many with status).

---

## 4. Certification Types (40+)

The `CaregiverCertification` enum contains all valid certification types:

`APC, CBSA, CDPAP, CH, CMT, CNA, COMP, DCW, ESC, FS, GNA, HCSS, HHA, HM, HMK, HSK, ILST, LPN, MSW, NT, OT, PA, PBIS, PC, PCA, PT, PTA, RD, RESP, RN, RT, SCI, SCM, SDP, SHC, SHHA, SPC, ST, Other (Skilled)`

Task templates specify which certifications are required via `allowed_certifications` (JSONB array on `patient_task_template`).

**Per-agency certification settings:** `agency_caregiver_certification_assoc` and `agency_caregiver_certification_setting` control which certifications an agency uses and their settings.

---

## 5. Roles and Permissions

### Agency-Level Roles

Agency staff permissions are managed through:

**`agency_role` table:**
- Defines named roles per agency (e.g., "Coordinator", "Billing Admin", "Supervisor")
- Agency-specific — each agency can define their own roles

**`agency_member_role_assoc` table:**
- Links agency members to roles (many-to-many)
- A member can have multiple roles

**`agency_member_role_permission` table:**
- Specific permissions per role
- Controls access to features, actions, and data views

**`agency_member.actions` (JSONB):**
- Legacy permission system — JSONB blob of allowed actions
- Coexists with role-based system

### Admin Webapp Roles
- Admins have `user.superuser = true` for full access
- Regular admin members have scoped permissions
- Agency member office association (`agency_member_office_assoc`) scopes access to specific offices

### Permission Scoping

| Scope | Mechanism |
|-------|-----------|
| Agency isolation | `agency_member.agency` FK — all queries filtered by agency |
| Office scoping | `agency_member_office_assoc` — members see only their offices |
| Role-based actions | `agency_member_role_permission` — feature-level access control |
| Legacy actions | `agency_member.actions` JSONB — action whitelist |

---

## 6. RN Eligibility Matching

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

## 7. Caregiver Profile Structure

### Core Fields (caregiver table)
- Name (first, middle, last), gender, birth date
- Languages (JSONB array)
- Address + GPS coordinates (`addressGeoLocation`)
- Primary certification
- Photo URL
- Notification preferences (`receiveVisitNotifications`)

### Phone Numbers
- Stored in `caregiver_phonenumber` table (1:N, supports multiple)
- Each phone number is globally unique

### Multi-Agency Association
- `caregiver_agency_assoc` links caregivers to agencies
- Each association has a `status` and agency-specific `caregiverCode`
- UNIQUE constraint: one association per caregiver-agency pair

### Caregiver Status History
- `caregiver_status_history` tracks status changes over time
- Includes status, date, and who made the change

### Additional Profile Data
- `caregiver_bank_account_information` — Banking for payroll
- `caregiver_general_notes` — Admin notes
- `caregiver_s3_photo_url` — S3-hosted profile photo
- `caregiver_notification_settings` — Notification preferences
- `caregiver_last_seen` — Last app activity timestamp
- `caregiver_blacklist` — Blocked caregiver-patient pairs

---

## 8. Onboarding

See [NURSE_ONBOARDING_FLOW.md](../04-workflows/NURSE_ONBOARDING_FLOW.md) for the full recruitment → onboarding → first assignment flow.

Key tables:
- `landing_page_onboarding_caregiver_data` — Initial application data
- `hr_application_*` — HR application sections, questions, answers
- `hr_document` — Uploaded documents (licenses, certs, ID)
- `caregiver_compliance_instance` — Compliance tracking
- `onboarding_caregiver_engagement_*` — Automated follow-up engagement

---

## 9. Key Code Locations

| File | Purpose |
|------|---------|
| `taskhealth_server2/src/auth/` | Authentication middleware and token validation |
| `taskhealth_server2/src/modules/caregiver/` | Caregiver management |
| `taskhealth_server2/src/rn-platform/tasks/` | Broadcasting and eligibility matching |
| `taskhealth_server2/src/hr/` | HR application and onboarding |
| `taskhealth_server2/sql/migrations/V0001__Initial_Tables.sql` | user, agency, caregiver, agency_member tables |
| `taskhealth_server2/sql/migrations/V0068__HR_Infrastructure.sql` | HR question/answer infrastructure |

---

## 10. Edge Cases & Gotchas

- **Phone number uniqueness:** `caregiver_phonenumber.phoneNumber` is globally unique — a phone can't be shared across caregivers
- **Email case sensitivity:** `user.email` has a unique index on `LOWER(email)` — case-insensitive uniqueness
- **Multi-agency caregivers:** A caregiver can work for multiple agencies but has ONE user record. The `caregiver_agency_assoc.status` per agency controls visibility.
- **Legacy vs role-based permissions:** Both `agency_member.actions` (JSONB) and `agency_member_role_permission` (table) coexist. Check both when evaluating permissions.
- **Caregiver ≠ RN exclusively:** Despite the RN platform name, the `caregiver` table and `CaregiverCertification` enum support 40+ certification types (HHA, CNA, LPN, etc.), not just RNs.
