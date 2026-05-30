import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import { publicModeMiddleware, getAuthUser } from '../middleware/auth'
import { UserService } from '../services/UserService'
import { PanelService } from '../services/PanelService'
import { SettingsService } from '../services/SettingsService'
import { ok } from '../utils/response'

const initApp = new Hono<{ Bindings: { DB: D1Database } }>()

initApp.use('*', publicModeMiddleware)

initApp.post('/api/init', async (c) => {
  const db = c.env.DB
  const user = getAuthUser(c)!

  const userSvc = new UserService(db)
  const panelSvc = new PanelService(db)
  const settingsSvc = new SettingsService(db)

  const [userInfo, siteConfig, panelData] = await Promise.all([
    userSvc.getUserInfo(user.userId),
    settingsSvc.getAll(),
    panelSvc.getAllData(user.userId),
  ])

  c.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
  return ok(c, {
    user: userInfo,
    visitMode: user.visitMode,
    siteConfig,
    groups: panelData.groups,
    itemsMap: panelData.itemsMap,
    panelConfig: panelData.panelConfig,
  })
})

export default initApp