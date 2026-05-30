import type { Context, Next } from 'hono'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
  lastCleanup = now
}

export function rateLimit(maxRequests: number, windowMs: number, keyFn?: (c: Context) => string) {
  return async (c: Context, next: Next) => {
    cleanup()
    const key = keyFn
      ? keyFn(c)
      : (c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown')
    const now = Date.now()

    const entry = store.get(key)
    if (entry && entry.resetAt > now) {
      if (entry.count >= maxRequests) {
        c.status(429)
        return c.json({ code: 429, msg: '请求过于频繁，请稍后再试', data: null })
      }
      entry.count++
    } else {
      store.set(key, { count: 1, resetAt: now + windowMs })
    }

    await next()
  }
}