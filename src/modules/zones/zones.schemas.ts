// src/modules/zones/zones.schemas.ts
import { z } from 'zod/v4';

export const createZoneSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['PARKING', 'RESTRICTED', 'INTRUSION', 'OTHER']).optional(),
  description: z.string().optional(),
  maxCapacity: z.number().int().positive().optional(),
});

export const updateZoneSchema = createZoneSchema.partial();

export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type UpdateZoneInput = z.infer<typeof updateZoneSchema>;
