import type { Context, Next } from 'hono';
import { verifyToken } from '../utils/jwt';

export interface AuthUser {
  userId: number;
  username: string;
  role: number;
}

/**
 * 登录鉴权中间件 - 从 Authorization header 解析 JWT token
 */
export async function authMiddleware(c: Context, next: Next): Promise<void> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    c.status(401);
    return c.json({ code: 401, msg: '未登录', data: null });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const payload = await verifyToken(token);

  if (!payload) {
    c.status(401);
    return c.json({ code: 401, msg: 'token已失效，请重新登录', data: null });
  }

  // 将用户信息存入 context
  c.set('authUser', {
    userId: payload.userId as number,
    username: payload.username as string,
    role: payload.role as number,
  } as AuthUser);

  await next();
}

/**
 * 管理员鉴权中间件 - 需要先通过 authMiddleware
 */
export async function adminMiddleware(c: Context, next: Next): Promise<void> {
  const user = c.get('authUser') as AuthUser | undefined;

  if (!user || user.role !== 1) {
    c.status(403);
    return c.json({ code: 403, msg: '无权限', data: null });
  }

  await next();
}

/**
 * 获取当前登录用户信息 (从中间件设置的 context)
 */
export function getAuthUser(c: Context): AuthUser | null {
  return c.get('authUser') as AuthUser | null;
}