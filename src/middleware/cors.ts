import type { Context, Next } from 'hono';

/**
 * CORS 中间件
 */
export async function corsMiddleware(c: Context, next: Next): Promise<void> {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (c.req.method === 'OPTIONS') {
    c.status(204);
    return;
  }

  await next();
}