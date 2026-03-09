// src/modules/users/users.service.ts
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/api-error';
import { GlobalRole, SiteRole } from '@prisma/client';
import type { UpdateUserInput, AssignSiteRoleInput } from './users.schemas';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  siteRoles: {
    select: {
      id: true,
      siteId: true,
      role: true,
      site: { select: { id: true, name: true } },
    },
  },
};

export async function listUsers() {
  return prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  await getUserById(id); // ensure exists
  return prisma.user.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.role && { role: input.role as GlobalRole }),
    },
    select: USER_SELECT,
  });
}

export async function deleteUser(id: string) {
  await getUserById(id);
  await prisma.user.delete({ where: { id } });
}

export async function assignSiteRole(userId: string, input: AssignSiteRoleInput) {
  await getUserById(userId);

  // Verify site exists
  const site = await prisma.site.findUnique({ where: { id: input.siteId } });
  if (!site) throw ApiError.notFound('Site not found');

  return prisma.userSiteRole.upsert({
    where: { userId_siteId: { userId, siteId: input.siteId } },
    create: {
      userId,
      siteId: input.siteId,
      role: input.role as SiteRole,
    },
    update: {
      role: input.role as SiteRole,
    },
  });
}

export async function removeSiteRole(userId: string, siteId: string) {
  const existing = await prisma.userSiteRole.findUnique({
    where: { userId_siteId: { userId, siteId } },
  });
  if (!existing) throw ApiError.notFound('Site role not found');
  await prisma.userSiteRole.delete({ where: { id: existing.id } });
}
