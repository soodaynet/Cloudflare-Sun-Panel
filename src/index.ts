import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { AppContext } from './modules/types'
import { ModuleRegistry } from './modules/registry'
import { corsMiddleware } from './modules/shared/middleware/cors'
import { csrfMiddleware } from './modules/shared/middleware/csrf'
import { securityHeadersMiddleware } from './modules/shared/middleware/securityHeaders'
import { bodyLimitMiddleware } from './modules/shared/middleware/bodyLimit'
import { validateEnv } from './modules/shared/env'
import { AppError } from './modules/shared/errors'
import { logger } from './modules/shared/logger'
import { isValidUrl } from './modules/shared/favicon'
import { authModule } from './modules/auth'
import { initModule } from './modules/init'
import { panelModule } from './modules/panel'
import { userConfigModule } from './modules/user-config'
import { usersAdminModule, userSelfModule } from './modules/users'
import { settingsModule } from './modules/settings'

const app = new Hono<AppContext>()

// ========== 全局错误处理 ==========
app.onError((err, c) => {
  if (err instanceof AppError) {
    logger.error('App', `${err.name} ${err.code}`, err)
    return c.json(
      { code: err.code, msg: err.message, data: null },
      err.httpStatus as 400 | 401 | 403 | 404 | 409 | 500,
    )
  }
  logger.error('App', 'Unhandled error', err)
  const msg = err instanceof Error ? err.message : '服务器内部错误'
  return c.json({ code: 500, msg, data: null }, 500)
})

// ========== 健康检查（不依赖 DB / 环境变量，始终可用）==========
app.get('/api/health', (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
  c.header('CDN-Cache-Control', 'no-cache')
  return c.json({ code: 0, msg: 'ok', data: { status: 'running', time: new Date().toISOString() } })
})

// ========== Favicon 代理（公开，无需认证）==========
app.get('/api/favicon-proxy', async (c) => {
  const domain = c.req.query('domain')
  const sz = c.req.query('sz') || '64'
  if (!domain) {
    return c.json({ code: 400, msg: '缺少 domain 参数', data: null }, 400)
  }
  // SSRF 安全校验
  try {
    const testUrl = `https://${domain}`
    if (!isValidUrl(testUrl)) {
      return c.json({ code: 400, msg: 'domain 不合法', data: null }, 400)
    }
  } catch {
    return c.json({ code: 400, msg: 'domain 不合法', data: null }, 400)
  }
  try {
    const upstream = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${sz}`
    const resp = await fetch(upstream)
    if (!resp.ok) {
      return c.json({ code: 502, msg: '上游服务不可用', data: null }, 502)
    }
    const contentType = resp.headers.get('content-type') || 'image/x-icon'
    const body = await resp.arrayBuffer()
    c.header('Content-Type', contentType)
    c.header('Cache-Control', 'public, max-age=2592000, immutable')
    c.header('CDN-Cache-Control', 'public, max-age=2592000, immutable')
    return c.body(body)
  } catch {
    return c.json({ code: 502, msg: '上游服务不可用', data: null }, 502)
  }
})

// ========== 数据库自动初始化 ==========
let dbInitPromise: Promise<void> | null = null
let dbInitialized = false

async function initDatabase(db: D1Database): Promise<void> {
  const tableCheck = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first()
  if (tableCheck) {
    dbInitialized = true
    return
  }
  logger.error('DB', 'Database tables not found. Run: wrangler d1 execute sun-panel-db --file=./schema.sql')
  throw new Error('Database not initialized.')
}

app.use('*', async (c, next) => {
  if (!dbInitialized) {
    validateEnv(c.env)
    if (!dbInitPromise) {
      dbInitPromise = initDatabase(c.env.DB).catch((err) => {
        logger.error('DB', 'Init failed', err)
        dbInitPromise = null
        throw err
      })
    }
    await dbInitPromise
  }
  await next()
})

// ========== 全局中间件 ==========
app.use('*', corsMiddleware)
app.use('*', csrfMiddleware)
app.use('*', securityHeadersMiddleware)
app.use('*', bodyLimitMiddleware)

// ========== 模块注册表 ==========
const registry = new ModuleRegistry()

registry.register(authModule)
registry.register(initModule)
registry.register(panelModule)
registry.register(userConfigModule)
registry.register(usersAdminModule)
registry.register(userSelfModule)
registry.register(settingsModule)

registry.install(app)

// ========== SPA 前端回退 ==========
app.get('*', async (c) => {
  const url = new URL(c.req.url)
  const isStaticAsset = /\.(?:js|mjs|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|webp|avif|json|map)$/i.test(url.pathname)
  try {
    const assetRes = await c.env.ASSETS.fetch(c.req.raw)
    if (assetRes.status !== 404) {
      if (isStaticAsset) {
        const newHeaders = new Headers(assetRes.headers)
        newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable')
        newHeaders.set('CDN-Cache-Control', 'public, max-age=31536000')
        return new Response(assetRes.body, { status: assetRes.status, statusText: assetRes.statusText, headers: newHeaders })
      }
      return assetRes
    }
  } catch { /* ignore */ }
  try {
    url.pathname = '/index.html'
    const indexRes = await c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw))
    if (indexRes.ok) {
      const newHeaders = new Headers(indexRes.headers)
      newHeaders.set('Cache-Control', 'no-cache, must-revalidate')
      return new Response(indexRes.body, { status: indexRes.status, statusText: indexRes.statusText, headers: newHeaders })
    }
  } catch (e) {
    logger.error('SPA', 'Failed to serve index.html fallback', e)
  }
  return c.json({ code: 404, msg: 'Not Found' }, 404)
})

export default app
