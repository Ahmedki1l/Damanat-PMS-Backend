// src/modules/zones/zones.routes.ts
import { Router } from 'express';
import * as zonesController from './zones.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createZoneSchema, updateZoneSchema } from './zones.schemas';

const router = Router({ mergeParams: true });

router.use(authenticate);

// Nested under /floors/:floorId/zones
router.get('/', zonesController.list);
router.post('/', requireRole('ADMIN'), validate(createZoneSchema), zonesController.create);

// Direct access
router.get('/:id', zonesController.getById);
router.patch('/:id', requireRole('ADMIN'), validate(updateZoneSchema), zonesController.update);
router.delete('/:id', requireRole('ADMIN'), zonesController.remove);

export default router;
