// src/modules/floors/floors.routes.ts
import { Router } from 'express';
import * as floorsController from './floors.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createFloorSchema, updateFloorSchema } from './floors.schemas';

const router = Router({ mergeParams: true });

router.use(authenticate);

// Nested under /sites/:siteId/floors
router.get('/', floorsController.list);
router.post('/', requireRole('ADMIN'), validate(createFloorSchema), floorsController.create);

// Direct access
router.get('/:id', floorsController.getById);
router.patch('/:id', requireRole('ADMIN'), validate(updateFloorSchema), floorsController.update);
router.delete('/:id', requireRole('ADMIN'), floorsController.remove);

export default router;
