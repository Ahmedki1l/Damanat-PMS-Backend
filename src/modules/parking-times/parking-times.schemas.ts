// src/modules/parking-times/parking-times.schemas.ts
import { z } from 'zod/v4';

export const entrySchema = z.object({
  plate: z.string().min(1, 'Plate is required'),
  entryAt: z.string().optional(),
  entryCamera: z.string().min(1, 'Entry camera is required'),
  zone: z.string().optional(),
});

export const exitSchema = z.object({
  plate: z.string().min(1, 'Plate is required'),
  exitAt: z.string().optional(),
  exitCamera: z.string().min(1, 'Exit camera is required'),
});
