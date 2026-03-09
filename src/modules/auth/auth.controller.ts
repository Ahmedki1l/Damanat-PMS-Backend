// src/modules/auth/auth.controller.ts
import { Request, Response } from 'express';
import * as authService from './auth.service';

export async function register(req: Request, res: Response) {
  const user = await authService.register(req.body);
  res.status(201).json({ status: 'success', data: user });
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body);
  res.json({ status: 'success', data: result });
}

export async function refresh(req: Request, res: Response) {
  const result = await authService.refreshTokens(req.body.refreshToken);
  res.json({ status: 'success', data: result });
}

export async function me(req: Request, res: Response) {
  const user = await authService.getMe(req.user!.id);
  res.json({ status: 'success', data: user });
}
