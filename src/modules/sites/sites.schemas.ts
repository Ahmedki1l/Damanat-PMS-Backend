// src/modules/sites/sites.schemas.ts
import { z } from 'zod/v4';

export const createSiteSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  pmsAiBaseUrl: z.url().optional(),
  pmsAiApiKey: z.string().optional(),
});

export const updateSiteSchema = createSiteSchema.partial();

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
