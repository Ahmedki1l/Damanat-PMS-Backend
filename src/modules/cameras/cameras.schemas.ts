// src/modules/cameras/cameras.schemas.ts
import { z } from 'zod/v4';

export const createCameraSchema = z.object({
  floorId: z.uuid(),
  zoneId: z.uuid().optional(),
  name: z.string().min(1),
  ip: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1), // plaintext; will be encrypted before storage
  model: z.string().optional(),
  role: z.enum(['OCCUPANCY', 'ENTRY', 'EXIT', 'VIOLATION', 'INTRUSION']).optional(),
});

export const updateCameraSchema = z.object({
  floorId: z.uuid().optional(),
  zoneId: z.uuid().optional(),
  name: z.string().min(1).optional(),
  ip: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  model: z.string().optional(),
  role: z.enum(['OCCUPANCY', 'ENTRY', 'EXIT', 'VIOLATION', 'INTRUSION']).optional(),
  isActive: z.boolean().optional(),
});

export type CreateCameraInput = z.infer<typeof createCameraSchema>;
export type UpdateCameraInput = z.infer<typeof updateCameraSchema>;
