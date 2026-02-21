# Google Calendar Integration

> Interview scheduling and meeting management with Zoom integration.

---

## 1. What It Does

Google Calendar is used for:
- **HR interview scheduling** — Scheduling caregiver interviews with calendar invites
- **Communication center meetings** — Creating and managing meeting events
- **Free/busy queries** — Checking availability before scheduling

---

## 2. Authentication

- **Type:** OAuth2 (authorized_user with refresh_token)
- **Credentials storage:** S3 bucket, URL specified by `GOOGLE_CALENDAR_CREDENTIALS_S3_URL`
- **Credential format:** JSON with `client_id`, `client_secret`, `refresh_token`
- **Caching:** Credentials loaded once from S3, cached as singleton
- **Package:** `@googleapis/calendar` v4.0.0, `google-auth-library` v8.7.0

---

## 3. Key API Calls

### Free/Busy Queries
```typescript
getGoogleCalendarBusyTimesBetweenDays(startDate, endDate)
  // Lists all calendars, queries freebusy API
  // Returns busy time blocks between specified dates
```

### Calendar Discovery
```typescript
getGoogleCalendarMedflytCalendarId()
  // Searches for calendar with summary "Medflyt Caregiver Meetings"
  // Returns calendar ID for event operations
```

### Event Management
```typescript
scheduleGoogleCalendarEvent(calendarId, { summary, description, start, end, attendees, zoomUrl?, zoomPassword? })
  // Creates calendar event
  // Supports Zoom meeting integration (adds Zoom icon + conference data)
  // Adds attendees with email invitations
  // Uses "America/New_York" timezone
  // Includes default reminders

deleteGoogleCalendarEvent(calendarId, eventId)
  // Removes event from calendar
```

---

## 4. Configuration

| Env Variable | Purpose |
|-------------|---------|
| `GOOGLE_CALENDAR_CREDENTIALS_S3_URL` | S3 URL to OAuth2 credentials JSON |
| `GOOGLE_API_KEY` | General Google API key |

---

## 5. Code Location

| File | Purpose |
|------|---------|
| `taskhealth_server2/src/GoogleApi/calendar-api.ts` | Google Calendar API wrapper |
| `taskhealth_server2/src/hr/application/controllers/application_controllers.ts` | HR interview scheduling |
| `taskhealth_server2/src/modules/communication_center/controllers/CommunicationCenterMessageActionController.ts` | Meeting management |

---

## 6. Implementation Details

**Calendar name:** "Medflyt Caregiver Meetings"

**Timezone:** Always "America/New_York"

**Zoom integration:** Events can include Zoom meeting details:
- Meeting URL and password embedded in event
- Zoom icon from Google CDN displayed in calendar
- Conference solution type: "addOn"

**API version:** Calendar API v3

---

## 7. Known Limitations

- Single calendar ("Medflyt Caregiver Meetings") — all events go to one calendar
- Credentials stored in S3 (must be refreshable OAuth2 tokens)
- Timezone is hard-coded to New York (not dynamic per user)
- Calendar name still uses "Medflyt" branding (legacy)
