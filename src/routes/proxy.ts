import { Hono } from 'hono'
import { logger } from '../utils/logger'

const proxyApp = new Hono()

/**
 * 图片代理接口（GET 方式，用于 <img> 标签直接引用）
 * GET /api/proxy-image?url=...
 */
proxyApp.get('/api/proxy-image', async (c) => {
  const url = c.req.query('url')
  if (!url || typeof url !== 'string') {
    return c.json({ code: 400, msg: '缺少 url 参数', data: null }, 400)
  }

  try {
    new URL(url)
  } catch {
    return c.json({ code: 400, msg: '无效的 URL', data: null }, 400)
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SunPanel/1.0)' },
      redirect: 'follow',
      // Cloudflare 边缘缓存：同一图片 24 小时内只回源一次
      cf: { cacheTtl: 86400, cacheEverything: true },
    } as RequestInit)
    const contentType = response.headers.get('Content-Type') || ''
    if (contentType.includes('text/html') || contentType.includes('application/json') || contentType.includes('text/plain')) {
      return c.json({ code: 400, msg: '无法获取图片', data: null }, 400)
    }
    const headers = new Headers()
    if (contentType) headers.set('Content-Type', contentType)
    headers.set('Cache-Control', 'public, max-age=3600')
    headers.set('Access-Control-Allow-Origin', '*')
    return new Response(response.body, { headers })
  } catch (err) {
    logger.error('Proxy', 'GET Error', err)
    return c.json({ code: 400, msg: '无法获取图片', data: null }, 400)
  }
})

/**
 * 图片代理接口（POST 方式，返回 JSON 响应）
 * POST /api/proxy-image
 */
proxyApp.post('/api/proxy-image', async (c) => {
  try {
    const body = await c.req.json<{ url: string }>()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return c.json({ code: 400, msg: '缺少 url 参数', data: null }, 400)
    }

    try {
      new URL(url)
    } catch {
      return c.json({ code: 400, msg: '无效的 URL', data: null }, 400)
    }

    const fetchImage = async (targetUrl: string): Promise<Response> => {
      const response = await fetch(targetUrl, {
        // Cloudflare 边缘缓存：同一图片 24 小时内只回源一次
        cf: { cacheTtl: 86400, cacheEverything: true },
      } as RequestInit)
      const contentType = response.headers.get('Content-Type') || ''

      if (contentType.includes('image/')) {
        const headers = new Headers()
        headers.set('Content-Type', contentType)
        headers.set('Cache-Control', 'public, max-age=3600')
        return new Response(response.body, { headers })
      }

      if (contentType.includes('application/json')) {
        const json = await response.json<{ url?: string; data?: string; src?: string }>()
        const imageUrl = json.url || json.data || json.src
        if (imageUrl && typeof imageUrl === 'string') {
          try {
            new URL(imageUrl)
          } catch {
            return c.json({ code: 400, msg: 'JSON 中的图片地址无效', data: null }, 400)
          }
          return fetchImage(imageUrl)
        }
        return c.json({ code: 400, msg: 'JSON 中未找到图片地址', data: null }, 400)
      }

      return c.json({ code: 400, msg: '无法获取图片', data: null }, 400)
    }

    return await fetchImage(url)
  } catch (err) {
    logger.error('Proxy', 'POST Error', err)
    return c.json({ code: 400, msg: '无法获取图片', data: null }, 400)
  }
})

export default proxyApp