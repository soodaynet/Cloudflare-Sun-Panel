import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { z } from 'zod'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import { SettingsService } from '../services/SettingsService'
import { ok, fail } from '../utils/response'
import { validate, settingGetSchema, settingSetSchema } from '../utils/validate'

type Variables = { validatedBody: unknown }

const settingsApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>()

settingsApp.post('/system/setting/get', validate(settingGetSchema), async (c) => {
  const svc = new SettingsService(c.env.DB)
  const { configName } = c.get('validatedBody') as z.infer<typeof settingGetSchema>

  const value = await svc.get(configName)
  return ok(c, value)
})

settingsApp.post('/system/setting/set', authMiddleware, adminMiddleware, validate(settingSetSchema), async (c) => {
  const svc = new SettingsService(c.env.DB)
  const { configName, configValue } = c.get('validatedBody') as z.infer<typeof settingSetSchema>

  await svc.set(configName, configValue ?? '')
  return ok(c, null)
})

settingsApp.post('/system/settings/saveAll', authMiddleware, adminMiddleware, async (c) => {
  const svc = new SettingsService(c.env.DB)
  const body = await c.req.json<Record<string, string>>()

  if (!body || Object.keys(body).length === 0) {
    return fail(c, '数据不能为空')
  }

  await svc.saveAll(body)
  return ok(c, null)
})

settingsApp.post('/about', async (c) => {
  const svc = new SettingsService(c.env.DB)
  const settings = await svc.getAll()

  c.header('Cache-Control', 'public, max-age=300, s-maxage=300')
  return ok(c, settings)
})

export default settingsApp