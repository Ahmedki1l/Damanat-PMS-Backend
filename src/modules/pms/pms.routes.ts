// src/modules/pms/pms.routes.ts
import { Router } from 'express';
import * as pmsController from './pms.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// All mounted under /api/v1/sites/:id
router.get('/:id/occupancy', pmsController.getOccupancy);
router.get('/:id/alerts', pmsController.getAlerts);
router.get('/:id/events', pmsController.getEvents);
router.get('/:id/health', pmsController.getHealth);

export default router;
