// src/config/env.ts
import dotenv from 'dotenv';
import { z } from 'zod/v4';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CAMERA_ENCRYPTION_KEY: z.string().length(64),
  PMS_AI_DEFAULT_URL: z.string().url().optional(),
  MONGODB_URI: z.string().default('mongodb://localhost:27017'),
  MONGODB_DB_NAME: z.string().default('damanat_pms'),
  SERVICE_API_KEY: z.string().min(16).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
