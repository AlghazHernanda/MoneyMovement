import type { z } from 'zod';
import { AppError } from '../lib/errors.js';

export class ValidationError extends AppError {
  constructor(public readonly details: { field: string; message: string }[]) {
    super(400, 'VALIDATION_ERROR', 'Input tidak valid');
  }
}

/** Validasi input di trust boundary. Melempar 400 dengan detail per field. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((i) => ({ field: i.path.join('.') || '(root)', message: i.message })),
    );
  }
  return result.data;
}
