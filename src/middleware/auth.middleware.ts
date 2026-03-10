// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/api-error';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware that verifies JWT access token from Authorization header.
 * Also accepts X-Service-Key header for service-to-service calls (e.g. FastAPI).
 * Attaches decoded user to req.user.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  // Service-to-service: accept X-Service-Key header
  if (env.SERVICE_API_KEY) {
    const serviceKey = req.headers['x-service-key'];
    if (serviceKey === env.SERVICE_API_KEY) {
      req.user = { id: 'service', email: 'service@internal', role: 'OPERATOR' };
      return next();
    }
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or invalid Authorization header');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}
