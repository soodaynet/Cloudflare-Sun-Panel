/** 校验 URL 是否合法（SSRF 防护） */
export function isValidUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return false

    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    const match = hostname.match(ipv4Pattern)
    if (match) {
      const [, a, b] = match.map(Number)
      if (a === 10) return false
      if (a === 172 && b >= 16 && b <= 31) return false
      if (a === 192 && b === 168) return false
      if (a === 127) return false
      if (a === 169 && b === 254) return false
      if (a === 0) return false
    }
    return true
  } catch {
    return false
  }
}

/** favicon 候选项 */
export interface FaviconCandidate {
  url: string
  size?: number
  source: string
}

/** 视为图标声明的 rel 关键词（小写匹配） */
const ICON_REL_KEYWORDS = ['icon', 'shortcut icon', 'apple-touch-icon', 'mask-icon', 'fluid-icon']

/**
 * 从站点 HTML 中解析所有声明的 favicon：
 * - <link rel="icon|shortcut icon|apple-touch-icon|mask-icon|fluid-icon" href="..." sizes="...">
 * - <meta name="msapplication-TileImage" content="...">
 *
 * 相对/协议相对 href 基于 baseUrl 解析为绝对 URL；
 * 按 URL 去重（同 URL 保留尺寸最大者）；最终按尺寸降序排序（undefined 排末尾）。
 *
 * @param html 站点 HTML 文本
 * @param baseUrl 站点 origin，用于解析相对 href
 */
export function parseFaviconFromHtml(html: string, baseUrl: string): FaviconCandidate[] {
  // 按 URL 去重，同 URL 保留尺寸更大者（undefined 视为最小）
  const byUrl = new Map<string, FaviconCandidate>()
  const upsert = (c: FaviconCandidate) => {
    const existing = byUrl.get(c.url)
    if (!existing) {
      byUrl.set(c.url, c)
      return
    }
    const a = existing.size ?? -1
    const b = c.size ?? -1
    if (b > a) byUrl.set(c.url, c)
  }

  // 构造属性提取正则（大小写不敏感）
  const attrRegex = (name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i')

  // 解析单个 size token：形如 "180x180" 取较大维度；"any" 或不可解析 → undefined
  const parseSize = (token: string): number | undefined => {
    const m = token.match(/^(\d+)x(\d+)$/i)
    if (!m) return undefined
    return Math.max(Number(m[1]), Number(m[2]))
  }

  // 解析绝对 URL，无效时返回 null
  const resolveUrl = (href: string): string | null => {
    try {
      return new URL(href, baseUrl).href
    } catch {
      return null
    }
  }

  // 1. 解析 <link> 标签
  const linkRegex = /<link\b[^>]*>/gi
  const relRe = attrRegex('rel')
  const hrefRe = attrRegex('href')
  const sizesRe = attrRegex('sizes')
  let linkMatch: RegExpExecArray | null
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const tag = linkMatch[0]
    const relMatch = tag.match(relRe)
    if (!relMatch) continue
    // rel 可能是空格分隔的多个 token，任一命中关键词即视为图标声明
    const relTokens = relMatch[1].toLowerCase().trim().split(/\s+/)
    if (!relTokens.some(token => ICON_REL_KEYWORDS.includes(token))) continue

    const hrefMatch = tag.match(hrefRe)
    if (!hrefMatch) continue
    const href = hrefMatch[1].trim()
    if (!href) continue
    const absUrl = resolveUrl(href)
    if (!absUrl) continue

    // 解析 sizes 属性（空格分隔的多个尺寸）；无 sizes 时视为单个 undefined
    const sizesMatch = tag.match(sizesRe)
    const sizesRaw = sizesMatch ? sizesMatch[1].trim() : ''
    const sizeTokens = sizesRaw ? sizesRaw.split(/\s+/) : []
    const sizes: (number | undefined)[] = sizeTokens.length > 0
      ? sizeTokens.map(parseSize)
      : [undefined]

    // 每个尺寸生成一个候选（同 URL 会被 upsert 合并保留最大者）
    for (const size of sizes) {
      upsert({ url: absUrl, size, source: 'html' })
    }
  }

  // 2. 解析 <meta name="msapplication-TileImage" content="...">
  const metaRegex = /<meta\b[^>]*>/gi
  const nameRe = attrRegex('name')
  const contentRe = attrRegex('content')
  let metaMatch: RegExpExecArray | null
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const tag = metaMatch[0]
    const nameMatch = tag.match(nameRe)
    if (!nameMatch) continue
    if (nameMatch[1].toLowerCase().trim() !== 'msapplication-tileimage') continue
    const contentMatch = tag.match(contentRe)
    if (!contentMatch) continue
    const href = contentMatch[1].trim()
    if (!href) continue
    const absUrl = resolveUrl(href)
    if (!absUrl) continue
    upsert({ url: absUrl, size: undefined, source: 'html' })
  }

  // 按尺寸降序排序，undefined 排末尾
  const candidates = Array.from(byUrl.values())
  candidates.sort((a, b) => {
    if (a.size === undefined && b.size === undefined) return 0
    if (a.size === undefined) return 1
    if (b.size === undefined) return -1
    return b.size - a.size
  })

  return candidates
}

/**
 * HEAD 探测指定路径是否存在有效的 favicon
 * - 2s 超时（AbortController）
 * - cf 边缘缓存 1 小时（cacheTtl: 3600）
 * - 任何错误/超时/非 2xx 返回 null
 * - 校验 Content-Type（须为 image/*、application/octet-stream 或包含 icon）与 Content-Length（非 0）
 *
 * @param origin 站点 origin，如 https://example.com
 * @param path 探测路径，如 /favicon.ico
 */
export async function probeFavicon(origin: string, path: string): Promise<FaviconCandidate | null> {
  try {
    const url = `${origin}${path}`
    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), 2000)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'HEAD',
        signal: abort.signal,
        redirect: 'follow',
        cf: { cacheTtl: 3600 },
      } as RequestInit)
    } finally {
      clearTimeout(timeout)
    }
    if (!res.ok) return null
    // Content-Length 为 0 视为无效
    const contentLength = res.headers.get('Content-Length')
    if (contentLength === '0') return null
    // Content-Type 须为图片、octet-stream 或包含 icon
    const contentType = (res.headers.get('Content-Type') ?? '').toLowerCase()
    const isValidType =
      contentType.startsWith('image/') ||
      contentType === 'application/octet-stream' ||
      contentType.includes('icon')
    if (!isValidType) return null
    return { url, source: 'probe' }
  } catch {
    return null
  }
}
