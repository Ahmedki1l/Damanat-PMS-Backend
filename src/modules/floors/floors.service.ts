// src/modules/floors/floors.service.ts
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/api-error';
import type { CreateFloorInput, UpdateFloorInput } from './floors.schemas';

const FLOOR_INCLUDE = {
  zones: { select: { id: true, name: true, type: true, maxCapacity: true } },
  _count: { select: { cameras: true, zones: true } },
};

export async function listFloors(siteId: string) {
  // Verify site exists
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw ApiError.notFound('Site not found');

  return prisma.floor.findMany({
    where: { siteId },
    include: FLOOR_INCLUDE,
    orderBy: { level: 'asc' },
  });
}

export async function getFloorById(id: string) {
  const floor = await prisma.floor.findUnique({ where: { id }, include: FLOOR_INCLUDE });
  if (!floor) throw ApiError.notFound('Floor not found');
  return floor;
}

export async function createFloor(siteId: string, input: CreateFloorInput) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw ApiError.notFound('Site not found');

  return prisma.floor.create({
    data: { ...input, siteId },
    include: FLOOR_INCLUDE,
  });
}

export async function updateFloor(id: string, input: UpdateFloorInput) {
  await getFloorById(id);
  return prisma.floor.update({ where: { id }, data: input, include: FLOOR_INCLUDE });
}

export async function deleteFloor(id: string) {
  await getFloorById(id);
  await prisma.floor.delete({ where: { id } });
}
