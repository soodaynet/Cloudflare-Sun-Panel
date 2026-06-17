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

function isExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.origin !== window.location.origin
  } catch {
    return false
  }
}

function proxyFaviconUrl(url: string): string {
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
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
  // 外部 URL（跨域 favicon）通过后端代理，避免浏览器 CORS 报错
  link.href = isExternalUrl(url) ? proxyFaviconUrl(url) : url
}

export { detectFaviconType, updateFavicon, getCachedSiteConfig }
export { SITE_CACHE_KEY }

function getCachedSiteConfig(): Panel.SiteConfig {
  try {
    const cached = localStorage.getItem(SITE_CACHE_KEY)
    if (cached) return JSON.parse(cached) as Panel.SiteConfig
  } catch { /* ignore */ }
  return {}
}