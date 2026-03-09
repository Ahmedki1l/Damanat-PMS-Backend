// src/modules/auth/auth.routes.ts
import { Router } from 'express';
import * as authController from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { registerSchema, loginSchema, refreshSchema } from './auth.schemas';

const router = Router();

// POST /api/v1/auth/register — Admin only
router.post(
  '/register',
  authenticate,
  requireRole('ADMIN'),
  validate(registerSchema),
  authController.register
);

// POST /api/v1/auth/login — Public
router.post('/login', validate(loginSchema), authController.login);

// POST /api/v1/auth/refresh — Public
router.post('/refresh', validate(refreshSchema), authController.refresh);

// GET /api/v1/auth/me — Auth required
router.get('/me', authenticate, authController.me);

export default router;
