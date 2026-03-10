// api/index.ts — Vercel serverless entry point
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { connectMongo } from '../src/config/mongo';
import { logger } from '../src/utils/logger';

// Cache connection state across warm invocations
let postgresReady = false;
let mongoReady = false;

async function ensureConnections() {
  if (!postgresReady) {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    postgresReady = true;
    logger.info('PostgreSQL connected');
  }

  if (!mongoReady) {
    await connectMongo();
    mongoReady = true;
  }
}

// Vercel calls this as the request handler
export default async function handler(req: any, res: any) {
  await ensureConnections();
  app(req, res);
}
