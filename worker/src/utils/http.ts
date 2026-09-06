export function json<T>(body: T | { error: string }, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function ok<T>(data: T, status = 200): Response {
  return json({ data }, status);
}

export function created<T>(data: T): Response {
  return ok(data, 201);
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function badRequest(message: string): Response {
  return error(message, 400);
}

export function unauthorized(message = 'Unauthorized'): Response {
  return error(message, 401);
}

export function forbidden(message = 'Forbidden'): Response {
  return error(message, 403);
}

export function notFound(message = 'Not found'): Response {
  return error(message, 404);
}

export function conflict(message: string): Response {
  return error(message, 409);
}

export function rateLimited(message = 'Too many requests'): Response {
  return error(message, 429);
}

export function serverError(message = 'Internal server error'): Response {
  return error(message, 500);
}
