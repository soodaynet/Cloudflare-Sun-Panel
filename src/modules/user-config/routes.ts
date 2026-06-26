import { Hono } from 'hono'
import type { AppContext } from '../types'
import { publicModeMiddleware, getAuthUser } from '../shared/middleware/auth'
import { validate } from '../shared/validate'
import { ok, fail } from '../shared/response'
import { UserConfigService } from './service'
import { userConfigSchema } from './validator'
import type { UserConfigSetBody } from './types'

export const router = new Hono<AppContext>()

/**
 * 获取用户配置（公开模式）
 * POST /get
 */
router.post('/get', publicModeMiddleware, async (c) => {
  const user = getAuthUser(c)!
  const service = new UserConfigService(c.env.DB)
  const data = await service.get(user.userId)
  return ok(c, data)
})

/**
 * 保存用户配置（公开模式，访客只读）
 * POST /set
 */
router.post(
  '/set',
  publicModeMiddleware,
  validate(userConfigSchema),
  async (c) => {
    const user = getAuthUser(c)!

    if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)

    const { panel, searchEngine } = c.var.validatedBody as UserConfigSetBody
    const panelJson = JSON.stringify(panel || {})
    const searchEngineJson = JSON.stringify(searchEngine || {})

    const service = new UserConfigService(c.env.DB)
    await service.set(user.userId, panelJson, searchEngineJson)
    return ok(c, null)
  },
)
