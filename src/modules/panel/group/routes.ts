import { Hono } from 'hono'
import type { AppContext } from '../../types'
import { getAuthUser } from '../../shared/middleware/auth'
import { validate } from '../../shared/validate'
import { ok, fail } from '../../shared/response'
import { PanelService } from '../service'
import { iconGroupSchema, idsSchema, sortSchema } from '../validator'
import type { GroupEditBody, SortItem } from '../types'

export const groupRouter = new Hono<AppContext>()

/**
 * 获取分组列表
 * POST /panel/itemIconGroup/getList
 */
groupRouter.post('/getList', async (c) => {
  const user = getAuthUser(c)!

  const service = new PanelService(c.env.DB)
  const list = await service.getGroupList(user.userId)
  c.header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
  return ok(c, list)
})

/**
 * 编辑或创建分组
 * POST /panel/itemIconGroup/edit
 */
groupRouter.post('/edit', validate(iconGroupSchema), async (c) => {
  const user = getAuthUser(c)!
  if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)

  const body = c.var.validatedBody as GroupEditBody
  const service = new PanelService(c.env.DB)
  const result = await service.editGroup(body, user.userId)
  return ok(c, result)
})

/**
 * 批量删除分组（级联删除图标）
 * POST /panel/itemIconGroup/deletes
 */
groupRouter.post('/deletes', validate(idsSchema), async (c) => {
  const user = getAuthUser(c)!
  if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
  const { ids } = c.var.validatedBody as { ids: number[] }

  const service = new PanelService(c.env.DB)
  await service.deleteGroups(ids, user.userId)
  return ok(c, null)
})

/**
 * 保存分组排序
 * POST /panel/itemIconGroup/saveSort
 */
groupRouter.post('/saveSort', validate(sortSchema), async (c) => {
  const user = getAuthUser(c)!
  if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
  const { sortItems } = c.var.validatedBody as { sortItems: SortItem[] }

  const service = new PanelService(c.env.DB)
  await service.saveGroupSort(sortItems, user.userId)
  return ok(c, null)
})
