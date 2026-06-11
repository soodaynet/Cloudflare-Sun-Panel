import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import { publicModeMiddleware, getAuthUser } from '../middleware/auth'
import { PanelService } from '../services/PanelService'
import { SettingsService } from '../services/SettingsService'
import { ok } from '../utils/response'

const initApp = new Hono<{ Bindings: { DB: D1Database } }>()

initApp.use('*', publicModeMiddleware)

initApp.post('/init', async (c) => {
  const user = getAuthUser(c)
  const db = c.env.DB
  const panelService = new PanelService(db)
  const settingsService = new SettingsService(db)

  const [panelData, aboutData, authInfo] = await Promise.all([
    panelService.getAllData(user?.userId || 0),
    settingsService.getAll(),
    (async () => {
      if (user) {
        return {
          user: {
            id: user.userId,
            username: user.username,
            name: user.name || '',
            role: user.role,
          },
          visitMode: user.visitMode,
        }
      }
      return { user: null, visitMode: 1 }
    })(),
  ])

  c.header('Cache-Control', 'private, max-age=60, stale-while-revalidate=300')
  return ok(c, {
    ...panelData,
    about: aboutData,
    authInfo,
  })
})

export default initApp