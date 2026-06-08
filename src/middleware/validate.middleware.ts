/**
 * Generic-middleware для валідації тіла, query або params через Zod-схему.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../domain/errors';

type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.flatten().fieldErrors;
      return next(new ValidationError('Невірні дані запиту', details));
    }
    // Записуємо очищені дані назад у req для контролерів
    (req as unknown as Record<string, unknown>)[source] = result.data;
    next();
  };
}
