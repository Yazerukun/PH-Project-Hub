import { Env } from '../types';
import { rateLimited } from '../utils/http';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

export function rateLimitMiddleware(key: string, max: number, windowMs: number) {
  return (_request: Request, env: Env) => {
    const maxStr = env.RATE_LIMIT_MAX;
    const effectiveMax = maxStr ? Number(maxStr) : max;
    if (!checkRateLimit(key, effectiveMax, windowMs)) {
      return rateLimited('Too many requests. Please slow down.');
    }
    return null;
  };
}
