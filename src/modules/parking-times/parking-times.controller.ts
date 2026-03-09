// src/modules/parking-times/parking-times.controller.ts
import { Request, Response } from 'express';
import * as ptService from './parking-times.service';

export async function recordEntry(req: Request, res: Response) {
  const result = await ptService.recordEntry(req.params.siteId as string, req.body);
  res.status(201).json({ status: 'success', data: result });
}

export async function recordExit(req: Request, res: Response) {
  const result = await ptService.recordExit(req.params.siteId as string, req.body);
  res.json({ status: 'success', data: result });
}

export async function getPlateHistory(req: Request, res: Response) {
  const data = await ptService.getPlateHistory(req.params.siteId as string, req.params.plate as string);
  res.json({ status: 'success', data });
}

export async function getPlateDay(req: Request, res: Response) {
  const data = await ptService.getPlateDay(
    req.params.siteId as string,
    req.params.plate as string,
    req.params.date as string,
  );
  res.json({ status: 'success', data });
}

export async function getActive(req: Request, res: Response) {
  const data = await ptService.getActiveVehicles(req.params.siteId as string);
  res.json({ status: 'success', data });
}

export async function getStats(req: Request, res: Response) {
  const data = await ptService.getStats(req.params.siteId as string);
  res.json({ status: 'success', data });
}
