import { type Context, type Next } from 'hono'

const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type, Authorization'

function getAllowedOrigin(requestOrigin: string | null): string {
  if (!requestOrigin) return ''

  const extraOrigins = (typeof process !== 'undefined' && process.env?.ALLOWED_ORIGINS) || ''
  const allowedList = ['workers.dev', ...extraOrigins.split(',').filter(Boolean)]

  const isAllowed = allowedList.some(domain =>
    requestOrigin.endsWith(domain) || requestOrigin.includes(`.${domain}`)
  )

  return isAllowed ? requestOrigin : ''
}

export async function corsMiddleware(c: Context, next: Next) {
  if (c.req.method === 'OPTIONS') {
    const origin = getAllowedOrigin(c.req.header('Origin') || '')
    c.header('Access-Control-Allow-Origin', origin || 'null')
    c.header('Access-Control-Allow-Methods', ALLOWED_METHODS)
    c.header('Access-Control-Allow-Headers', ALLOWED_HEADERS)
    c.header('Access-Control-Max-Age', '86400')
    return c.body(null, 204)
  }

  await next()

  const origin = getAllowedOrigin(c.req.header('Origin') || '')
  if (origin) {
    c.header('Access-Control-Allow-Origin', origin)
  }
}