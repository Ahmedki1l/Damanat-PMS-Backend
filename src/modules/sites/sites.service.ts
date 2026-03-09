// src/modules/sites/sites.service.ts
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/api-error';
import type { CreateSiteInput, UpdateSiteInput } from './sites.schemas';

const SITE_INCLUDE = {
  floors: { select: { id: true, name: true, level: true } },
  _count: { select: { cameras: true, floors: true } },
};

export async function listSites(userId: string, userRole: string) {
  // SUPER_ADMIN sees all sites; others see only assigned sites
  if (userRole === 'SUPER_ADMIN') {
    return prisma.site.findMany({ include: SITE_INCLUDE, orderBy: { createdAt: 'desc' } });
  }

  return prisma.site.findMany({
    where: {
      userRoles: { some: { userId } },
    },
    include: SITE_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSiteById(id: string) {
  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      ...SITE_INCLUDE,
      floors: {
        include: {
          zones: { select: { id: true, name: true, type: true, maxCapacity: true } },
        },
        orderBy: { level: 'asc' },
      },
    },
  });
  if (!site) throw ApiError.notFound('Site not found');
  return site;
}

export async function createSite(input: CreateSiteInput) {
  return prisma.site.create({ data: input, include: SITE_INCLUDE });
}

export async function updateSite(id: string, input: UpdateSiteInput) {
  await getSiteById(id);
  return prisma.site.update({ where: { id }, data: input, include: SITE_INCLUDE });
}

export async function deleteSite(id: string) {
  await getSiteById(id);
  await prisma.site.delete({ where: { id } });
}
