import type { Context, MiddlewareHandler } from 'hono'
import type { AppContext } from '../../types'
import type { AuthUser } from '../types'
import { verifyToken } from '../jwt'
import { AppError } from '../errors'

// ========== 辅助函数 ==========

/** 从 Authorization header 解析 Bearer token 并验证 JWT，返回 payload 或 null */
async function parseBearerToken(c: Context<AppContext>): Promise<Record<string, unknown> | null> {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return null
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  return verifyToken(token, c.env.JWT_SECRET)
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
export const authMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
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
export const publicModeMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  const db = c.env.DB

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
    })
    await next()
    return
  }

  throw AppError.unauthorized('未登录且未启用公开模式')
}

// ========== 管理员鉴权中间件 ==========

/**
 * 管理员鉴权中间件 - 需要先通过 authMiddleware 或 publicModeMiddleware
 */
export const adminMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  const user = c.var.authUser

  if (!user || user.role !== 1) {
    throw AppError.forbidden('无权限')
  }

  await next()
}

// ========== 工具函数 ==========

/** 获取当前认证用户信息 (从中间件设置的 context) */
export function getAuthUser(c: Context<AppContext>): AuthUser | null {
  return c.var.authUser ?? null
}
