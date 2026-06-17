import type { Context, Next } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import { verifyToken } from '../utils/jwt'
import { AppError } from '../utils/errors'

export interface AuthUser {
  userId: number
  username: string
  name: string
  role: number
  visitMode: number // 0=登录, 1=公开/访客
}

interface AuthBindings {
  DB: D1Database
  JWT_SECRET?: string
}

// ========== 辅助函数 ==========

/** 获取 JWT_SECRET（从 Cloudflare Worker bindings） */
function getJwtSecret(c: Context): string | undefined {
  return (c.env as AuthBindings).JWT_SECRET
}

/** 从 Authorization header 解析 Bearer token 并验证 JWT，返回 payload 或 null */
async function parseBearerToken(c: Context): Promise<Record<string, unknown> | null> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return null
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  const jwtSecret = getJwtSecret(c)
  return verifyToken(token, jwtSecret)
}

/** 从 JWT payload 构建 AuthUser 对象 */
function makeAuthUser(payload: Record<string, unknown>, visitMode: number): AuthUser {
  return {
    userId: payload.userId as number,
    username: payload.username as string,
    name: (payload.name as string) || '',
    role: payload.role as number,
    visitMode,
  }
}

// ========== 登录鉴权中间件 ==========

/**
 * 登录鉴权中间件 - 从 Authorization header 解析 JWT token
 * 认证失败抛出 AppError，由全局错误处理器统一捕获
 */
export async function authMiddleware(c: Context, next: Next): Promise<void> {
  const payload = await parseBearerToken(c)

  if (!payload) {
    throw AppError.unauthorized('未登录')
  }

  c.set('authUser', makeAuthUser(payload, 0))

  await next()
}

// ========== 公开/访客模式中间件 ==========

/**
 * 公开模式中间件 - 优先使用登录 token，无 token 时使用公开访问账号
 */
export async function publicModeMiddleware(c: Context, next: Next): Promise<void> {
  const db = (c.env as { DB: D1Database }).DB

  const payload = await parseBearerToken(c)
  if (payload) {
    c.set('authUser', makeAuthUser(payload, 0))
    await next()
    return
  }

  // 查询公开模式设置
  const settingsResult = await db
    .prepare("SELECT config_name, config_value FROM system_settings WHERE config_name = 'panel_public_user_id' OR config_name = 'default_guest_mode'")
    .all<{ config_name: string; config_value: string }>()
  const rows = settingsResult.results
  const publicUserIdValue = rows.find(r => r.config_name === 'panel_public_user_id')?.config_value ?? null
  const guestModeValue = rows.find(r => r.config_name === 'default_guest_mode')?.config_value ?? null

  let targetUser: Record<string, unknown> | null = null

  if (publicUserIdValue) {
    const userId = parseInt(publicUserIdValue, 10)
    if (!isNaN(userId)) {
      targetUser = (await db
        .prepare('SELECT id, username, name, head_image, role, status FROM users WHERE id = ?')
        .bind(userId)
        .first()) as Record<string, unknown> | null
    }
  } else if (guestModeValue === '1') {
    targetUser = (await db
      .prepare('SELECT id, username, name, head_image, role, status FROM users WHERE role = 1 LIMIT 1')
      .first()) as Record<string, unknown> | null
  }

  if (targetUser) {
    c.set('authUser', {
      userId: targetUser.id as number,
      username: targetUser.username as string,
      name: (targetUser.name as string) || '',
      role: targetUser.role as number,
      visitMode: 1,
    } as AuthUser)
    await next()
    return
  }

  throw AppError.unauthorized('未登录且未启用公开模式')
}

// ========== 管理员鉴权中间件 ==========

/**
 * 管理员鉴权中间件 - 需要先通过 authMiddleware 或 publicModeMiddleware
 */
export async function adminMiddleware(c: Context, next: Next): Promise<void> {
  const user = c.get('authUser') as AuthUser | undefined

  if (!user || user.role !== 1) {
    throw AppError.forbidden('无权限')
  }

  await next()
}

// ========== 工具函数 ==========

/**
 * 获取当前认证用户信息 (从中间件设置的 context)
 */
export function getAuthUser(c: Context): AuthUser | null {
  return c.get('authUser') as AuthUser | null
}

// ========== 可选鉴权中间件 ==========

/**
 * 可选鉴权中间件 - 有 token 就解析并设置 authUser，没有也不报错
 * 用于 /init 等需要同时支持登录和未登录访问的端点
 */
export async function optionalAuthMiddleware(c: Context, next: Next): Promise<void> {
  const payload = await parseBearerToken(c)
  if (payload) {
    c.set('authUser', makeAuthUser(payload, 0))
  }
  await next()
}
