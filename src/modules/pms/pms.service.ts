// src/modules/pms/pms.service.ts
/**
 * PMS AI Integration Service.
 *
 * Two strategies:
 * 1. Direct DB — read PMS AI tables (camera_events, zone_occupancy, alerts) via Prisma.
 * 2. HTTP Proxy — call PMS AI's REST API using the site's pms_ai_base_url.
 *
 * Direct DB is the default (faster, no network hop). HTTP proxy is a fallback.
 */
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/api-error';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// ─── Direct DB Reads ────────────────────────────────────────────────────────

// Zone fill priority: B1 first → B2 → GF → any future zones
const ZONE_FILL_ORDER = ['B1-PARKING', 'B2-PARKING', 'GF-PARKING'];

export async function getOccupancy(siteId: string) {
  await verifySite(siteId);

  // 1. Count vehicles currently inside: entered but not yet exited, no test data
  const activeResult = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) AS count
    FROM entry_exit_log e
    WHERE e.gate = 'entry'
      AND (e.is_test IS NULL OR e.is_test = false)
      AND NOT EXISTS (
        SELECT 1 FROM entry_exit_log x
        WHERE x.gate    = 'exit'
          AND x.matched_entry_id = e.id
      )
  `;
  const activeCount = Number(activeResult[0].count);

  // 2. Get zone capacities from zone_occupancy (source of truth for max slots)
  const allZoneRows = await prisma.zoneOccupancy.findMany({ orderBy: { id: 'asc' } });
  const totalRow      = allZoneRows.find((z: any) => /total/i.test(z.zoneId));
  const individualRaw = allZoneRows.filter((z: any) => !/total/i.test(z.zoneId));

  // 3. Sort zones by fill priority
  const orderedZones = [
    ...ZONE_FILL_ORDER
      .map(id => individualRaw.find((z: any) => z.zoneId === id))
      .filter(Boolean),
    ...individualRaw.filter((z: any) => !ZONE_FILL_ORDER.includes(z.zoneId)),
  ] as typeof individualRaw;

  // 4. Distribute active count across zones in priority order
  let remaining = activeCount;
  const zones = orderedZones.map((z: any) => {
    const assigned = Math.min(remaining, z.maxCapacity);
    remaining = Math.max(0, remaining - assigned);
    return {
      zoneId:       z.zoneId,
      cameraId:     z.cameraId,
      currentCount: assigned,
      maxCapacity:  z.maxCapacity,
      percentage:   z.maxCapacity > 0 ? Math.round((assigned / z.maxCapacity) * 100) : 0,
      isFull:       z.maxCapacity > 0 ? assigned >= z.maxCapacity : false,
      lastUpdated:  z.lastUpdated,
    };
  });

  // 5. Total capacity from the aggregate row (or sum of individual zones)
  const totalMaxCapacity = totalRow
    ? totalRow.maxCapacity
    : zones.reduce((s: number, z: any) => s + z.maxCapacity, 0);

  return {
    total: {
      currentCount: activeCount,
      maxCapacity:  totalMaxCapacity,
      percentage:   totalMaxCapacity > 0 ? Math.round((activeCount / totalMaxCapacity) * 100) : 0,
      isFull:       totalMaxCapacity > 0 ? activeCount >= totalMaxCapacity : false,
    },
    zones,
  };
}

export async function occupancyEntry(siteId: string, zoneId: string, cameraId: string) {
  await verifySite(siteId);

  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!zone) throw ApiError.notFound('Zone not found');

  const row = await prisma.zoneOccupancy.upsert({
    where: { zoneId },
    create: {
      zoneId,
      cameraId,
      currentCount: 1,
      maxCapacity: zone.maxCapacity,
      lastUpdated: new Date(),
    },
    update: {
      currentCount: { increment: 1 },
      cameraId,
      lastUpdated: new Date(),
    },
  });

  return buildOccupancyResponse(row);
}

export async function occupancyExit(siteId: string, zoneId: string, cameraId: string) {
  await verifySite(siteId);

  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!zone) throw ApiError.notFound('Zone not found');

  // Atomic decrement floored at 0
  await prisma.$executeRaw`
    UPDATE zone_occupancy
    SET current_count = GREATEST(current_count - 1, 0),
        camera_id     = ${cameraId},
        last_updated  = NOW()
    WHERE zone_id = ${zoneId}
  `;

  const row = await prisma.zoneOccupancy.upsert({
    where: { zoneId },
    create: {
      zoneId,
      cameraId,
      currentCount: 0,
      maxCapacity: zone.maxCapacity,
      lastUpdated: new Date(),
    },
    update: { lastUpdated: new Date() }, // already updated by executeRaw above
  });

  return buildOccupancyResponse(row);
}

function buildOccupancyResponse(row: any) {
  return {
    zoneId:       row.zoneId,
    currentCount: row.currentCount,
    maxCapacity:  row.maxCapacity,
    percentage:   row.maxCapacity > 0 ? Math.round((row.currentCount / row.maxCapacity) * 100) : 0,
    isFull:       row.maxCapacity > 0 ? row.currentCount >= row.maxCapacity : false,
    lastUpdated:  row.lastUpdated,
  };
}

export async function resolveAlert(siteId: string, alertId: number) {
  const site = await verifySite(siteId);
  const baseUrl = (site.pmsAiBaseUrl || env.PMS_AI_DEFAULT_URL || '').replace(/\/$/, '');

  const alert = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!alert) throw ApiError.notFound('Alert not found');
  if (alert.isResolved) throw ApiError.conflict('Alert is already resolved');

  const updated = await prisma.alert.update({
    where: { id: alertId },
    data: { isResolved: true, resolvedAt: new Date() },
  });

  return {
    id:          updated.id,
    isResolved:  updated.isResolved,
    resolvedAt:  updated.resolvedAt,
    snapshotUrl: resolveSnapshotUrl(updated.snapshotPath, baseUrl),
  };
}

export async function getAlerts(siteId: string, alertType?: string, isResolved?: string) {
  const site = await verifySite(siteId);
  const baseUrl = (site.pmsAiBaseUrl || env.PMS_AI_DEFAULT_URL || '').replace(/\/$/, '');

  const where: any = { NOT: { isTest: true } };
  if (alertType) where.alertType = alertType;
  if (isResolved !== undefined) where.isResolved = isResolved === 'true';

  const alerts = await prisma.alert.findMany({
    where,
    orderBy: { triggeredAt: 'desc' },
    take: 100,
  });

  return alerts.map((a: any) => ({
    id:          a.id,
    alertType:   a.alertType,
    cameraId:    a.cameraId,
    zoneId:      a.zoneId,
    eventType:   a.eventType,
    description: a.description,
    isResolved:  a.isResolved,
    triggeredAt: a.triggeredAt,
    resolvedAt:  a.resolvedAt,
    snapshotUrl: resolveSnapshotUrl(a.snapshotPath, baseUrl),
  }));
}

export async function getEntryExitLog(siteId: string, limit = 50) {
  const site = await verifySite(siteId);
  const baseUrl = (site.pmsAiBaseUrl || env.PMS_AI_DEFAULT_URL || '').replace(/\/$/, '');

  const rows = await prisma.entryExitLog.findMany({
    where: { NOT: { isTest: true } },
    orderBy: { eventTime: 'desc' },
    take: limit,
  });

  return rows.map((r: any) => ({
    id:              r.id,
    plateNumber:     r.plateNumber,
    vehicleId:       r.vehicleId,
    vehicleType:     r.vehicleType,
    gate:            r.gate,
    cameraId:        r.cameraId,
    eventTime:       r.eventTime,
    parkingDuration: r.parkingDuration,
    matchedEntryId:  r.matchedEntryId,
    createdAt:       r.createdAt,
    snapshotUrl:     resolveSnapshotUrl(r.snapshotPath, baseUrl),
  }));
}

export async function getEvents(siteId: string, limit = 50) {
  const site = await verifySite(siteId);
  const baseUrl = (site.pmsAiBaseUrl || env.PMS_AI_DEFAULT_URL || '').replace(/\/$/, '');

  const events = await prisma.cameraEvent.findMany({
    where: { NOT: { isTest: true } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return events.map((e: any) => ({
    id:               e.id,
    cameraId:         e.cameraId,
    deviceSerial:     e.deviceSerial,
    channelId:        e.channelId,
    eventType:        e.eventType,
    eventState:       e.eventState,
    eventDescription: e.eventDescription,
    detectionTarget:  e.detectionTarget,
    regionId:         e.regionId,
    channelName:      e.channelName,
    triggerTime:      e.triggerTime,
    createdAt:        e.createdAt,
    snapshotUrl:      resolveSnapshotUrl(e.snapshotPath, baseUrl),
  }));
}

// ─── Zone Capacity Settings ─────────────────────────────────────────────────

export async function getZoneCapacities(siteId: string) {
  await verifySite(siteId);

  const rows = await prisma.zoneOccupancy.findMany({
    orderBy: { id: 'asc' },
    select: { zoneId: true, maxCapacity: true, currentCount: true },
  });

  return rows.map((r: any) => ({
    zoneId:      r.zoneId,
    maxCapacity: r.maxCapacity,
    currentCount: r.currentCount,
    isAggregate: /total/i.test(r.zoneId),
  }));
}

export async function updateZoneCapacity(siteId: string, zoneId: string, maxCapacity: number) {
  await verifySite(siteId);

  const existing = await prisma.zoneOccupancy.findUnique({ where: { zoneId } });
  if (!existing) throw ApiError.notFound(`Zone '${zoneId}' not found in occupancy table`);

  const updated = await prisma.zoneOccupancy.update({
    where: { zoneId },
    data: { maxCapacity },
    select: { zoneId: true, maxCapacity: true, currentCount: true },
  });

  return {
    zoneId:      updated.zoneId,
    maxCapacity: updated.maxCapacity,
    currentCount: updated.currentCount,
  };
}

// ─── HTTP Proxy (fallback) ──────────────────────────────────────────────────

export async function proxyPmsHealth(siteId: string) {
  const site = await verifySite(siteId);
  const baseUrl = site.pmsAiBaseUrl || env.PMS_AI_DEFAULT_URL;

  if (!baseUrl) {
    return { status: 'unreachable', error: 'PMS AI base URL not configured for this site' };
  }

  try {
    const url = new URL('/api/v1/health', baseUrl).toString();
    const headers: Record<string, string> = {};
    if (site.pmsAiApiKey) headers['X-API-Key'] = site.pmsAiApiKey;

    const timeoutMs = env.NODE_ENV === 'production' ? 5000 : 2000;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`PMS AI returned ${res.status}`);
    return await res.json();
  } catch (err) {
    if (env.NODE_ENV !== 'production') {
      logger.debug({ siteId, url: baseUrl }, 'PMS AI health check skipped (dev: server unreachable)');
    } else {
      logger.warn({ err, siteId }, 'PMS AI health check failed');
    }
    return { status: 'unreachable', error: (err as Error).message };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function verifySite(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw ApiError.notFound('Site not found');
  return site;
}

function resolveSnapshotUrl(snapshotPath: string | null, baseUrl: string): string | null {
  if (!snapshotPath) return null;
  if (snapshotPath.startsWith('http://') || snapshotPath.startsWith('https://')) return snapshotPath;
  const normalized = snapshotPath.replace(/\\/g, '/');
  return baseUrl ? `${baseUrl}/${normalized}` : null;
}
