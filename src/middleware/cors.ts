import { type Context, type Next } from 'hono'

const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type, Authorization'

function applyCorsHeaders(c: Context) {
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Access-Control-Allow-Methods', ALLOWED_METHODS)
  c.header('Access-Control-Allow-Headers', ALLOWED_HEADERS)
  c.header('Access-Control-Max-Age', '86400')
}

/**
 * CORS 中间件 - 处理 preflight OPTIONS 请求并为所有响应添加 CORS 头
 */
export async function corsMiddleware(c: Context, next: Next) {
  if (c.req.method === 'OPTIONS') {
    applyCorsHeaders(c)
    return c.body(null, 204)
  }

  await next()

  c.header('Access-Control-Allow-Origin', '*')
}