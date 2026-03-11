# Frontend Visualization Guide

This document describes which API endpoints the frontend should use for each dashboard widget or page, based on the live data available in the database.

---

## Authentication

All endpoints require a JWT access token. Obtain one via login and attach it to every request.

```
POST /api/v1/auth/login
Body: { "email": "admin@damanat.com", "password": "admin123" }
Response: { accessToken, refreshToken, user }

// Attach to all requests:
Authorization: Bearer <accessToken>

// Renew before expiry (token lasts 15 min):
POST /api/v1/auth/refresh
Body: { "refreshToken": "..." }
Response: { accessToken, refreshToken }
```

---

## Dashboard Layout

```
┌──────────────────────────────────────────────────┐
│  DASHBOARD                                        │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────┐  │
│  │ Total    │ │ Active   │ │ Alerts │ │Health │  │  ← KPI cards
│  │ Occupancy│ │  Now     │ │ Open   │ │  ✅   │  │
│  └──────────┘ └──────────┘ └────────┘ └───────┘  │
│                                                    │
│  ┌─────────────────────┐  ┌───────────────────┐   │
│  │  Zone Occupancy     │  │  Alerts Feed      │   │
│  │  B1: ████░░ 10%     │  │  ⚠ Unknown plate  │   │
│  │  B2: █░░░░  2%      │  │  ⚠ Unknown plate  │   │
│  └─────────────────────┘  └───────────────────┘   │
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │  Camera Events (live feed)                  │  │
│  │  11:34 CAM-07  illaccess  🔴                │  │
│  │  11:33 CAM-05  illaccess  🔴                │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  ┌─────────────────────┐  ┌───────────────────┐   │
│  │  Entry/Exit Log     │  │  Active Vehicles  │   │
│  └─────────────────────┘  └───────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## 1. Occupancy Overview

**Widget:** Total garage fill gauge + per-zone progress bars  
**Poll interval:** Every 10–30 seconds

```
GET /api/v1/sites/:siteId/occupancy
Authorization: Bearer <token>
```

**Response:**
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
      {
        "zoneId": "B1-PARKING",
        "cameraId": "CAM-03",
        "currentCount": 8,
        "maxCapacity": 9,
        "percentage": 89,
        "isFull": false,
        "lastUpdated": "2026-03-11T..."
      },
      {
        "zoneId": "B2-PARKING",
        "cameraId": "CAM-09",
        "currentCount": 0,
        "maxCapacity": 9,
        "percentage": 0,
        "isFull": false,
        "lastUpdated": "2026-03-11T..."
      },
      {
        "zoneId": "GF-PARKING",
        "cameraId": "CAM-01",
        "currentCount": 0,
        "maxCapacity": 4,
        "percentage": 0,
        "isFull": false,
        "lastUpdated": "2026-03-11T..."
      }
    ]
  }
}
```

**UI suggestions:**
- `total` → circular gauge or large KPI card
- `zones[]` → horizontal progress bars, color-coded by percentage (green < 70%, amber < 90%, red ≥ 90%)
- Show `lastUpdated` as a "last sync" timestamp

---

## 2. Camera Events Feed

**Widget:** Real-time scrollable event log with event type badges  
**Poll interval:** Every 5–10 seconds, or use WebSocket if available

```
GET /api/v1/sites/:siteId/events?limit=50
Authorization: Bearer <token>
```

**Response fields to display:**

| Column | Field | Notes |
|--------|-------|-------|
| Time | `trigger_time` | Format as local time |
| Camera | `camera_id` + `channel_name` | e.g. "CAM-07 (B1-PARKING)" |
| Event Type | `event_type` | Badge — see color mapping below |
| State | `event_state` | active / inactive |
| Target | `detection_target` | vehicle / person |
| Region | `region_id` | zone/region identifier |
| Snapshot | `snapshotUrl` | Ready-to-use image URL — see below |

**Event type badge colors:**

| Event Type | Color |
|------------|-------|
| `illaccess` | Red — unauthorized access attempt |
| `fielddetection` | Blue — object detected in field |
| `linedetection` | Yellow — object crossed line |
| `AccessControllerEvent` | Green — gate entry/exit |

**Snapshot images (`snapshotUrl`):**

The API returns a computed `snapshotUrl` field (in addition to the raw `snapshot_path`). Use `snapshotUrl` directly — it is always a full URL or `null`.

```
snapshotUrl: "https://cdn.digitaloceanspaces.com/detection_images/snap_*.jpg"  // CDN-hosted
snapshotUrl: "http://5.5.5.2:8080/detection_images/part_*.jpg"                 // served by AI server
snapshotUrl: null                                                                // no snapshot captured
```

**Recommended UI pattern:**
- If `snapshotUrl` is not null, show a thumbnail in the event row (click to open full-size in a modal)
- If `snapshotUrl` is null, show a placeholder icon instead
- Use lazy loading (`loading="lazy"`) since the feed can have many rows

```html
<!-- Example -->
<img src="{{ event.snapshotUrl }}" loading="lazy" width="80" height="60" />
```

---

## 3. Alerts Panel

**Widget:** Alert list with badge count, filter controls, and resolve button

```
GET /api/v1/sites/:siteId/alerts
GET /api/v1/sites/:siteId/alerts?alertType=unknown_vehicle
GET /api/v1/sites/:siteId/alerts?isResolved=false
Authorization: Bearer <token>
```

**Query parameters:**

| Param | Values | Description |
|-------|--------|-------------|
| `alertType` | `unknown_vehicle`, `intrusion`, etc. | Filter by type |
| `isResolved` | `true` / `false` | Filter by resolution status |

**Response fields:**

| Field | Description |
|-------|-------------|
| `id` | Alert ID |
| `alert_type` | Type of alert |
| `camera_id` | Camera that triggered it |
| `zone_id` | Affected zone |
| `event_type` | Underlying camera event |
| `description` | Human-readable message |
| `is_resolved` | Boolean — show green/red indicator |
| `triggered_at` | Timestamp |
| `resolved_at` | Null if still open |

**UI suggestions:**
- Show unresolved count as a red badge on the nav icon
- Allow filtering by `isResolved` with a toggle
- "Resolve" button should call your own API update endpoint (to be implemented)

---

## 4. Entry / Exit Log

**Widget:** Vehicle gate log table with duration column

```
GET /api/v1/sites/:siteId/entry-exit-log?limit=50
Authorization: Bearer <token>
```

**Response fields:**

| Field | Description |
|-------|-------------|
| `plateNumber` | Vehicle plate |
| `gate` | `entry` or `exit` |
| `cameraId` | Gate camera |
| `eventTime` | Timestamp of event |
| `parkingDuration` | Minutes parked (null for entries) |
| `vehicleType` | `unknown`, `registered`, etc. |
| `snapshotUrl` | Ready-to-use image URL or `null` if no snapshot |

**UI suggestions:**
- Color-code `gate`: green for entry, orange for exit
- Show `parkingDuration` only on exit rows (e.g. "28 min")
- Pair entry + exit rows visually for the same plate
- Show `snapshotUrl` as a thumbnail next to each row (click to enlarge in a modal)

---

## 5. Active Vehicles (Currently Parked)

**Widget:** Live list of vehicles currently inside the facility  
**Poll interval:** Every 30 seconds

```
GET /api/v1/sites/:siteId/parking-times/active
Authorization: Bearer <token>
```

**Response:** Array of active sessions:
```json
[
  {
    "plate": "ABC-1234",
    "entryAt": "2026-03-11T00:30:30.000Z",
    "entryCamera": "CAM-ENTRY",
    "zone": "B1-PARKING",
    "firstSeen": "2026-03-11T00:30:30.000Z"
  }
]
```

---

## 6. Parking Stats — KPI Cards

**Widget:** Summary cards at the top of the dashboard

```
GET /api/v1/sites/:siteId/parking-times/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "totalPlates": 42,
  "activeNow": 6,
  "totalVisits": 150,
  "avgVisitsPerPlate": 3.5,
  "repeatVisitors": 18,
  "date": "2026-03-11"
}
```

**Suggested KPI cards:**

| Card | Field |
|------|-------|
| Total Unique Plates | `totalPlates` |
| Active Now | `activeNow` |
| Total Visits Today | `totalVisits` |
| Repeat Visitors | `repeatVisitors` |

---

## 7. Plate Lookup / History

**Widget:** Search input → vehicle timeline per day

```
// Full history for a plate
GET /api/v1/sites/:siteId/parking-times/:plate

// Sessions for a specific day
GET /api/v1/sites/:siteId/parking-times/:plate/day/2026-03-11

Authorization: Bearer <token>
```

**Full history response shape:**
```json
{
  "plate": "ABC-1234",
  "siteId": "...",
  "totalVisits": 3,
  "firstSeen": "2026-03-09T...",
  "lastSeen": "2026-03-11T...",
  "days": {
    "2026-03-11": {
      "sessions": [
        {
          "sessionId": "uuid",
          "entryAt": "2026-03-11T00:30:30.000Z",
          "exitAt": "2026-03-11T00:58:30.000Z",
          "durationMinutes": 28,
          "entryCamera": "CAM-ENTRY",
          "exitCamera": "CAM-EXIT",
          "zone": "B1-PARKING"
        }
      ],
      "totalSessions": 1,
      "totalDurationMinutes": 28
    }
  }
}
```

---

## 8. Camera Management (Config Page)

**For ADMIN users only.**

```
// List all cameras for a site
GET /api/v1/sites/:siteId/cameras

// Single camera detail
GET /api/v1/cameras/:id

// Add camera (ADMIN)
POST /api/v1/sites/:siteId/cameras
Body: { floorId, zoneId?, name, ip, username, password, model?, role? }

// Update camera (ADMIN)
PATCH /api/v1/cameras/:id
Body: { name?, ip?, username?, password?, model?, role?, isActive? }

// Delete camera (ADMIN)
DELETE /api/v1/cameras/:id
```

**Camera roles:** `OCCUPANCY`, `ENTRY`, `EXIT`, `VIOLATION`, `INTRUSION`

> Note: `password` is encrypted at rest and **never returned** in API responses. The field is write-only.

---

## 9. PMS AI Health Check

**Widget:** Status indicator in the header or settings page

```
GET /api/v1/sites/:siteId/health
Authorization: Bearer <token>
```

Returns the PMS AI server status. If unreachable:
```json
{ "status": "unreachable", "error": "fetch failed" }
```

---

## Error Handling

All endpoints return errors in this uniform shape:
```json
{ "status": "error", "message": "Descriptive error message" }
```

| HTTP Code | Meaning |
|-----------|---------|
| `400` | Validation error (bad request body) |
| `401` | Missing or expired token |
| `403` | Insufficient role/permissions |
| `404` | Resource not found |
| `500` | Internal server error |

On `401`, trigger the refresh flow (`POST /auth/refresh`). If refresh also fails, redirect to login.
