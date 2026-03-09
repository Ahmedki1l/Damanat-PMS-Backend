// src/middleware/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';
import { ApiError } from '../utils/api-error';

/**
 * Factory middleware: validates req.body against a Zod schema.
 * Replaces req.body with the parsed (and sanitized) data on success.
 */
export function validate(schema: z.ZodType<any>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const messages = z.prettifyError(result.error);
      throw ApiError.badRequest(`Validation error: ${messages}`);
    }

    req.body = result.data;
    next();
  };
}
