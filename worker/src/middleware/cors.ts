const ALLOWED_ORIGINS = new Set<string>([
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
]);

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (origin.endsWith('.pages.dev')) return true;
  if (origin.endsWith('.workers.dev')) return true;
  return false;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && isAllowedOrigin(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    };
  }
  return {};
}
