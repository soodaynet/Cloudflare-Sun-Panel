import { Hono } from 'hono'
import type { AppContext } from '../types'
import { publicModeMiddleware, getAuthUser } from '../shared/middleware/auth'
import { ok } from '../shared/response'
import { PanelService } from './service'
import { itemIconRouter } from './item-icon/routes'
import { groupRouter } from './group/routes'

export const router = new Hono<AppContext>()

router.use('*', publicModeMiddleware)

/**
 * 统一获取全部数据（分组 + 所有图标 + 用户配置）
 * POST /panel/getAllData
 */
router.post('/getAllData', async (c) => {
  const user = getAuthUser(c)!
  const service = new PanelService(c.env.DB)
  const result = await service.getAllData(user.userId)

  c.header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
  return ok(c, result)
})

// 挂载子路由
router.route('/itemIcon', itemIconRouter)
router.route('/itemIconGroup', groupRouter)
