// src/modules/pms/pms.routes.ts
import { Router } from 'express';
import { z } from 'zod/v4';
import * as pmsController from './pms.controller';
import * as analyticsController from './pms-analytics.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

router.use(authenticate);

const updateCapacitySchema = z.object({
  maxCapacity: z.number().int().min(1),
});

// All mounted under /api/v1/sites/:id
router.get('/:id/occupancy',                                                                   pmsController.getOccupancy);
router.post('/:id/occupancy/entry',                                                            pmsController.occupancyEntry);
router.post('/:id/occupancy/exit',                                                             pmsController.occupancyExit);
router.get('/:id/alerts',                                                                      pmsController.getAlerts);
router.patch('/:id/alerts/:alertId/resolve',       requireRole('OPERATOR'),                    pmsController.resolveAlert);
router.get('/:id/events',                                                                      pmsController.getEvents);
router.get('/:id/entry-exit-log',                                                              pmsController.getEntryExitLog);
router.get('/:id/health',                                                                      pmsController.getHealth);

// Zone capacity settings — read: any authenticated user, write: ADMIN+
router.get('/:id/settings/zone-capacities',                                                    pmsController.getZoneCapacities);
router.patch('/:id/settings/zone-capacities/:zoneId', requireRole('ADMIN'),
  validate(updateCapacitySchema),                                                              pmsController.updateZoneCapacity);

// Analytics
router.get('/:id/analytics/traffic-heatmap',                                                   analyticsController.getTrafficHeatmap);
router.get('/:id/analytics/avg-parking-duration',                                              analyticsController.getAvgParkingDuration);
router.get('/:id/analytics/frequent-visitors',                                                 analyticsController.getFrequentVisitors);
router.get('/:id/analytics/turnaround-time',                                                   analyticsController.getTurnaroundTime);

export default router;
