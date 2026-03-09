// src/modules/users/users.controller.ts
import { Request, Response } from 'express';
import * as usersService from './users.service';

export async function list(req: Request, res: Response) {
  const users = await usersService.listUsers();
  res.json({ status: 'success', data: users });
}

export async function getById(req: Request, res: Response) {
  const user = await usersService.getUserById(req.params.id as string);
  res.json({ status: 'success', data: user });
}

export async function update(req: Request, res: Response) {
  const user = await usersService.updateUser(req.params.id as string, req.body);
  res.json({ status: 'success', data: user });
}

export async function remove(req: Request, res: Response) {
  await usersService.deleteUser(req.params.id as string);
  res.status(204).send();
}

export async function assignSiteRole(req: Request, res: Response) {
  const result = await usersService.assignSiteRole(req.params.id as string, req.body);
  res.json({ status: 'success', data: result });
}

export async function removeSiteRole(req: Request, res: Response) {
  await usersService.removeSiteRole(req.params.id as string, req.params.siteId as string);
  res.status(204).send();
}
