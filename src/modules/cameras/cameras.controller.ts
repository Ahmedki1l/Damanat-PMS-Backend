// src/modules/cameras/cameras.controller.ts
import { Request, Response } from 'express';
import * as camerasService from './cameras.service';

export async function list(req: Request, res: Response) {
  const cameras = await camerasService.listCameras(req.params.siteId as string);
  res.json({ status: 'success', data: cameras });
}

export async function getById(req: Request, res: Response) {
  const camera = await camerasService.getCameraById(req.params.id as string);
  res.json({ status: 'success', data: camera });
}

export async function create(req: Request, res: Response) {
  const camera = await camerasService.createCamera(req.params.siteId as string, req.body);
  res.status(201).json({ status: 'success', data: camera });
}

export async function update(req: Request, res: Response) {
  const camera = await camerasService.updateCamera(req.params.id as string, req.body);
  res.json({ status: 'success', data: camera });
}

export async function remove(req: Request, res: Response) {
  await camerasService.deleteCamera(req.params.id as string);
  res.status(204).send();
}
