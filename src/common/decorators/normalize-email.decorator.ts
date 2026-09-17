import { Transform, TransformFnParams } from 'class-transformer';

/**
 * Normalizes at the HTTP boundary rather than in a service, so every lookup downstream can
 * keep matching exactly against the `User_email_key` unique index instead of falling back to
 * a case-insensitive query that cannot use it.
 *
 * Non-strings pass through so `@IsEmail` produces the validation error, rather than the
 * transformer crashing on a type it was never given.
 */
export const NormalizeEmail = (): PropertyDecorator =>
  Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
