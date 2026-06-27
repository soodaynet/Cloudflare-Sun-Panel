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
    const service = new UserConfigService(c.env.DB)

    // 局部更新：仅更新实际传入的字段，未传字段保持原值
    // 避免前端部分提交（仅传 panel 或仅传 searchEngine）时互相清空
    const hasPanel = panel !== undefined
    const hasSearchEngine = searchEngine !== undefined

    if (hasPanel && hasSearchEngine) {
      // 两者都传：用全量 set（向后兼容，一次 UPDATE）
      await service.set(user.userId, JSON.stringify(panel), JSON.stringify(searchEngine))
    } else if (hasPanel) {
      await service.updatePanel(user.userId, JSON.stringify(panel))
    } else if (hasSearchEngine) {
      await service.updateSearchEngine(user.userId, JSON.stringify(searchEngine))
    }
    // 两者均未传：直接返回 ok（无操作）

    return ok(c, null)
  },
)
