import { type Context, type Next } from 'hono'
import { isAllowedOrigin } from '../origin'

const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type, Authorization'

function applyCorsHeaders(c: Context, allowedOrigin: string | undefined) {
  if (allowedOrigin) {
    c.header('Access-Control-Allow-Origin', allowedOrigin)
  }
  c.header('Access-Control-Allow-Methods', ALLOWED_METHODS)
  c.header('Access-Control-Allow-Headers', ALLOWED_HEADERS)
  c.header('Access-Control-Max-Age', '86400')
}

/**
 * CORS 中间件 - 处理 preflight OPTIONS 请求并为所有响应添加 CORS 头
 * 使用白名单方式，只允许 localhost 和同源请求
 */
export async function corsMiddleware(c: Context, next: Next) {
  const origin = c.req.header('Origin')
  const host = new URL(c.req.url).hostname
  const allowedOrigin = origin && isAllowedOrigin(origin, host) ? origin : undefined

  if (c.req.method === 'OPTIONS') {
    applyCorsHeaders(c, allowedOrigin)
    return c.body(null, 204)
  }

  await next()

  if (allowedOrigin) {
    c.header('Access-Control-Allow-Origin', allowedOrigin)
  }
}
