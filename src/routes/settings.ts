import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import { validate, settingGetSchema, settingSetSchema, saveAllSchema } from '../utils/validate'
import { SettingsService } from '../services/SettingsService'
import { ok } from '../utils/response'

type Variables = {
  validatedBody: unknown
}

const settingsApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>()

/**
 * 获取系统设置 (通过 configName) - 公开可访问
 * POST /api/system/setting/get
 */
settingsApp.post('/system/setting/get', validate(settingGetSchema), async (c) => {
  const { configName } = c.var.validatedBody as { configName: string }
  const service = new SettingsService(c.env.DB)
  const value = await service.get(configName)
  return ok(c, value)
})

/**
 * 保存系统设置 (管理员)
 * POST /api/system/setting/set
 */
settingsApp.post('/system/setting/set', authMiddleware, adminMiddleware, validate(settingSetSchema), async (c) => {
  const { configName, configValue } = c.var.validatedBody as { configName: string; configValue?: string }
  const service = new SettingsService(c.env.DB)
  await service.set(configName, configValue ?? '')
  return ok(c, null)
})

/**
 * 批量保存系统设置 (管理员)
 * POST /api/system/settings/saveAll
 */
settingsApp.post('/system/settings/saveAll', authMiddleware, adminMiddleware, validate(saveAllSchema), async (c) => {
  const body = c.var.validatedBody as Record<string, string>

  const service = new SettingsService(c.env.DB)
  await service.saveAll(body)
  return ok(c, null)
})

/**
 * 获取所有设置 (公开)
 * POST /api/about
 */
settingsApp.post('/about', async (c) => {
  const service = new SettingsService(c.env.DB)
  const settings = await service.getAll()
  c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  return ok(c, settings)
})

export default settingsApp