import { Hono } from 'hono'
import type { AppContext } from '../../types'
import { getAuthUser } from '../../shared/middleware/auth'
import { validate } from '../../shared/validate'
import { ok, fail } from '../../shared/response'
import { PanelService } from '../service'
import {
  iconEditSchema,
  iconAddMultipleSchema,
  idsSchema,
  sortSchema,
  getListByGroupIdSchema,
  faviconSchema,
} from '../validator'
import type { IconEditBody, IconAddMultipleBody, SortItem } from '../types'

export const itemIconRouter = new Hono<AppContext>()

/**
 * 根据分组 ID 获取图标列表
 * POST /panel/itemIcon/getListByGroupId
 */
itemIconRouter.post('/getListByGroupId', validate(getListByGroupIdSchema), async (c) => {
  const user = getAuthUser(c)!
  const { itemIconGroupId } = c.var.validatedBody as { itemIconGroupId?: number }

  const service = new PanelService(c.env.DB)
  const list = await service.getIconsByGroupId(itemIconGroupId || 0, user.userId)

  c.header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
  return ok(c, list)
})

/**
 * 获取站点图标 (favicon)
 * POST /panel/itemIcon/getSiteFavicon
 */
itemIconRouter.post('/getSiteFavicon', validate(faviconSchema), async (c) => {
  const { url } = c.var.validatedBody as { url: string }

  const service = new PanelService(c.env.DB)
  const result = await service.getSiteFavicon(url)
  // 按 URL 公开可缓存（无敏感数据），与 upstream cf.cacheTtl:3600 对齐
  c.header('Cache-Control', 'public, max-age=3600')
  c.header('CDN-Cache-Control', 'public, max-age=3600')
  return ok(c, result)
})

/**
 * 批量添加图标
 * POST /panel/itemIcon/addMultiple
 */
itemIconRouter.post('/addMultiple', validate(iconAddMultipleSchema), async (c) => {
  const user = getAuthUser(c)!
  if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
  const items = c.var.validatedBody as IconAddMultipleBody

  const service = new PanelService(c.env.DB)
  await service.addMultipleIcons(items, user.userId)
  return ok(c, null)
})

/**
 * 编辑图标
 * POST /panel/itemIcon/edit
 */
itemIconRouter.post('/edit', validate(iconEditSchema), async (c) => {
  const user = getAuthUser(c)!
  if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
  const body = c.var.validatedBody as IconEditBody

  const service = new PanelService(c.env.DB)
  const result = await service.editIcon(body, user.userId)
  return ok(c, result)
})

/**
 * 批量删除图标
 * POST /panel/itemIcon/deletes
 */
itemIconRouter.post('/deletes', validate(idsSchema), async (c) => {
  const user = getAuthUser(c)!
  if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
  const { ids } = c.var.validatedBody as { ids: number[] }

  const service = new PanelService(c.env.DB)
  await service.deleteIcons(ids, user.userId)
  return ok(c, null)
})

/**
 * 保存图标排序
 * POST /panel/itemIcon/saveSort
 */
itemIconRouter.post('/saveSort', validate(sortSchema), async (c) => {
  const user = getAuthUser(c)!
  if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
  const { sortItems } = c.var.validatedBody as { sortItems: SortItem[] }

  if (sortItems.length === 0) {
    return ok(c, null)
  }

  const service = new PanelService(c.env.DB)
  await service.saveIconSort(sortItems, user.userId)
  return ok(c, null)
})
