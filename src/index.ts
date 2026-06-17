import { Hono } from 'hono'
import type { D1Database, Fetcher } from '@cloudflare/workers-types'
import { corsMiddleware } from './middleware/cors'
import { csrfMiddleware } from './middleware/csrf'
import { securityHeadersMiddleware } from './middleware/securityHeaders'
import { bodyLimitMiddleware } from './middleware/bodyLimit'
import { validateEnv } from './utils/env'
import { AppError } from './utils/errors'
import { logger } from './utils/logger'
import authRoutes from './routes/auth'
import panelRoutes from './routes/panel'
import groupsRoutes from './routes/groups'
import usersRoutes, { usersAdminApp as usersAdminRoutes } from './routes/users'
import userConfigRoutes from './routes/userConfig'
import settingsRoutes from './routes/settings'
import initRoutes from './routes/init'
import proxyRoutes from './routes/proxy'

type Bindings = {
  DB: D1Database
  ASSETS: Fetcher
  JWT_SECRET?: string
}

const app = new Hono<{ Bindings: Bindings }>()

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
  return c.json({ code: 500, msg: '服务器内部错误', data: null }, 500)
})

// ========== 数据库自动初始化（惰性 + 单次执行） ==========
let dbInitPromise: Promise<void> | null = null
let dbInitialized = false

async function initDatabase(db: D1Database): Promise<void> {
  const tableCheck = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first()

  if (tableCheck) {
    dbInitialized = true
    return
  }

  logger.error('DB', 'Database tables not found. Please run: wrangler d1 execute sun-panel-db --file=./schema.sql')
  throw new Error('Database not initialized. Run `npm run db:init` to initialize.')
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

// CORS 中间件
app.use('*', corsMiddleware)

// CSRF 防护中间件
app.use('*', csrfMiddleware)

// 安全响应头中间件
app.use('*', securityHeadersMiddleware)

// 请求体大小限制中间件
app.use('*', bodyLimitMiddleware)

// 健康检查（禁止缓存）
app.get('/api/health', (c) => {
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
  c.header('CDN-Cache-Control', 'no-cache')
  return c.json({ code: 0, msg: 'ok', data: { status: 'running', time: new Date().toISOString() } })
})

// API 路由
app.route('/', authRoutes) // /login, /register
app.route('/', initRoutes) // /init
app.route('/panel', panelRoutes) // /panel/getAllData, /panel/itemIcon/*
app.route('/panel', groupsRoutes) // /panel/itemIconGroup/*
app.route('/panel', userConfigRoutes) // /panel/userConfig/*
app.route('/panel/users', usersAdminRoutes) // /panel/users/getList, /panel/users/create, ...
app.route('/', usersRoutes) // /user/*
app.route('/', settingsRoutes) // /system/*, /about

// 图片代理接口（GET / POST）
app.route('/', proxyRoutes)

// ========== SPA 前端回退（带缓存优化） ==========
// 未匹配的 GET 请求先尝试静态文件，未命中则返回 index.html
app.get('*', async (c) => {
  // 静态资源（JS/CSS/图片/字体）使用长期缓存
  const url = new URL(c.req.url)
  const isStaticAsset = /\.(?:js|mjs|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|webp|avif|json|map)$/i.test(url.pathname)

  try {
    const assetRes = await c.env.ASSETS.fetch(c.req.raw)
    if (assetRes.status !== 404) {
      // 为静态资源添加长期缓存头
      if (isStaticAsset) {
        const newHeaders = new Headers(assetRes.headers)
        newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable')
        newHeaders.set('CDN-Cache-Control', 'public, max-age=31536000')
        return new Response(assetRes.body, {
          status: assetRes.status,
          statusText: assetRes.statusText,
          headers: newHeaders,
        })
      }
      return assetRes
    }
  } catch {
    // 忽略，继续尝试 index.html
  }

  // SPA 兜底：返回 index.html
  try {
    url.pathname = '/index.html'
    const indexRes = await c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw))
    if (indexRes.ok) {
      // index.html 不缓存（保证更新后即时生效）
      const newHeaders = new Headers(indexRes.headers)
      newHeaders.set('Cache-Control', 'no-cache, must-revalidate')
      return new Response(indexRes.body, {
        status: indexRes.status,
        statusText: indexRes.statusText,
        headers: newHeaders,
      })
    }
  } catch (e) {
    logger.error('SPA', 'Failed to serve index.html fallback', e)
  }
  return c.json({ code: 404, msg: 'Not Found' }, 404)
})

export default app