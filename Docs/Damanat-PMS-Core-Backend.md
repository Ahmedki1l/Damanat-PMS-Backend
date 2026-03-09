# Damanat PMS Core Backend — Architecture & Implementation Plan

## 1. Overview

This backend is the **core control and SaaS layer** for the Damanat Parking Management System (PMS):

- Provides **auth, users, roles, sites/facilities, floors, zones, cameras**.
- Acts as the **single API** for any UI (internal dashboard, configurator, etc.).
- Integrates with the **AI/event engine** (existing FastAPI PMS AI backend) which receives camera events and computes:
  - Occupancy per zone
  - Violations in restricted zones
  - Intrusions
  - Entry/exit counts and parking duration
  - Basic statistics

Tech stack:

- **Node.js 20 + TypeScript**
- **Express** (modular structure)
- **PostgreSQL** (via Prisma or TypeORM)
- Frontend: Vite + React (separate project, see frontend document)

The PMS AI service (FastAPI) remains a separate component. This backend treats it as an internal service and/or shares the same Postgres database for camera configuration and analytics.

---

## 2. High-Level Architecture

### 2.1 Layers

1. **Core Backend (this service, PERN)**
   - Exposes REST APIs to:
     - Manage sites, floors, zones, cameras
     - Manage users & roles
     - Proxy/aggregate analytics and alerts for dashboards
   - Stores configuration and user data in **PostgreSQL**.

2. **PMS AI Engine (existing FastAPI service)**
   - Receives events from Hikvision cameras (LAN only).
   - Writes **events, occupancy, alerts, entry/exit logs, stats** to Postgres.
   - Optionally reads camera configuration from Postgres.

3. **Frontend (Vite + React)**
   - Talks only to the **Core Backend**.
   - No direct calls to the PMS AI.

### 2.2 Data Flow

- Configurator UI → Core Backend → Postgres
- PMS AI:
  - Reads `cameras` (and related config) from Postgres.
  - Writes events/alerts/occupancy stats back to Postgres.
- Dashboard:
  - Calls Core Backend → queries Postgres and/or calls PMS AI (if needed) to serve the UI.

---

## 3. Data Model (PostgreSQL)

### 3.1 Users & Auth

```text
users
- id (uuid, pk)
- email (unique)
- password_hash
- name
- role (enum: 'super_admin' | 'admin' | 'operator' | 'viewer')
- created_at
- updated_at

user_site_roles
- id (uuid, pk)
- user_id (fk → users.id)
- site_id (fk → sites.id)
- role (enum: 'admin' | 'operator' | 'viewer')
- created_at
```

- Authentication:
  - Email + password → JWT (access + refresh tokens).
- Authorization:
  - Global roles (e.g. `super_admin` can see all sites).
  - Per-site roles via `user_site_roles`.

### 3.2 Sites, Floors, Zones, Cameras

```text
sites
- id (uuid, pk)
- name
- code (optional short identifier)
- location
- description
- pms_ai_base_url      // e.g. "http://192.168.1.50:8080"
- pms_ai_api_key (nullable or encrypted)
- created_at
- updated_at

floors
- id (uuid, pk)
- site_id (fk → sites.id)
- name             // e.g. "Ground Floor", "B1"
- level            // integer or string
- created_at
- updated_at

zones
- id (uuid, pk)
- floor_id (fk → floors.id)
- name             // e.g. "parking-row-A"
- type             // enum: 'parking' | 'restricted' | 'intrusion' | 'other'
- description
- max_capacity     // default 10; used for occupancy alerts
- created_at
- updated_at

cameras
- id (uuid, pk)
- site_id (fk → sites.id)
- floor_id (fk → floors.id)
- zone_id (fk → zones.id, nullable if camera covers multiple zones)
- name             // e.g. "CAM-02", "CAM-ENTRY"
- ip
- username
- password_encrypted   // never plain text in code
- model               // optional (Hikvision model)
- role                // e.g. 'occupancy', 'entry', 'exit', 'violation', 'intrusion'
- is_active           // bool
- created_at
- updated_at
```

> **Security:** Camera credentials are stored encrypted at rest. In the client deployment, everything (backend, DB, PMS AI) runs on-prem, inside the client network.

### 3.3 Analytics & Alerts (Shared with PMS AI)

Depending on how PMS AI is structured, we either:

1. Share the same Postgres DDL and let PMS AI own the analytics tables, or  
2. Maintain a separate schema and sync only high-level metrics.

The typical PMS AI tables include:

- `camera_events`
- `zone_occupancy`
- `alerts`
- `entry_exit_log`
- `vehicles`
- `stats_daily` / `stats_parking_time`

The Core Backend will treat these as **read-mostly** tables, owned by PMS AI.

---

## 4. API Design

### 4.1 Auth & Users

Base path: `/api/v1`

- `POST /auth/register`  
  - Create new user (admin only, or disabled in production).
- `POST /auth/login`  
  - `{ email, password }` → `{ accessToken, refreshToken, user }`.
- `POST /auth/refresh`  
  - Takes refresh token, returns new access token.
- `GET /me` (auth required)  
  - Returns current user info + site roles.

### 4.2 Sites & Integrations

- `GET /sites` (auth; filter by user roles)  
  - List sites the user can access.
- `POST /sites` (super_admin only)  
  - Create new site.
- `GET /sites/:id`  
  - Details for one site.
- `PATCH /sites/:id`  
  - Update base info, PMS AI base URL, API key.
- `DELETE /sites/:id` (optional, admin only)  

### 4.3 Floors & Zones

- `GET /sites/:siteId/floors`
- `POST /sites/:siteId/floors`
- `PATCH /floors/:id`
- `DELETE /floors/:id`

- `GET /floors/:floorId/zones`
- `POST /floors/:floorId/zones`
- `PATCH /zones/:id`
- `DELETE /zones/:id`

### 4.4 Cameras (Configurator Core)

- `GET /sites/:siteId/cameras`
- `POST /sites/:siteId/cameras`
  - Body: `{ floorId, zoneId, name, ip, username, password, role, model }`
- `GET /cameras/:id`
- `PATCH /cameras/:id`
- `DELETE /cameras/:id`

**Internal consumption by PMS AI:**

- Either:
  - **Direct DB access** to `cameras` table, or
  - An internal API:
    - `GET /internal/sites/:siteId/cameras` (secured by internal API key).

---

## 5. Integration with PMS AI

### 5.1 Single Source of Truth for Cameras

- The **Core Backend** + Postgres own:
  - `sites`, `floors`, `zones`, `cameras`.
- PMS AI should:
  - Read camera configuration from the `cameras` table:
    - IP, credentials, associated zone(s), role.
  - Use it to:
    - Configure `camera_poller`
    - Map events to zones for occupancy, violations, intrusion.

### 5.2 Calling PMS AI from the Core Backend

For some endpoints, the Core Backend may need to call PMS AI directly (optional if we share DB). Example wrapper service:

```ts
async function callPms(siteId: string, path: string, params?: any) {
  const site = await sitesRepo.findById(siteId);
  if (!site || !site.pmsAiBaseUrl) throw new Error("PMS AI not configured");

  const url = new URL(path, site.pmsAiBaseUrl).toString();
  const headers: Record<string, string> = {};
  if (site.pmsAiApiKey) headers["X-API-Key"] = site.pmsAiApiKey;

  const res = await fetch(url + buildQuery(params), { headers });
  if (!res.ok) throw new Error(`PMS AI error: ${res.status}`);
  return res.json();
}
```

Example routes:

- `GET /sites/:id/occupancy` → GET `{pmsBaseUrl}/api/v1/occupancy`
- `GET /sites/:id/alerts` → GET `{pmsBaseUrl}/api/v1/alerts`
- `GET /sites/:id/health` → GET `{pmsBaseUrl}/api/v1/health`

Alternatively, if PMS AI writes all analytics to the shared Postgres, the Core Backend can read directly without HTTP calls.

---

## 6. Modules & Folder Structure

Proposed structure (Express + TS):

```text
src/
  app.ts              // Express app setup
  server.ts           // HTTP server bootstrap
  config/
    env.ts
    db.ts             // Postgres connection (Prisma/TypeORM)
  modules/
    auth/
      auth.controller.ts
      auth.service.ts
      auth.routes.ts
      auth.types.ts
    users/
      users.controller.ts
      users.service.ts
      users.routes.ts
      users.repository.ts
    sites/
      sites.controller.ts
      sites.service.ts
      sites.routes.ts
      sites.repository.ts
    floors/
      floors.controller.ts
      floors.service.ts
      floors.routes.ts
    zones/
      zones.controller.ts
      zones.service.ts
      zones.routes.ts
    cameras/
      cameras.controller.ts
      cameras.service.ts
      cameras.routes.ts
      cameras.repository.ts
    pms/
      pms.service.ts      // callPms wrapper
      pms.routes.ts       // optional health endpoints
  middleware/
    auth.middleware.ts
    error.middleware.ts
  utils/
    logger.ts
    validation.ts
  prisma/ or orm config...
```

---

## 7. Implementation Phases

### Phase 1 — Core Setup

- Initialize Node + TS + Express.
- Configure Postgres + ORM.
- Implement:
  - Auth (users, JWT).
  - Sites, Floors, Zones, Cameras CRUD.

### Phase 2 — PMS AI Integration

- Decide final approach:
  - Shared Postgres vs HTTP proxy.
- Implement:
  - PMS service (`pms.service.ts`).
  - Routes:
    - `/sites/:id/occupancy`
    - `/sites/:id/alerts`
    - `/sites/:id/health`

### Phase 3 — Hardening

- Add validation (Zod/Joi or class-validator).
- Add logging & error handling.
- Add unit/integration tests.

---

## 8. Notes for Client Deployment

- All components (Core Backend, PMS AI, Postgres) run **on-prem** inside the client’s LAN.
- Camera credentials and IPs **never leave the client network**.
- External access (if any) should go through a VPN or secure gateway controlled by Spectech/Client.
