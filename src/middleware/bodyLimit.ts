import type { Context, Next } from 'hono'

const MAX_BODY_SIZE = 1 * 1024 * 1024

export async function bodyLimitMiddleware(c: Context, next: Next) {
  const contentLength = parseInt(c.req.header('Content-Length') || '0', 10)
  if (contentLength > MAX_BODY_SIZE) {
    c.status(413)
    return c.json({ code: 413, msg: '请求体过大', data: null })
  }
  await next()
}