// src/modules/floors/floors.controller.ts
import { Request, Response } from 'express';
import * as floorsService from './floors.service';

export async function list(req: Request, res: Response) {
  const floors = await floorsService.listFloors(req.params.siteId as string);
  res.json({ status: 'success', data: floors });
}

export async function getById(req: Request, res: Response) {
  const floor = await floorsService.getFloorById(req.params.id as string);
  res.json({ status: 'success', data: floor });
}

export async function create(req: Request, res: Response) {
  const floor = await floorsService.createFloor(req.params.siteId as string, req.body);
  res.status(201).json({ status: 'success', data: floor });
}

export async function update(req: Request, res: Response) {
  const floor = await floorsService.updateFloor(req.params.id as string, req.body);
  res.json({ status: 'success', data: floor });
}

export async function remove(req: Request, res: Response) {
  await floorsService.deleteFloor(req.params.id as string);
  res.status(204).send();
}
