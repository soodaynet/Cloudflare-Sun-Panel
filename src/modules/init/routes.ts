import { Hono } from 'hono'
import type { AppContext } from '../types'
import { publicModeMiddleware, getAuthUser } from '../shared/middleware/auth'
import { ok } from '../shared/response'
import { PanelService } from '../panel/service'
import { SettingsService } from '../settings/service'
import { UserConfigService } from '../user-config/service'
import { InitService } from './service'

export const router = new Hono<AppContext>()

// publicModeMiddleware 仅作用于 /init 路由，避免 use('*') 经 app.route('/', ...) 合并后泄漏为全局中间件
router.post('/init', publicModeMiddleware, async (c) => {
  const user = getAuthUser(c)
  const service = new InitService(
    new PanelService(c.env.DB),
    new SettingsService(c.env.DB),
    new UserConfigService(c.env.DB),
  )
  const data = await service.aggregate(user)

  c.header('Cache-Control', 'private, max-age=60, stale-while-revalidate=300')
  return ok(c, data)
})
