// src/utils/logger.ts
import pino from 'pino';

// Use pino-pretty only when running in a local TTY (dev terminal).
// Serverless environments (Vercel) have no TTY — plain JSON logging is used.
const usePretty = Boolean(process.stdout.isTTY) && process.env.NODE_ENV !== 'production';

export const logger = pino(
  usePretty
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {},
);
