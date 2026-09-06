export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;
export const DISPLAY_NAME_RE = /^.{1,50}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const MESSAGE_MAX = 2000;
export const BODY_MAX = 10000;
export const TITLE_MAX = 200;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,100}$/;

export function isEmail(v: unknown): v is string {
  return typeof v === 'string' && EMAIL_RE.test(v.trim());
}

function isString(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length <= max;
}

export function validPassword(v: unknown): boolean {
  return typeof v === 'string' && v.length >= PASSWORD_MIN && v.length <= PASSWORD_MAX;
}

export interface FieldError {
  field: string;
  message: string;
}

export function validateRequiredFields(obj: Record<string, unknown>, fields: Array<[string, number]>): FieldError[] {
  const errors: FieldError[] = [];
  for (const [field, max] of fields) {
    const v = obj[field];
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
      errors.push({ field, message: `${field} is required` });
    } else if (!isString(v, max)) {
      errors.push({ field, message: `${field} must be a string of at most ${max} chars` });
    }
  }
  return errors;
}

function isHttpUrl(v: unknown): boolean {
  if (typeof v !== 'string' || !v) return true; // optional
  try {
    const url = new URL(v);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateUrl(v: unknown, field = 'url'): FieldError | null {
  if (v === undefined || v === null || v === '') return null;
  if (!isHttpUrl(v)) {
    return { field, message: `${field} must be a valid http(s) URL` };
  }
  return null;
}

export function safeMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MESSAGE_MAX) return null;
  return trimmed;
}

export function safeBody(value: unknown, field = 'body', max = BODY_MAX): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

export function safeStringEnum<T extends string>(value: unknown, allowed: readonly T[], fallback?: T): T | null {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback ?? null;
}
