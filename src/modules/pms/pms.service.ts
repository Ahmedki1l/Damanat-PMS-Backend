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

  // Get all cameras for this site, then find occupancy data for their zones
  const cameras = await prisma.cameraConfig.findMany({
    where: { siteId },
    select: { name: true, zoneId: true, zone: { select: { name: true } } },
  });

  const occupancy = await prisma.zoneOccupancy.findMany({
    orderBy: { lastUpdated: 'desc' },
  });

  return occupancy.map((z: any) => ({
    zoneId: z.zoneId,
    cameraId: z.cameraId,
    currentCount: z.currentCount,
    maxCapacity: z.maxCapacity,
    percentage: z.maxCapacity > 0 ? Math.round((z.currentCount / z.maxCapacity) * 100) : 0,
    isFull: z.maxCapacity > 0 ? z.currentCount >= z.maxCapacity : false,
    lastUpdated: z.lastUpdated,
  }));
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
