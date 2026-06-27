/**
 * 运行时动态注入 <link rel="preconnect"> 到 <head>
 * 用于外部域图标资源预连接，节省 TLS/连接时间
 * 去重逻辑：同 origin 不注入，同 origin 重复调用只注入一次
 */

const injectedOrigins = new Set<string>()

/**
 * 为指定 URL 注入 preconnect link
 * - 同源（url.origin === location.origin）不注入
 * - 已注入过的 origin 不重复注入
 * @param urlStr 资源 URL
 */
export function preconnectOrigin(urlStr: string): void {
  if (typeof document === 'undefined') return
  try {
    const url = new URL(urlStr, location.origin)
    // 同源不注入
    if (url.origin === location.origin) return
    // 已注入过的不重复
    if (injectedOrigins.has(url.origin)) return
    injectedOrigins.add(url.origin)

    // 双重检查 DOM，避免 SSR 或其他途径已注入
    const existing = document.querySelector(`link[rel="preconnect"][href="${url.origin}"]`)
    if (existing) return

    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = url.origin
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  } catch {
    // URL 不合法则忽略
  }
}
