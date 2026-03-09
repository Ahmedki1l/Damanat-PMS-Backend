// src/config/mongo.ts
import { MongoClient, Db } from 'mongodb';
import { env } from './env';
import { logger } from '../utils/logger';

let client: MongoClient;
let db: Db;

export async function connectMongo(): Promise<Db> {
  client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  db = client.db(env.MONGODB_DB_NAME || 'damanat_pms');

  // Create indexes on startup
  const col = db.collection('parking_times');
  await col.createIndex({ plate: 1, siteId: 1 }, { unique: true });
  await col.createIndex({ lastSeen: -1 });
  await col.createIndex({ siteId: 1 });

  logger.info(`✅ MongoDB connected → ${env.MONGODB_DB_NAME || 'damanat_pms'}`);
  return db;
}

export function getMongo(): Db {
  if (!db) throw new Error('MongoDB not connected — call connectMongo() first');
  return db;
}

export async function disconnectMongo(): Promise<void> {
  if (client) {
    await client.close();
    logger.info('🛑 MongoDB disconnected');
  }
}
