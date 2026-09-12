/** Boundary validation helpers shared by every owner.
 * Validation failures become bounded PublicError values: no provider bodies, no credentials.
 */
import type { z } from 'zod';
import type { PublicError } from './types.js';
import { LIMITS } from './schemas.js';

export class AccordError extends Error {
  readonly public: PublicError;
  constructor(publicError: PublicError, options?: { cause?: unknown }) {
    super(publicError.message, options);
    this.name = 'AccordError';
    this.public = publicError;
  }
}

const RETRYABLE: ReadonlySet<PublicError['code']> = new Set(['TIMEOUT', 'RATE_LIMIT', 'PROVIDER_ERROR', 'DELIVERY_UNCERTAIN']);

export function publicError(code: PublicError['code'], message: string): PublicError {
  return { code, message: message.slice(0, LIMITS.errorMessage), retryable: RETRYABLE.has(code) };
}

export function isAccordError(value: unknown): value is AccordError {
  return value instanceof AccordError;
}

/** Compact, safe description of a validation failure. Never includes the rejected values. */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.code}`)
    .join('; ')
    .slice(0, LIMITS.errorMessage);
}

/** Parses an external or cross-package value, throwing AccordError with INVALID_INPUT on failure. */
export function validate<T>(schema: z.ZodType<T>, value: unknown, context: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new AccordError(publicError('INVALID_INPUT', `${context} failed validation: ${describeIssues(result.error)}`));
}

export type ValidationOutcome<T> = { ok: true; value: T } | { ok: false; error: PublicError };

/** Non-throwing variant for model output, where one bounded repair attempt is permitted. */
export function tryValidate<T>(schema: z.ZodType<T>, value: unknown, context: string): ValidationOutcome<T> {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: publicError('INVALID_INPUT', `${context} failed validation: ${describeIssues(result.error)}`) };
}
