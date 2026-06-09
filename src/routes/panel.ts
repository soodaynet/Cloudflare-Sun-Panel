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
import { PanelService } from '../services/PanelService'
import { ok, fail, getErrorMessage } from '../utils/response'
import { AppError } from '../utils/errors'
import { isValidUrl, normalizeInputUrl, parseFaviconFromHtml, probeFavicon, type FaviconCandidate } from '../utils/favicon'

// Favicon 发现结果缓存 (key: origin, TTL: 1小时)
const faviconCache = new Map<string, { candidates: FaviconCandidate[]; ts: number }>()
const FAVICON_CACHE_TTL = 60 * 60 * 1000 // 1 小时

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
  try {
    const user = getAuthUser(c)
    const userId = user!.userId
    const service = new PanelService(c.env.DB)
    const result = await service.getAllData(userId)

    c.header('Cache-Control', 'private, max-age=60')
    return ok(c, result)
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

/**
 * 批量添加图标
 * POST /api/panel/itemIcon/addMultiple
 */
panelApp.post('/itemIcon/addMultiple', validate(iconAddMultipleSchema), async (c) => {
  try {
    const user = getAuthUser(c)
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
    const items = c.var.validatedBody as Array<{
      icon?: { itemType: number; src?: string; text?: string; backgroundColor?: string }
      title: string
      url: string
      description?: string
      openMethod?: number
      sort?: number
      itemIconGroupId: number
    }>

    const service = new PanelService(c.env.DB)
    await service.addMultipleIcons(items, user!.userId)
    return ok(c, null)
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

/**
 * 编辑图标
 * POST /api/panel/itemIcon/edit
 */
panelApp.post('/itemIcon/edit', validate(iconEditSchema), async (c) => {
  try {
    const user = getAuthUser(c)
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
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

    const service = new PanelService(c.env.DB)
    const result = await service.editIcon(body, user!.userId)
    return ok(c, result)
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

/**
 * 根据分组 ID 获取图标列表
 * POST /api/panel/itemIcon/getListByGroupId
 */
panelApp.post('/itemIcon/getListByGroupId', validate(getListByGroupIdSchema), async (c) => {
  try {
    const user = getAuthUser(c)
    const { itemIconGroupId } = c.var.validatedBody as { itemIconGroupId?: number }

    const service = new PanelService(c.env.DB)
    const list = await service.getIconsByGroupId(itemIconGroupId || 0, user!.userId)
    return ok(c, list)
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

/**
 * 批量删除图标
 * POST /api/panel/itemIcon/deletes
 */
panelApp.post('/itemIcon/deletes', validate(idsSchema), async (c) => {
  try {
    const user = getAuthUser(c)
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
    const { ids } = c.var.validatedBody as { ids: number[] }

    const service = new PanelService(c.env.DB)
    await service.deleteIcons(ids, user!.userId)
    return ok(c, null)
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

/**
 * 保存图标排序
 * POST /api/panel/itemIcon/saveSort
 */
panelApp.post('/itemIcon/saveSort', validate(sortSchema), async (c) => {
  try {
    const user = getAuthUser(c)
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403)
    const { sortItems } = c.var.validatedBody as { sortItems: Array<{ id: number; sort: number }> }

    if (sortItems.length === 0) {
      return ok(c, null)
    }

    const service = new PanelService(c.env.DB)
    await service.saveIconSort(sortItems, user!.userId)
    return ok(c, null)
  } catch (e: unknown) {
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

/**
 * 获取站点图标 (favicon)
 * POST /api/panel/itemIcon/getSiteFavicon
 *
 * 策略:
 * 1. 检查内存缓存 (TTL 1h)
 * 2. 规范化输入 URL
 * 3. 并发执行 HEAD 探测 + HTML 解析
 * 4. 第三方服务兜底
 * 5. 排序: HTML 解析(按尺寸) > HEAD 探测 > 兜底
 * 6. 5 秒硬超时
 */
panelApp.post('/itemIcon/getSiteFavicon', validate(faviconSchema), async (c) => {
  const startTime = Date.now()
  try {
    const { url } = c.var.validatedBody as { url: string }

    // 1. 规范化输入 URL
    const normalized = normalizeInputUrl(url)
    if (!normalized) {
      return fail(c, 'URL 格式不正确', 400)
    }
    const { origin, domain } = normalized

    // 2. 安全检查 (复用原有 isValidUrl)
    if (!isValidUrl(origin)) {
      return fail(c, 'URL 不合法或包含内网地址', 400)
    }

    // 3. 检查缓存
    const cached = faviconCache.get(origin)
    if (cached && (Date.now() - cached.ts) < FAVICON_CACHE_TTL) {
      console.log(`[Favicon] domain=${domain} cache=hit candidates=${cached.candidates.length}`)
      return ok(c, { iconUrls: cached.candidates.map(c => c.url) })
    }

    // 4. 并发执行 HEAD 探测 + HTML 解析
    const probePaths = [
      '/favicon.ico',
    ]

    const probesPromise = Promise.allSettled(
      probePaths.map((path) => probeFavicon(origin, path))
    )

    const htmlPromise = (async (): Promise<FaviconCandidate[]> => {
      try {
        const abort = new AbortController()
        const timeout = setTimeout(() => abort.abort(), 5000)
        const res = await fetch(origin, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SunPanel/1.0)',
            Accept: 'text/html',
          },
          signal: abort.signal,
          redirect: 'follow',
          cf: { cacheTtl: 3600 },
        } as RequestInit)
        clearTimeout(timeout)

        if (!res.ok) return []

        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('text/html') && !ct.includes('application/xhtml')) return []

        const html = await res.text()
        return parseFaviconFromHtml(html, origin)
      } catch {
        return []
      }
    })()

    // 5. 5 秒硬超时控制
    let timedOut = false
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => { timedOut = true; resolve(null) }, 5000)
    })

    // 等待并发结果（或超时）
    const [probeResults] = await Promise.all([
      probesPromise,
      Promise.race([htmlPromise, timeoutPromise]),
    ])

    // 收集 HEAD 探测结果
    const probeCandidates: FaviconCandidate[] = []
    for (let i = 0; i < probeResults.length; i++) {
      const r = probeResults[i]
      if (r.status === 'fulfilled' && r.value) {
        probeCandidates.push(r.value)
      }
    }

    // 收集 HTML 解析结果（如果未超时）
    let htmlCandidates: FaviconCandidate[] = []
    if (!timedOut) {
      const htmlResult = await Promise.race([htmlPromise, timeoutPromise])
      if (htmlResult && Array.isArray(htmlResult)) {
        htmlCandidates = htmlResult
      }
    }

    // 6. 构建去重集合
    const seen = new Set<string>()
    const allCandidates: FaviconCandidate[] = []

    function add(c: FaviconCandidate) {
      if (seen.has(c.url)) return
      seen.add(c.url)
      allCandidates.push(c)
    }

    // 排序: HTML 解析(按 size 降序) > HEAD 探测 > 兜底
    // HTML 解析结果已按 size 降序排列（在 parseFaviconFromHtml 中完成）
    for (const c of htmlCandidates) add(c)
    for (const c of probeCandidates) add(c)

    // 第三方兜底
    const fallbackCandidates: FaviconCandidate[] = [
      { url: `https://t0.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=${origin}`, source: 'fallback' },
      { url: `https://api.iowen.cn/favicon/?url=${domain}`, source: 'fallback' },
    ]
    for (const c of fallbackCandidates) add(c)

    console.log(`[Favicon] domain=${domain} cache=miss probes=${probeCandidates.length} html=${htmlCandidates.length} fallback=${fallbackCandidates.length} candidates=${allCandidates.length} time=${Date.now() - startTime}ms`)

    // 7. 缓存结果
    faviconCache.set(origin, { candidates: allCandidates, ts: Date.now() })

    return ok(c, { iconUrls: allCandidates.map(c => c.url) })
  } catch (e: unknown) {
    console.error(`[Favicon] unhandled error`, e)
    if (e instanceof AppError) {
      return fail(c, e.message, e.code, e.httpStatus)
    }
    return fail(c, getErrorMessage(e), 500)
  }
})

export default panelApp
