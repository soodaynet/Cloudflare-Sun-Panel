import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { z } from 'zod'
import { publicModeMiddleware, getAuthUser } from '../middleware/auth'
import { PanelService } from '../services/PanelService'
import { ok, fail } from '../utils/response'
import {
  validate, iconEditSchema, iconAddMultipleSchema,
  idsSchema, faviconSchema, getListByGroupIdSchema, sortSchema,
} from '../utils/validate'

type Variables = { validatedBody: unknown }

const panelApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>()

panelApp.use('*', publicModeMiddleware)

function isHttpUrl(url: string): boolean {
  return /^(https?:\/\/|\/\/)/i.test(url)
}

const BLOCKED_NETWORKS = [
  { prefix: '127.', mask: 8 },
  { prefix: '10.', mask: 8 },
  { prefix: '172.16.', mask: 12 },
  { prefix: '192.168.', mask: 16 },
  { prefix: '169.254.', mask: 16 },
  { prefix: '0.', mask: 8 },
]

function isPrivateIP(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  for (const net of BLOCKED_NETWORKS) {
    const prefixBytes = net.prefix.split('.').filter(B => B)
    const hostBytes = hostname.split('.')
    if (hostBytes.length < prefixBytes.length) continue
    let match = true
    for (let i = 0; i < prefixBytes.length; i++) {
      if (prefixBytes[i] !== hostBytes[i]) { match = false; break }
    }
    if (match) return true
  }
  return false
}

function isValidUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    if (isPrivateIP(url.hostname)) return false
    return true
  } catch {
    return false
  }
}

const FETCH_TIMEOUT_MS = 8000

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function getFaviconUrl(urlStr: string): Promise<string | null> {
  if (!isValidUrl(urlStr)) return null

  try {
    const domain = new URL(urlStr)
    const resp = await fetchWithTimeout(urlStr, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'follow',
    })

    if (!resp.ok) {
      const resp2 = await fetchWithTimeout(`https://${domain.hostname}/favicon.ico`, { method: 'HEAD' })
      if (resp2.ok) return `https://${domain.hostname}/favicon.ico`
      return null
    }

    const html = await resp.text()
    const linkRegex = /<link[^>]+rel=["']([^"']*\bicon\b[^"']*)["'][^>]*href=["']([^"']+)["'][^>]*>/gi
    const hrefRegex = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']([^"']*\bicon\b[^"']*)["'][^>]*>/gi

    const icons: string[] = []
    for (const re of [linkRegex, hrefRegex]) {
      let match
      while ((match = re.exec(html)) !== null) {
        const href = re === linkRegex ? match[2] : match[1]
        if (href.match(/\.(ico|png|svg|jpg|jpeg|gif|webp)/i) || match[1]?.includes('icon')) {
          icons.push(href)
        }
      }
    }

    for (const v of icons) {
      if (isHttpUrl(v)) return v
      const fullUrl = `${domain.protocol}//${domain.host}/${v.replace(/^\//, '')}`
      return fullUrl
    }

    const defaultFavicon = `${domain.protocol}//${domain.hostname}/favicon.ico`
    const checkResp = await fetchWithTimeout(defaultFavicon, { method: 'HEAD' })
    if (checkResp.ok) return defaultFavicon

    return null
  } catch {
    return null
  }
}

panelApp.post('/getAllData', async (c) => {
  const svc = new PanelService(c.env.DB)
  const user = getAuthUser(c)!

  const data = await svc.getAllData(user.userId)
  c.header('Cache-Control', 'public, max-age=30')
  return ok(c, data)
})

panelApp.post('/itemIcon/addMultiple', validate(iconAddMultipleSchema), async (c) => {
  const svc = new PanelService(c.env.DB)
  const user = getAuthUser(c)!
  const items = c.get('validatedBody') as z.infer<typeof iconAddMultipleSchema>

  await svc.addMultipleIcons(items, user.userId)
  return ok(c, null)
})

panelApp.post('/itemIcon/edit', validate(iconEditSchema), async (c) => {
  const svc = new PanelService(c.env.DB)
  const user = getAuthUser(c)!
  const body = c.get('validatedBody') as z.infer<typeof iconEditSchema>

  const result = await svc.editIcon(body, user.userId)
  return ok(c, result)
})

panelApp.post('/itemIcon/getListByGroupId', validate(getListByGroupIdSchema), async (c) => {
  const svc = new PanelService(c.env.DB)
  const user = getAuthUser(c)!
  const { itemIconGroupId } = c.get('validatedBody') as z.infer<typeof getListByGroupIdSchema>

  const list = await svc.getIconsByGroupId(itemIconGroupId || 0, user.userId)
  return ok(c, list)
})

panelApp.post('/itemIcon/deletes', validate(idsSchema), async (c) => {
  const svc = new PanelService(c.env.DB)
  const user = getAuthUser(c)!
  const { ids } = c.get('validatedBody') as z.infer<typeof idsSchema>

  await svc.deleteIcons(ids, user.userId)
  return ok(c, null)
})

panelApp.post('/itemIcon/saveSort', validate(sortSchema), async (c) => {
  const svc = new PanelService(c.env.DB)
  const user = getAuthUser(c)!
  const { sortItems } = c.get('validatedBody') as z.infer<typeof sortSchema>

  await svc.saveIconSort(sortItems, user.userId)
  return ok(c, null)
})

panelApp.post('/itemIcon/getSiteFavicon', validate(faviconSchema), async (c) => {
  const { url } = c.get('validatedBody') as z.infer<typeof faviconSchema>

  const iconUrl = await getFaviconUrl(url)
  if (!iconUrl) return fail(c, '获取图标失败', 1)

  return ok(c, { iconUrl })
})

export default panelApp