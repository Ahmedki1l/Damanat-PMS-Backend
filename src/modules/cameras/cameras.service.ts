// src/modules/cameras/cameras.service.ts
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/api-error';
import { CameraRole } from '@prisma/client';
import { encryptPassword, decryptPassword } from '../../utils/crypto';
import type { CreateCameraInput, UpdateCameraInput } from './cameras.schemas';

const CAMERA_SELECT = {
  id: true,
  siteId: true,
  floorId: true,
  zoneId: true,
  name: true,
  ip: true,
  username: true,
  // passwordEncrypted is never returned by default
  model: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  floor: { select: { id: true, name: true } },
  zone: { select: { id: true, name: true, type: true } },
};

export async function listCameras(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw ApiError.notFound('Site not found');

  return prisma.cameraConfig.findMany({
    where: { siteId },
    select: CAMERA_SELECT,
    orderBy: { name: 'asc' },
  });
}

export async function getCameraById(id: string) {
  const camera = await prisma.cameraConfig.findUnique({
    where: { id },
    select: CAMERA_SELECT,
  });
  if (!camera) throw ApiError.notFound('Camera not found');
  return camera;
}

export async function createCamera(siteId: string, input: CreateCameraInput) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw ApiError.notFound('Site not found');

  // Verify floor belongs to site
  const floor = await prisma.floor.findUnique({ where: { id: input.floorId } });
  if (!floor || floor.siteId !== siteId) {
    throw ApiError.badRequest('Floor does not belong to this site');
  }

  // Verify zone if provided
  if (input.zoneId) {
    const zone = await prisma.zone.findUnique({ where: { id: input.zoneId } });
    if (!zone || zone.floorId !== input.floorId) {
      throw ApiError.badRequest('Zone does not belong to the specified floor');
    }
  }

  const passwordEncrypted = encryptPassword(input.password);

  return prisma.cameraConfig.create({
    data: {
      siteId,
      floorId: input.floorId,
      zoneId: input.zoneId,
      name: input.name,
      ip: input.ip,
      username: input.username,
      passwordEncrypted,
      model: input.model,
      role: (input.role as CameraRole) || 'OCCUPANCY',
    },
    select: CAMERA_SELECT,
  });
}

export async function updateCamera(id: string, input: UpdateCameraInput) {
  await getCameraById(id);

  const data: any = {};

  if (input.floorId !== undefined) data.floorId = input.floorId;
  if (input.zoneId !== undefined) data.zoneId = input.zoneId;
  if (input.name !== undefined) data.name = input.name;
  if (input.ip !== undefined) data.ip = input.ip;
  if (input.username !== undefined) data.username = input.username;
  if (input.model !== undefined) data.model = input.model;
  if (input.role !== undefined) data.role = input.role as CameraRole;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  // Re-encrypt if password is updated
  if (input.password !== undefined) {
    data.passwordEncrypted = encryptPassword(input.password);
  }

  return prisma.cameraConfig.update({
    where: { id },
    data,
    select: CAMERA_SELECT,
  });
}

export async function deleteCamera(id: string) {
  await getCameraById(id);
  await prisma.cameraConfig.delete({ where: { id } });
}

/**
 * Get camera with decrypted password — internal use only (PMS AI integration).
 */
export async function getCameraWithCredentials(id: string) {
  const camera = await prisma.cameraConfig.findUnique({ where: { id } });
  if (!camera) throw ApiError.notFound('Camera not found');

  return {
    ...camera,
    password: decryptPassword(camera.passwordEncrypted),
  };
}
