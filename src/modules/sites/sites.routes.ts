// src/modules/sites/sites.routes.ts
import { Router } from 'express';
import * as sitesController from './sites.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createSiteSchema, updateSiteSchema } from './sites.schemas';

const router = Router();

router.use(authenticate);

router.get('/', sitesController.list);
router.get('/:id', sitesController.getById);
router.post('/', requireRole('SUPER_ADMIN'), validate(createSiteSchema), sitesController.create);
router.patch('/:id', requireRole('ADMIN'), validate(updateSiteSchema), sitesController.update);
router.delete('/:id', requireRole('SUPER_ADMIN'), sitesController.remove);

export default router;
