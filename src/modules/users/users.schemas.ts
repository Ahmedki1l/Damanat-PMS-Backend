// src/modules/users/users.schemas.ts
import { z } from 'zod/v4';

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER']).optional(),
});

export const assignSiteRoleSchema = z.object({
  siteId: z.uuid(),
  role: z.enum(['ADMIN', 'OPERATOR', 'VIEWER']),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AssignSiteRoleInput = z.infer<typeof assignSiteRoleSchema>;
