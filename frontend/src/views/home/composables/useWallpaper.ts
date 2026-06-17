import { ref, watchEffect, type Ref } from 'vue'
import { usePanelState } from '@/store'
import { WALLPAPER_CACHE_KEY } from '@/utils/storageKeys'

/** 检测 URL 是否为动态图片 API（含 random/php/api. 等关键词） */
export function isDynamicApiUrl(url: string): boolean {
  return /(\/random|\.php|api\.)/i.test(url)
}

interface PreloadGroup {
  items?: Array<{ icon?: { src?: string } | null }>
}

export function useWallpaper(
  siteConfig: Ref<Panel.SiteConfig>,
  panelState?: ReturnType<typeof usePanelState>,
  isVisitMode: () => boolean = () => false,
) {
  const ps = panelState || usePanelState()

  const effectiveBackgroundImage = ref(localStorage.getItem(WALLPAPER_CACHE_KEY) || '')

  /**
   * 数据就绪标志：为 false 时不允许回退到 siteConfig.login_bg_image，
   * 防止初始渲染时因 panelConfig.backgroundImageSrc 为空而误用站点壁纸造成闪烁。
   */
  const dataReady = ref(false)

  /** 获取当前壁纸：访客模式优先使用站点公开壁纸，用户模式优先使用风格设置壁纸 */
  function getWallpaperUrl(): string {
    const wallpaperSrc = ps.panelConfig.backgroundImageSrc
    const loginBgImage = siteConfig.value.login_bg_image
    if (isVisitMode()) {
      // 访客：优先使用站点公开壁纸，风格壁纸作为兜底
      return loginBgImage || wallpaperSrc || ''
    }
    // 用户：优先使用风格设置壁纸，站点壁纸作为兜底
    return wallpaperSrc || loginBgImage || ''
  }

  /**
   * 壁纸地址优先级：
   * - 访客模式：站点公开壁纸 login_bg_image > 风格设置 backgroundImageSrc > 空
   * - 用户模式：风格设置 backgroundImageSrc > 站点设置 login_bg_image > 空
   * dataReady 为 false 时仅使用缓存值，不触发回退逻辑
   */
  watchEffect(() => {
    // 未就绪时：仅使用缓存值，不主动回退到站点壁纸（避免闪烁）
    if (!dataReady.value) return

    const url = getWallpaperUrl()

    if (url !== effectiveBackgroundImage.value) {
      effectiveBackgroundImage.value = url
    }
    if (url) {
      localStorage.setItem(WALLPAPER_CACHE_KEY, url)
    }
  })

  /** 标记数据已加载，允许回退到站点壁纸 */
  function markDataReady() {
    // 数据就绪后手动同步一次，确保壁纸正确
    const url = getWallpaperUrl()

    if (url !== effectiveBackgroundImage.value) {
      effectiveBackgroundImage.value = url
    }
    if (url) {
      localStorage.setItem(WALLPAPER_CACHE_KEY, url)
    }
    dataReady.value = true
  }

  function preloadBackgroundImage(url: string) {
    let link = document.querySelector('link[rel="preload"][as="image"][data-wallpaper]') as HTMLLinkElement | null
    if (link && link.href === url) return
    link?.remove()
    if (!url) return

    // <link rel="preload"> 触发浏览器提前下载
    link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = url
    link.setAttribute('data-wallpaper', 'true')
    document.head.appendChild(link)

    // 后台解码，利用预加载的缓存，不产生二次请求
    const img = new Image()
    img.src = url
    img.decode().catch(() => {})
  }

  /** 兼容旧代码：syncEffectiveWallpaper 由 watchEffect 自动处理 */
  function syncEffectiveWallpaper() {
    // 数据就绪后手动同步一次
    if (!dataReady.value) {
      markDataReady()
      return
    }
    const url = getWallpaperUrl()

    if (url !== effectiveBackgroundImage.value) {
      effectiveBackgroundImage.value = url
    }
    if (url) {
      localStorage.setItem(WALLPAPER_CACHE_KEY, url)
    }
  }

  /** 预加载首屏图标（前 N 个），加速图标渲染 */
  function preloadIconImages(groups: PreloadGroup[], count: number = 36) {
    let loaded = 0
    const seen = new Set<string>()
    for (const group of groups) {
      for (const item of group.items || []) {
        if (loaded >= count) return
        if (!item.icon?.src) continue

        const src = item.icon.src
        if (seen.has(src)) continue
        seen.add(src)

        const link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'image'
        link.href = src
        link.setAttribute('data-icon-preload', 'true')
        document.head.appendChild(link)

        const img = new Image()
        img.src = src
        img.decode().catch(() => {})
        loaded++
      }
    }
  }

  // 壁纸变化时预加载新壁纸
  watchEffect(() => {
    const url = effectiveBackgroundImage.value
    if (url) {
      preloadBackgroundImage(url)
    }
  })

  return {
    effectiveBackgroundImage,
    syncEffectiveWallpaper,
    preloadIconImages,
    markDataReady,
  }
}