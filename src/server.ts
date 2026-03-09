// src/server.ts
import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { prisma } from './config/prisma';

async function main() {
  // Test database connection
  try {
    await prisma.$connect();
    logger.info('✅ Database connected');
  } catch (err) {
    logger.error(err, '❌ Database connection failed');
    process.exit(1);
  }

  app.listen(env.PORT, () => {
    logger.info(`🚀 Damanat Core Backend running on http://localhost:${env.PORT}`);
    logger.info(`📖 Health check: http://localhost:${env.PORT}/api/v1/health`);
    logger.info(`🔧 Environment: ${env.NODE_ENV}`);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

main().catch((err) => {
  logger.error(err, 'Fatal startup error');
  process.exit(1);
});
