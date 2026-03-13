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

### Live feed (polling)
```
GET /api/v1/sites/:siteId/entry-exit-log?limit=10
Poll every: 15 seconds
```

### Historical / filtered query (analytics pages)
```
GET /api/v1/sites/:siteId/entry-exit-log?from=2026-03-01&to=2026-03-31&limit=100&page=1
GET /api/v1/sites/:siteId/entry-exit-log?gate=exit&limit=50
GET /api/v1/sites/:siteId/entry-exit-log?plate=ERD&limit=50
GET /api/v1/sites/:siteId/entry-exit-log?cameraId=CAM-EXIT&limit=50
```

**Query parameters:**
| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | int | `50` | Rows per page |
| `page` | int | `1` | Page number |
| `from` | `YYYY-MM-DD` | — | Start date filter |
| `to` | `YYYY-MM-DD` | — | End date filter |
| `gate` | `entry` / `exit` | — | Filter by gate type |
| `plate` | string | — | Partial plate search (case-insensitive) |
| `cameraId` | string | — | Filter by camera |

### Response shape
```json
{
  "data": {
    "rows": [
      {
        "id": 20,
        "plateNumber": "ERD-7800",
        "gate": "exit",
        "cameraId": "CAM-EXIT",
        "eventTime": "2026-03-11T04:32:34.173Z",
        "parkingDurationSeconds": 4407,
        "matchedEntryId": 9,
        "vehicleType": "unknown",
        "snapshotUrl": "https://cdn.digitaloceanspaces.com/...",
        "isGhostEntry": false
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "totalCount": 12,
      "totalPages": 1
    }
  }
}
```

**Field notes:**
| Field | Description |
|---|---|
| `parkingDurationSeconds` | Total duration in **seconds** (integer), computed from real timestamps. `null` for entry rows or exits with no matched entry |
| `isGhostEntry` | `true` if this entry appeared within 2 min of an exit for the same plate (ANPR ghost re-read) — show a ⚠ warning badge |

**Format helper (copy this into your utils):**
```js
function formatDuration(seconds) {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Examples:
// 4407  → "1h 13m 27s"
// 180   → "3m 0s"
// 45    → "45s"
```

### UI
- Table sorted by `eventTime` descending
- `gate = "entry"` → green badge; `gate = "exit"` → orange badge
- `parkingDurationSeconds` → only display on exit rows using `formatDuration()` — `null` means vehicle still inside
- `isGhostEntry: true` → show ⚠ badge and dim the row (it is a duplicate camera scan, not a real re-entry)
- Show `snapshotUrl` as thumbnail with click-to-expand
- Pair entry/exit rows for the same plate visually using `matchedEntryId`

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

## 10. Analytics — Traffic Heatmap

```
GET /api/v1/sites/:siteId/analytics/traffic-heatmap?from=2026-03-01&to=2026-03-31
```

**Query parameters:**
| Param | Format | Default |
|---|---|---|
| `from` | `YYYY-MM-DD` | Start of current month |
| `to` | `YYYY-MM-DD` | Today |

**Response:** Full 7×24 grid (168 cells), always returned regardless of data:
```json
{
  "data": [
    { "dayOfWeek": 0, "hour": 0, "entries": 0, "exits": 0, "total": 0 },
    { "dayOfWeek": 0, "hour": 1, "entries": 1, "exits": 0, "total": 1 },
    { "dayOfWeek": 3, "hour": 9, "entries": 5, "exits": 3, "total": 8 }
  ]
}
```

**Fields:**
- `dayOfWeek`: 0 = Sunday, 1 = Monday ... 6 = Saturday
- `hour`: 0..23
- `total` = `entries + exits`

**UI:** Render as a color-scale heatmap grid (rows = days, columns = hours). Color intensity by `total`.

---

## 11. Analytics — Average Parking Duration

```
GET /api/v1/sites/:siteId/analytics/avg-parking-duration?from=2026-03-01&to=2026-03-31
```

**Response:** One row per day that has completed visits:
```json
{
  "data": [
    {
      "date": "2026-03-11",
      "avgParkingDurationSeconds": 5673,
      "medianParkingDurationSeconds": 5673,
      "completedVisits": 2
    }
  ]
}
```

**Fields:**
- All durations in **seconds** (use the `formatDuration()` helper from section 5)
- `completedVisits` = number of exit events with matched entry in that day
- Only includes rows where a vehicle actually exited (with a matched entry)

**UI:** Line chart or bar chart. X-axis = date, Y-axis = average duration. Show `completedVisits` as a tooltip or secondary axis for context.

---

## 12. Analytics — Frequent Visitors

```
GET /api/v1/sites/:siteId/analytics/frequent-visitors?window=month&limit=20
```

**Query parameters:**
| Param | Values | Default |
|---|---|---|
| `window` | `day`, `week`, `month` | `month` |
| `limit` | integer | `20` |

**Response:**
```json
{
  "data": {
    "window": "month",
    "from": "2026-03-01T00:00:00.000Z",
    "to": "2026-03-11T...",
    "visitors": [
      {
        "plateNumber": "ERD-7800",
        "visitCount": 2,
        "entryCount": 2,
        "exitCount": 2,
        "lastSeenAt": "2026-03-11T07:48:18.000Z",
        "vehicleType": "unknown"
      }
    ]
  }
}
```

**Fields:**
- `visitCount` = count of **entry** events only (one physical visit = one entry, never double-counted by exit)
- Ghost entries (ANPR re-reads within 2 min of exit) are excluded
- `entryCount` = same as `visitCount`
- `exitCount` = exit events (may differ if vehicle is still parked)

**UI:** Table sorted by `visitCount` descending. Optionally show a "Currently inside" badge when `entryCount > exitCount`.

---

## 13. Analytics — Turnaround Time

```
GET /api/v1/sites/:siteId/analytics/turnaround-time?from=2026-03-01&to=2026-03-31
```

**Response:**
```json
{
  "data": [
    {
      "date": "2026-03-11",
      "avgTurnaroundSeconds": 1243,
      "medianTurnaroundSeconds": 1243,
      "samples": 2
    }
  ]
}
```

**Definition:** Turnaround = time from an exit event until the next valid entry by **any** vehicle at facility level. This measures how quickly a parking spot is reused after being freed. Ghost entries are excluded.

**Fields:**
- All durations in **seconds**
- `samples` = number of exit→next-entry pairs measured that day
- Capped to same-day pairings (max 24h turnaround)

**UI:** Line/bar chart showing turnaround trend per day. Low turnaround = high demand; high turnaround = low demand.

---

## 15. PMS AI Health Status

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

## 16. Role-Based UI Rules

| Role | Can do |
|---|---|
| `SUPER_ADMIN` | Everything |
| `ADMIN` | Everything except creating new sites |
| `OPERATOR` | View all + resolve alerts + update occupancy |
| `VIEWER` | View only — no buttons that mutate data |

The `user.role` is returned in the login response. Use it to show/hide action buttons.

---

## 17. Error Handling

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

## 18. Polling Strategy

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

## 19. Known Behaviors

- **`snapshotUrl`** can be `null` — always guard before rendering `<img>`
- **Health endpoint** is slow (2s timeout) in dev because the AI server is on local network — never block UI on it
- **Zone `currentCount`** in the occupancy response is computed from gate log counts, not from raw camera analytics — this is intentional and correct
- **Test data is filtered out** — all endpoints already exclude rows where `is_test = true`
- **Alerts `isTest: true`** rows are excluded — only real alerts are returned
- **`parkingDurationSeconds`** is in **seconds** (integer), is `null` on entry rows (vehicle still inside)
