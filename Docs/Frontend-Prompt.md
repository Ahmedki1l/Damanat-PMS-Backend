# Damanat PMS — Frontend Implementation Prompt

You are building the frontend for **Damanat PMS**, a Parking Management System dashboard. The backend is a live REST API. This document is your complete specification.

---

## Tech Context

- **API base URL:** `http://localhost:3000` (dev) — replace with the deployed URL in production
- **Auth:** JWT Bearer tokens. Access token expires in **15 minutes**. Refresh token lasts **7 days**.
- **Site ID in use:** `0843a455-5720-4d90-80b9-e3a859bba9ce` (Damanat HQ — hardcode for now or store in config)
- **All responses wrap data:** `{ "status": "success", "data": ... }` or `{ "status": "error", "message": "..." }`

---

## 1. Authentication

### Login
```
POST /api/v1/auth/login
Body: { "email": "admin@damanat.com", "password": "admin123" }
Response: {
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id", "name", "email", "role" }
}
```

### Attach token to every request
```
Authorization: Bearer <accessToken>
```

### Auto-refresh before expiry
```
POST /api/v1/auth/refresh
Body: { "refreshToken": "..." }
Response: { "accessToken": "...", "refreshToken": "..." }
```

**Rules:**
- Store tokens in memory or `localStorage`
- On any `401` response → try refresh → if refresh also fails → redirect to `/login`
- Set up an axios/fetch interceptor that refreshes automatically when the token is about to expire

---

## 2. Occupancy (Most Important)

**Source of truth:** computed live from ANPR entry/exit gate logs — NOT from camera analytics counts.

### Endpoint
```
GET /api/v1/sites/:siteId/occupancy
Poll every: 15 seconds
```

### Response shape
```json
{
  "status": "success",
  "data": {
    "total": {
      "currentCount": 8,
      "maxCapacity": 22,
      "percentage": 36,
      "isFull": false
    },
    "zones": [
      { "zoneId": "B1-PARKING", "cameraId": "CAM-03", "currentCount": 8, "maxCapacity": 9, "percentage": 89, "isFull": false, "lastUpdated": "2026-03-11T..." },
      { "zoneId": "B2-PARKING", "cameraId": "CAM-09", "currentCount": 0, "maxCapacity": 9, "percentage": 0,  "isFull": false, "lastUpdated": "2026-03-11T..." },
      { "zoneId": "GF-PARKING", "cameraId": "CAM-01", "currentCount": 0, "maxCapacity": 4, "percentage": 0,  "isFull": false, "lastUpdated": "2026-03-11T..." }
    ]
  }
}
```

### Zone fill logic (backend-computed, just display as-is)
Cars fill B1 first → B2 when B1 is full → GF when B2 is full.

### UI
- **KPI card 1:** `total.currentCount` — "Total Vehicles"
- **KPI card 2:** `total.maxCapacity - total.currentCount` — "Available Spots"
- **KPI card 3:** `total.percentage + "%"` — "Overall Utilized"
- **Zone breakdown table:** one row per zone in `zones[]`
  - Progress bar color: green `< 70%`, amber `70–89%`, red `≥ 90%`
  - `isFull: true` → show "FULL" badge instead of progress bar

### IMPORTANT — Do NOT use `zone_occupancy.current_count` from any other source. Always use what `GET /occupancy` returns.

---

## 3. Alerts

### Get alerts (unresolved only by default)
```
GET /api/v1/sites/:siteId/alerts?isResolved=false
GET /api/v1/sites/:siteId/alerts?isResolved=true
GET /api/v1/sites/:siteId/alerts?alertType=unknown_vehicle
```

### Response shape (each alert)
```json
{
  "id": 6,
  "alertType": "unknown_vehicle",
  "cameraId": "CAM-ENTRY",
  "zoneId": "entry",
  "eventType": "AccessControllerEvent",
  "description": "Unregistered vehicle at entry gate: plate UNREGISTERED-PLATE-999",
  "isResolved": false,
  "triggeredAt": "2026-03-11T01:53:06.532Z",
  "resolvedAt": null,
  "snapshotUrl": "https://cognerax-learn.sfo3.cdn.digitaloceanspaces.com/detection_images/snap_*.jpg"
}
```

### Resolve an alert
```
PATCH /api/v1/sites/:siteId/alerts/:alertId/resolve
Authorization: Bearer <token>   (requires OPERATOR role or higher)
Body: {}
Response: { "data": { "id": 6, "isResolved": true, "resolvedAt": "2026-03-11T..." } }
```

**Status codes:**
- `200` success
- `409` alert already resolved
- `404` alert not found
- `403` insufficient role

### UI
- Show red badge on nav with count of `isResolved=false` alerts
- Poll unresolved alerts every 30 seconds
- Each alert row: show `snapshotUrl` as thumbnail (if not null), `description`, `triggeredAt`, "Resolve" button
- After resolving: remove from the unresolved list immediately (optimistic update or refetch)

---

## 4. Camera Events Feed

```
GET /api/v1/sites/:siteId/events?limit=50
Poll every: 10 seconds
```

### Response shape (each event)
```json
{
  "id": 57,
  "cameraId": "CAM-ENTRY",
  "channelName": "Test ANPR Camera",
  "eventType": "AccessControllerEvent",
  "eventState": "active",
  "detectionTarget": "vehicle",
  "regionId": "entry",
  "triggerTime": "2026-03-11T01:52:51.000Z",
  "createdAt": "2026-03-11T01:53:06.539Z",
  "snapshotUrl": "https://cdn.digitaloceanspaces.com/detection_images/snap_*.jpg"
}
```

### Event type badge colors
| `eventType` | Color | Meaning |
|---|---|---|
| `illaccess` | Red | Unauthorized login attempt on camera |
| `fielddetection` | Blue | Object detected in zone |
| `linedetection` | Yellow | Object crossed line |
| `AccessControllerEvent` | Green | ANPR gate entry/exit |
| `regionEntrance` | Purple | Object entered region |
| `duration` | Gray | Dwell time event |

### UI
- Scrollable live feed table, newest on top
- Show `snapshotUrl` thumbnail (80×60px) — if null show camera icon placeholder
- Click thumbnail → open full-size modal
- Use `loading="lazy"` on all thumbnails

---

## 5. Entry / Exit Log

```
GET /api/v1/sites/:siteId/entry-exit-log?limit=50
Poll every: 15 seconds
```

### Response shape (each row)
```json
{
  "id": 7,
  "plateNumber": "XHD-7651",
  "gate": "entry",
  "cameraId": "CAM-ENTRY",
  "eventTime": "2026-03-11T03:07:37.000Z",
  "parkingDuration": null,
  "matchedEntryId": null,
  "vehicleType": "unknown",
  "snapshotUrl": "https://cdn.digitaloceanspaces.com/..."
}
```

### UI
- Table sorted by `eventTime` descending
- `gate = "entry"` → green row/badge; `gate = "exit"` → orange row/badge
- `parkingDuration` → only show on exit rows (e.g. "28 min") — `null` means still inside
- Show `snapshotUrl` as thumbnail with click-to-expand
- Pair entry/exit rows for the same plate visually if possible

---

## 6. Active Vehicles

```
GET /api/v1/sites/:siteId/parking-times/active
Poll every: 30 seconds
```

### Response shape
```json
[
  {
    "plate": "HUD-9444",
    "entryAt": "2026-03-11T02:58:55.000Z",
    "entryCamera": "CAM-ENTRY",
    "zone": "B1-PARKING",
    "firstSeen": "2026-03-11T02:58:55.000Z"
  }
]
```

### UI
- Table of currently parked vehicles
- Show "Time inside" computed from `entryAt` to now (live counter)
- Count = `occupancy.total.currentCount` (these two should match)

---

## 7. Parking Stats — KPI Cards

```
GET /api/v1/sites/:siteId/parking-times/stats
```

### Response shape
```json
{
  "totalPlates": 6,
  "activeNow": 6,
  "totalVisits": 6,
  "avgVisitsPerPlate": 1.0,
  "repeatVisitors": 0,
  "date": "2026-03-11"
}
```

| Card | Field |
|---|---|
| Unique Plates Today | `totalPlates` |
| Active Now | `activeNow` |
| Total Visits | `totalVisits` |
| Repeat Visitors | `repeatVisitors` |

---

## 8. Plate Lookup

```
GET /api/v1/sites/:siteId/parking-times/:plate
GET /api/v1/sites/:siteId/parking-times/:plate/day/2026-03-11
```

- Search bar input → call the full history endpoint
- Display sessions per day in an expandable timeline
- Show `entryAt`, `exitAt`, `durationMinutes`, `zone`

---

## 9. Zone Capacity Settings

**Read (any authenticated user):**
```
GET /api/v1/sites/:siteId/settings/zone-capacities
```
```json
[
  { "zoneId": "GARAGE-TOTAL", "maxCapacity": 22, "currentCount": 9, "isAggregate": true },
  { "zoneId": "B1-PARKING",   "maxCapacity": 9,  "currentCount": 2, "isAggregate": false },
  { "zoneId": "B2-PARKING",   "maxCapacity": 9,  "currentCount": 0, "isAggregate": false },
  { "zoneId": "GF-PARKING",   "maxCapacity": 4,  "currentCount": 0, "isAggregate": false }
]
```

**Update (ADMIN only):**
```
PATCH /api/v1/sites/:siteId/settings/zone-capacities/:zoneId
Body: { "maxCapacity": 12 }
```

- Only show non-aggregate zones (`isAggregate: false`) as editable rows
- Inline edit or modal per zone
- Disable the save button for VIEWER/OPERATOR roles

---

## 10. PMS AI Health Status

```
GET /api/v1/sites/:siteId/health
Poll every: 60 seconds
```

```json
// Online:
{ "status": "ok" }

// Offline (expected in dev — AI server is on local network 5.5.5.2):
{ "status": "unreachable", "error": "The operation was aborted due to timeout" }
```

- Show a green dot "System Online" or red dot "AI Offline" in the header
- `status === "unreachable"` is normal in dev — do not treat as an error

---

## 11. Role-Based UI Rules

| Role | Can do |
|---|---|
| `SUPER_ADMIN` | Everything |
| `ADMIN` | Everything except creating new sites |
| `OPERATOR` | View all + resolve alerts + update occupancy |
| `VIEWER` | View only — no buttons that mutate data |

The `user.role` is returned in the login response. Use it to show/hide action buttons.

---

## 12. Error Handling

All errors:
```json
{ "status": "error", "message": "Descriptive message" }
```

| Code | Action |
|---|---|
| `401` | Refresh token → if fails → redirect to login |
| `403` | Show "Permission denied" toast |
| `404` | Show "Not found" inline message |
| `409` | Show specific message (e.g. "Already resolved") |
| `500` | Show "Server error, try again" toast |

---

## 13. Polling Strategy

| Endpoint | Interval | Notes |
|---|---|---|
| `/occupancy` | 15s | Core KPI |
| `/events` | 10s | Live feed |
| `/entry-exit-log` | 15s | Gate log |
| `/alerts?isResolved=false` | 30s | Badge count |
| `/parking-times/active` | 30s | Active list |
| `/parking-times/stats` | 60s | KPI cards |
| `/health` | 60s | Status dot |

Use `setInterval` with cleanup on component unmount. Pause polling when the tab is hidden (`document.visibilityState === 'hidden'`).

---

## 14. Known Behaviors

- **`snapshotUrl`** can be `null` — always guard before rendering `<img>`
- **Health endpoint** is slow (2s timeout) in dev because the AI server is on local network — never block UI on it
- **Zone `currentCount`** in the occupancy response is computed from gate log counts, not from raw camera analytics — this is intentional and correct
- **Test data is filtered out** — all endpoints already exclude rows where `is_test = true`
- **Alerts `isTest: true`** rows are excluded — only real alerts are returned
- **`parkingDuration`** is in **minutes**, is `null` on entry rows (vehicle still inside)
