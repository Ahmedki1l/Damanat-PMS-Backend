// src/modules/floors/floors.schemas.ts
import { z } from 'zod/v4';

export const createFloorSchema = z.object({
  name: z.string().min(1),
  level: z.number().int().optional(),
});

export const updateFloorSchema = createFloorSchema.partial();

export type CreateFloorInput = z.infer<typeof createFloorSchema>;
export type UpdateFloorInput = z.infer<typeof updateFloorSchema>;
