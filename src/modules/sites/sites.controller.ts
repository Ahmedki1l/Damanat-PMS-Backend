// src/modules/sites/sites.controller.ts
import { Request, Response } from 'express';
import * as sitesService from './sites.service';

export async function list(req: Request, res: Response) {
  const sites = await sitesService.listSites(req.user!.id, req.user!.role);
  res.json({ status: 'success', data: sites });
}

export async function getById(req: Request, res: Response) {
  const site = await sitesService.getSiteById(req.params.id as string);
  res.json({ status: 'success', data: site });
}

export async function create(req: Request, res: Response) {
  const site = await sitesService.createSite(req.body);
  res.status(201).json({ status: 'success', data: site });
}

export async function update(req: Request, res: Response) {
  const site = await sitesService.updateSite(req.params.id as string, req.body);
  res.json({ status: 'success', data: site });
}

export async function remove(req: Request, res: Response) {
  await sitesService.deleteSite(req.params.id as string);
  res.status(204).send();
}
