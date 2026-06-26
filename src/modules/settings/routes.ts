import { Hono, type Context } from 'hono'
import { adminMiddleware, authMiddleware } from '../shared/middleware/auth'
import { validate } from '../shared/validate'
import { ok } from '../shared/response'
import type { AppContext } from '../types'
import { SettingsService } from './service'
import { settingGetSchema, settingSetSchema, saveAllSchema } from './validator'

export const router = new Hono<AppContext>()

/**
 * 获取单个系统设置（公开可访问，用于登录页获取站点信息）
 * POST /system/setting/get
 */
router.post('/system/setting/get', validate(settingGetSchema), async (c) => {
  const { configName } = c.var.validatedBody as { configName: string }
  const service = new SettingsService(c.env.DB)
  const value = await service.get(configName)
  return ok(c, value)
})

/**
 * 保存单个系统设置（管理员）
 * POST /system/setting/set
 */
router.post(
  '/system/setting/set',
  authMiddleware,
  adminMiddleware,
  validate(settingSetSchema),
  async (c) => {
    const { configName, configValue } = c.var.validatedBody as { configName: string; configValue?: string }
    const service = new SettingsService(c.env.DB)
    await service.set(configName, configValue ?? '')
    return ok(c, null)
  },
)

/**
 * 批量保存系统设置（管理员）
 * POST /system/settings/saveAll
 */
router.post(
  '/system/settings/saveAll',
  authMiddleware,
  adminMiddleware,
  validate(saveAllSchema),
  async (c) => {
    const body = c.var.validatedBody as Record<string, string>
    const service = new SettingsService(c.env.DB)
    await service.saveAll(body)
    return ok(c, null)
  },
)

/**
 * 获取所有设置（公开）
 * GET/POST /about
 * GET 请求免 CSRF 校验，更适合登录页获取只读站点信息；
 * CDN 不缓存（no-cache），避免错误/过期响应导致站点信息无法显示。
 */
async function handleAbout(c: Context<AppContext>) {
  const service = new SettingsService(c.env.DB)
  const settings = await service.getAll()
  c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  c.header('CDN-Cache-Control', 'no-cache')
  return ok(c, settings)
}

router.get('/about', handleAbout)
router.post('/about', handleAbout)
