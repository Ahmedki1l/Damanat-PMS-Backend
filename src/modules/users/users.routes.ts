// src/modules/users/users.routes.ts
import { Router } from 'express';
import * as usersController from './users.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { updateUserSchema, assignSiteRoleSchema } from './users.schemas';

const router = Router();

// All user routes require at least ADMIN
router.use(authenticate, requireRole('ADMIN'));

router.get('/', usersController.list);
router.get('/:id', usersController.getById);
router.patch('/:id', validate(updateUserSchema), usersController.update);
router.delete('/:id', usersController.remove);

// Site role management
router.post('/:id/site-roles', validate(assignSiteRoleSchema), usersController.assignSiteRole);
router.delete('/:id/site-roles/:siteId', usersController.removeSiteRole);

export default router;
