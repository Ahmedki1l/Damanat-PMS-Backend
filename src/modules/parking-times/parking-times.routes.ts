// src/modules/parking-times/parking-times.routes.ts
import { Router } from 'express';
import * as ptController from './parking-times.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { entrySchema, exitSchema } from './parking-times.schemas';

const router = Router({ mergeParams: true });

router.use(authenticate);

// POST /sites/:siteId/parking-times/entry
router.post('/entry', validate(entrySchema), ptController.recordEntry);

// POST /sites/:siteId/parking-times/exit
router.post('/exit', validate(exitSchema), ptController.recordExit);

// GET /sites/:siteId/parking-times/active
router.get('/active', ptController.getActive);

// GET /sites/:siteId/parking-times/stats
router.get('/stats', ptController.getStats);

// GET /sites/:siteId/parking-times/:plate
router.get('/:plate', ptController.getPlateHistory);

// GET /sites/:siteId/parking-times/:plate/day/:date
router.get('/:plate/day/:date', ptController.getPlateDay);

export default router;
