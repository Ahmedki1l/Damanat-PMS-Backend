// src/middleware/role.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error';

/**
 * Role hierarchy: SUPER_ADMIN > ADMIN > OPERATOR > VIEWER
 */
const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  OPERATOR: 2,
  VIEWER: 1,
};

/**
 * Factory middleware: requires the user's global role to be at or above the given minimum.
 * Must be used AFTER authenticate middleware.
 */
export function requireRole(minimumRole: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 999;

    if (userLevel < requiredLevel) {
      throw ApiError.forbidden(`Requires ${minimumRole} role or higher`);
    }

    next();
  };
}
