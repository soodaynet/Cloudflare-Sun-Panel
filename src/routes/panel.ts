import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import { publicModeMiddleware, getAuthUser } from '../middleware/auth'
import {
  validate,
  iconEditSchema,
  iconAddMultipleSchema,
  idsSchema,
  sortSchema,
  getListByGroupIdSchema,
  faviconSchema,
} from '../utils/validate'
import { ServiceFactory } from '../services/ServiceFactory'
import { ok, fail } from '../utils/response'
import { isValidUrl, parseFaviconFromHtml, probeFavicon } from '../utils/favicon'

type Variables = {
  validatedBody: unknown
}

const panelApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>()

panelApp.use('*', publicModeMiddleware)

/**
 * 统一获取全部数据（分组 + 所有图标 + 用户配置）
 * POST /api/panel/getAllData
 */
panelApp.post('/getAllData', async (c) => {
  const user = getAuthUser(c)!
  const factory = ServiceFactory.from(c.env.DB)
  const result = await factory.panel.getAllData(user.userId)

  c.header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
  return ok(c, result)
})

/**
 * 批量添加图标
 * POST /api/panel/itemIcon/addMultiple
 */
panelApp.post('/itemIcon/addMultiple', validate(iconAddMultipleSchema), async (c) => {
  const user = getAuthUser(c)!
  if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
  const items = c.var.validatedBody as Array<{
    icon?: { itemType: number; src?: string; text?: string; backgroundColor?: string }
    title: string
    url: string
    description?: string
    openMethod?: number
    sort?: number
    itemIconGroupId: number
  }>

  const factory = ServiceFactory.from(c.env.DB)
  await factory.panel.addMultipleIcons(items, user.userId)
  return ok(c, null)
})

/**
 * 编辑图标
 * POST /api/panel/itemIcon/edit
 */
panelApp.post('/itemIcon/edit', validate(iconEditSchema), async (c) => {
  const user = getAuthUser(c)!
  if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
  const body = c.var.validatedBody as {
    id?: number
    icon?: { itemType: number; src?: string; text?: string; backgroundColor?: string }
    title: string
    url: string
    description?: string
    openMethod?: number
    sort?: number
    itemIconGroupId: number
  }

  const factory = ServiceFactory.from(c.env.DB)
  const result = await factory.panel.editIcon(body, user.userId)
  return ok(c, result)
})

/**
 * 根据分组 ID 获取图标列表
 * POST /api/panel/itemIcon/getListByGroupId
 */
panelApp.post('/itemIcon/getListByGroupId', validate(getListByGroupIdSchema), async (c) => {
  const user = getAuthUser(c)!
  const { itemIconGroupId } = c.var.validatedBody as { itemIconGroupId?: number }

  const factory = ServiceFactory.from(c.env.DB)
  const list = await factory.panel.getIconsByGroupId(itemIconGroupId || 0, user.userId)

  c.header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
  return ok(c, list)
})

/**
 * 批量删除图标
 * POST /api/panel/itemIcon/deletes
 */
panelApp.post('/itemIcon/deletes', validate(idsSchema), async (c) => {
  const user = getAuthUser(c)!
  if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
  const { ids } = c.var.validatedBody as { ids: number[] }

  const factory = ServiceFactory.from(c.env.DB)
  await factory.panel.deleteIcons(ids, user.userId)
  return ok(c, null)
})

/**
 * 保存图标排序
 * POST /api/panel/itemIcon/saveSort
 */
panelApp.post('/itemIcon/saveSort', validate(sortSchema), async (c) => {
  const user = getAuthUser(c)!
  if (user.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
  const { sortItems } = c.var.validatedBody as { sortItems: Array<{ id: number; sort: number }> }

  if (sortItems.length === 0) {
    return ok(c, null)
  }

  const factory = ServiceFactory.from(c.env.DB)
  await factory.panel.saveIconSort(sortItems, user.userId)
  return ok(c, null)
})

/**
 * 获取站点图标 (favicon)
 * POST /api/panel/itemIcon/getSiteFavicon
 */
panelApp.post('/itemIcon/getSiteFavicon', validate(faviconSchema), async (c) => {
  const { url } = c.var.validatedBody as { url: string }

  if (!isValidUrl(url)) {
    return fail(c, 'URL 不合法或包含内网地址', 400)
  }

  const parsedUrl = new URL(url)
  const origin = parsedUrl.origin
  const found = new Set<string>()

  // HEAD 探测 /favicon.ico
  const probeResult = await probeFavicon(origin, '/favicon.ico')
  if (probeResult) {
    found.add(probeResult.url)
  }

  // 下载 HTML 并解析 <link rel="icon"> 标签
  try {
    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), 5000)
    const htmlRes = await fetch(origin, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SunPanel/1.0)',
        Accept: 'text/html',
      },
      signal: abort.signal,
      redirect: 'follow',
      cf: { cacheTtl: 3600 },
    } as RequestInit)
    clearTimeout(timeout)

    if (htmlRes.ok) {
      const html = await htmlRes.text()
      const htmlCandidates = parseFaviconFromHtml(html, origin)
      for (const iconUrl of htmlCandidates) {
        found.add(iconUrl.url)
      }
    }
  } catch {
    /* HTML fetch failed, use probe result */
  }

  // /favicon.ico 兜底
  found.add(`${origin}/favicon.ico`)

  // Google Favicon
  found.add(`https://t0.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=${origin}`)

  const iconUrls = Array.from(found).slice(0, 10)
  return ok(c, { iconUrls })
})

export default panelApp