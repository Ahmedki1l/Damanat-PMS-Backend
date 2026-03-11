// src/modules/pms/pms.controller.ts
import { Request, Response } from 'express';
import * as pmsService from './pms.service';

export async function getOccupancy(req: Request, res: Response) {
  const data = await pmsService.getOccupancy(req.params.id as string);
  res.json({ status: 'success', data });
}

export async function getAlerts(req: Request, res: Response) {
  const data = await pmsService.getAlerts(
    req.params.id as string,
    req.query.alertType as string | undefined,
    req.query.isResolved as string | undefined,
  );
  res.json({ status: 'success', data });
}

export async function resolveAlert(req: Request, res: Response) {
  const alertId = parseInt(req.params.alertId as string, 10);
  if (isNaN(alertId)) {
    res.status(400).json({ status: 'error', message: 'Invalid alert ID' });
    return;
  }
  const data = await pmsService.resolveAlert(req.params.id as string, alertId);
  res.json({ status: 'success', data });
}

export async function getEvents(req: Request, res: Response) {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const data = await pmsService.getEvents(req.params.id as string, limit);
  res.json({ status: 'success', data });
}

export async function occupancyEntry(req: Request, res: Response) {
  const { zoneId, cameraId } = req.body;
  const data = await pmsService.occupancyEntry(req.params.id as string, zoneId, cameraId);
  res.json({ status: 'success', data });
}

export async function occupancyExit(req: Request, res: Response) {
  const { zoneId, cameraId } = req.body;
  const data = await pmsService.occupancyExit(req.params.id as string, zoneId, cameraId);
  res.json({ status: 'success', data });
}

export async function getEntryExitLog(req: Request, res: Response) {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const data = await pmsService.getEntryExitLog(req.params.id as string, limit);
  res.json({ status: 'success', data });
}

export async function getHealth(req: Request, res: Response) {
  const data = await pmsService.proxyPmsHealth(req.params.id as string);
  res.json({ status: 'success', data });
}

// ─── Zone Capacity Settings ─────────────────────────────────────────────────

export async function getZoneCapacities(req: Request, res: Response) {
  const data = await pmsService.getZoneCapacities(req.params.id as string);
  res.json({ status: 'success', data });
}

export async function updateZoneCapacity(req: Request, res: Response) {
  const { maxCapacity } = req.body;
  const data = await pmsService.updateZoneCapacity(
    req.params.id as string,
    req.params.zoneId as string,
    maxCapacity,
  );
  res.json({ status: 'success', data });
}
