// src/modules/zones/zones.controller.ts
import { Request, Response } from 'express';
import * as zonesService from './zones.service';

export async function list(req: Request, res: Response) {
  const zones = await zonesService.listZones(req.params.floorId as string);
  res.json({ status: 'success', data: zones });
}

export async function getById(req: Request, res: Response) {
  const zone = await zonesService.getZoneById(req.params.id as string);
  res.json({ status: 'success', data: zone });
}

export async function create(req: Request, res: Response) {
  const zone = await zonesService.createZone(req.params.floorId as string, req.body);
  res.status(201).json({ status: 'success', data: zone });
}

export async function update(req: Request, res: Response) {
  const zone = await zonesService.updateZone(req.params.id as string, req.body);
  res.json({ status: 'success', data: zone });
}

export async function remove(req: Request, res: Response) {
  await zonesService.deleteZone(req.params.id as string);
  res.status(204).send();
}
