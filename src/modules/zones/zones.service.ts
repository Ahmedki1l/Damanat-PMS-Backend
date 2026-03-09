// src/modules/zones/zones.service.ts
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/api-error';
import { ZoneType } from '@prisma/client';
import type { CreateZoneInput, UpdateZoneInput } from './zones.schemas';

export async function listZones(floorId: string) {
  const floor = await prisma.floor.findUnique({ where: { id: floorId } });
  if (!floor) throw ApiError.notFound('Floor not found');

  return prisma.zone.findMany({
    where: { floorId },
    include: { _count: { select: { cameras: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function getZoneById(id: string) {
  const zone = await prisma.zone.findUnique({
    where: { id },
    include: { _count: { select: { cameras: true } } },
  });
  if (!zone) throw ApiError.notFound('Zone not found');
  return zone;
}

export async function createZone(floorId: string, input: CreateZoneInput) {
  const floor = await prisma.floor.findUnique({ where: { id: floorId } });
  if (!floor) throw ApiError.notFound('Floor not found');

  return prisma.zone.create({
    data: {
      floorId,
      name: input.name,
      type: (input.type as ZoneType) || 'PARKING',
      description: input.description,
      maxCapacity: input.maxCapacity ?? 10,
    },
  });
}

export async function updateZone(id: string, input: UpdateZoneInput) {
  await getZoneById(id);
  return prisma.zone.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type as ZoneType }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.maxCapacity !== undefined && { maxCapacity: input.maxCapacity }),
    },
  });
}

export async function deleteZone(id: string) {
  await getZoneById(id);
  await prisma.zone.delete({ where: { id } });
}
