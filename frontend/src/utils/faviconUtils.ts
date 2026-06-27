import { SITE_CACHE_KEY } from './storageKeys'

function detectFaviconType(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'svg': return 'image/svg+xml'
    case 'png': return 'image/png'
    case 'ico': return 'image/x-icon'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'gif': return 'image/gif'
    case 'webp': return 'image/webp'
    default: return ''
  }
}

function updateFavicon(url: string) {
  let link = document.querySelector('link[rel~="icon"]') as HTMLLinkElement | null
  if (!url) {
    if (link) link.remove()
    return
  }
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  const detectedType = detectFaviconType(url)
  if (detectedType) {
    link.type = detectedType
  }
  link.href = url
}

export { updateFavicon, getCachedSiteConfig }

/** 把存量 google favicon URL 重写为同源 /api/favicon-proxy（边缘缓存 30 天 + 64px），其它 URL 原样返回 */
export function toProxiedFavicon(src: string): string {
  if (!src) return src
  // 匹配 t0.gstatic.cn / t0.gstatic.com 的 faviconV2 端点
  if (/t0\.gstatic\.(cn|com)\/faviconV2/.test(src)) {
    try {
      const u = new URL(src)
      const domain = u.searchParams.get('url') // google 参数名是 url
      if (domain) {
        const hostname = new URL(domain).hostname || domain
        return `/api/favicon-proxy?domain=${encodeURIComponent(hostname)}&sz=64`
      }
    } catch { /* 解析失败原样返回 */ }
  }
  return src
}

function getCachedSiteConfig(): Panel.SiteConfig {
  try {
    const cached = localStorage.getItem(SITE_CACHE_KEY)
    if (cached) return JSON.parse(cached) as Panel.SiteConfig
  } catch { /* ignore */ }
  return {}
}