import type { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { D1Database, Fetcher } from '@cloudflare/workers-types'
import type { AuthUser } from './shared/types'

// 应用环境变量绑定
export interface AppBindings {
  DB: D1Database
  ASSETS: Fetcher
  JWT_SECRET: string
}

// 应用上下文（Hono 上下文泛型）
export interface AppContext {
  Bindings: AppBindings
  Variables: {
    // 认证用户（由 auth 中间件注入）
    authUser?: AuthUser
    // 校验后的请求体（由 validate 中间件注入）
    validatedBody?: unknown
  }
}

// 模块定义接口
export interface ModuleDefinition {
  /** 模块名称（唯一标识） */
  name: string
  /** 挂载路径（如 '/panel', '/system'） */
  mountPath: string
  /** Hono 路由实例 */
  router: Hono<AppContext>
  /** 模块级中间件（仅作用于 mountPath 下） */
  middlewares?: MiddlewareHandler<AppContext>[]
}
