// src/modules/cameras/cameras.routes.ts
import { Router } from 'express';
import * as camerasController from './cameras.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createCameraSchema, updateCameraSchema } from './cameras.schemas';

const router = Router({ mergeParams: true });

router.use(authenticate);

// Nested under /sites/:siteId/cameras
router.get('/', camerasController.list);
router.post('/', requireRole('ADMIN'), validate(createCameraSchema), camerasController.create);

// Direct access
router.get('/:id', camerasController.getById);
router.patch('/:id', requireRole('ADMIN'), validate(updateCameraSchema), camerasController.update);
router.delete('/:id', requireRole('ADMIN'), camerasController.remove);

export default router;
