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

export async function getOccupancy(siteId: string) {
  await verifySite(siteId);

  // Get all parking zones for this site
  const parkingZones = await prisma.zone.findMany({
    where: { type: 'PARKING', floor: { siteId } },
    select: { id: true, name: true, maxCapacity: true },
  });

  const parkingZoneIds = new Set(parkingZones.map((z: any) => z.id));

  const occupancy = await prisma.zoneOccupancy.findMany({
    orderBy: { lastUpdated: 'desc' },
  });

  const zones = occupancy.map((z: any) => ({
    zoneId: z.zoneId,
    cameraId: z.cameraId,
    currentCount: z.currentCount,
    maxCapacity: z.maxCapacity,
    percentage: z.maxCapacity > 0 ? Math.round((z.currentCount / z.maxCapacity) * 100) : 0,
    isFull: z.maxCapacity > 0 ? z.currentCount >= z.maxCapacity : false,
    lastUpdated: z.lastUpdated,
  }));

  // Total across parking zones only
  const parkingOccupancy = occupancy.filter((z: any) => parkingZoneIds.has(z.zoneId));
  const totalCurrentCount = parkingOccupancy.reduce((sum: number, z: any) => sum + z.currentCount, 0);
  const totalMaxCapacity   = parkingZones.reduce((sum: number, z: any) => sum + z.maxCapacity, 0);

  return {
    total: {
      currentCount: totalCurrentCount,
      maxCapacity: totalMaxCapacity,
      percentage: totalMaxCapacity > 0 ? Math.round((totalCurrentCount / totalMaxCapacity) * 100) : 0,
      isFull: totalMaxCapacity > 0 ? totalCurrentCount >= totalMaxCapacity : false,
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

export async function getAlerts(siteId: string, alertType?: string, isResolved?: string) {
  await verifySite(siteId);

  const where: any = {};
  if (alertType) where.alertType = alertType;
  if (isResolved !== undefined) where.isResolved = isResolved === 'true' ? 1 : 0;

  const alerts = await prisma.alert.findMany({
    where,
    orderBy: { triggeredAt: 'desc' },
    take: 100,
  });

  return alerts;
}

export async function getEntryExitLog(siteId: string, limit = 50) {
  await verifySite(siteId);

  return prisma.entryExitLog.findMany({
    orderBy: { eventTime: 'desc' },
    take: limit,
  });
}

export async function getEvents(siteId: string, limit = 50) {
  await verifySite(siteId);

  return prisma.cameraEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ─── HTTP Proxy (fallback) ──────────────────────────────────────────────────

export async function proxyPmsHealth(siteId: string) {
  const site = await verifySite(siteId);
  const baseUrl = site.pmsAiBaseUrl || env.PMS_AI_DEFAULT_URL;

  if (!baseUrl) {
    throw ApiError.badRequest('PMS AI base URL not configured for this site');
  }

  try {
    const url = new URL('/api/v1/health', baseUrl).toString();
    const headers: Record<string, string> = {};
    if (site.pmsAiApiKey) headers['X-API-Key'] = site.pmsAiApiKey;

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`PMS AI returned ${res.status}`);
    return await res.json();
  } catch (err) {
    logger.warn({ err, siteId }, 'PMS AI health check failed');
    return { status: 'unreachable', error: (err as Error).message };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function verifySite(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw ApiError.notFound('Site not found');
  return site;
}
