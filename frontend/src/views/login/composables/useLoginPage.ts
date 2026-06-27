import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getAbout } from '@/modules/settings/api'
import { useAuthStore } from '@/store/modules/auth'
import { updateFavicon, getCachedSiteConfig } from '@/utils/faviconUtils'
import {
  LOGIN_BG_CACHE_KEY,
  LOGIN_STYLE_CACHE_KEY,
  SITE_CACHE_KEY,
  SITE_CACHE_TS_KEY,
  PUBLIC_MODE_KEY,
  SKIP_REDIRECT_KEY,
  TOKEN_KEY,
} from '@/utils/storageKeys'

interface CachedLoginStyle {
  blur: number
  opacity: number
}
function getCachedLoginStyle(): CachedLoginStyle {
  try {
    const cached = localStorage.getItem(LOGIN_STYLE_CACHE_KEY)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch {
    /* ignore */
  }
  return { blur: 12, opacity: 0.15 }
}

function preloadLoginBg(url: string) {
  document.querySelector('link[data-login-bg]')?.remove()
  if (!url) return
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = url
  link.setAttribute('data-login-bg', 'true')
  document.head.appendChild(link)
}

// 模块级：从缓存恢复配置，避免 API 返回前显示默认值
const cachedLoginBg = localStorage.getItem(LOGIN_BG_CACHE_KEY) || ''
const cachedStyle = getCachedLoginStyle()

const loginBgImage = ref(cachedLoginBg)
if (cachedLoginBg) {
  preloadLoginBg(cachedLoginBg)
}

// 从缓存恢复全局玻璃变量，避免 API 返回前 Toaster 无玻璃效果
document.documentElement.style.setProperty('--ann-blur', `${cachedStyle.blur}px`)
document.documentElement.style.setProperty('--ann-opacity', `${cachedStyle.opacity}`)

// 壁纸加载就绪标志：用于控制容器淡入动画，与访客页面 HomeWallpaper 效果一致
const bgImageReady = ref(false)

/** 追踪壁纸加载状态，加载完成后触发淡入动画 */
function trackBgLoad(url: string) {
  bgImageReady.value = false
  if (!url) {
    bgImageReady.value = true
    return
  }
  const img = new Image()
  img.onload = () => { bgImageReady.value = true }
  img.onerror = () => { bgImageReady.value = true }
  img.src = url
}

// 从缓存初始化壁纸加载状态
if (cachedLoginBg) {
  trackBgLoad(cachedLoginBg)
} else {
  bgImageReady.value = true
}

// 从站点缓存恢复标题和图标
const cachedSiteConfig = getCachedSiteConfig()
const cachedTitle = cachedSiteConfig.site_title
const cachedFavicon = cachedSiteConfig.favicon_url || ''

// 立即应用缓存的标题和图标（浏览器标签页）
if (cachedTitle) {
  document.title = cachedTitle
}
updateFavicon(cachedFavicon)

export function useLoginPage() {
  const router = useRouter()
  const authStore = useAuthStore()

  const hasPublicMode = ref(false)
  const siteTitle = ref(cachedTitle || '')
  const pageLoading = ref(true)

  const loginPageStyle = computed(() => {
    const bgImage = loginBgImage.value
    if (bgImage) {
      return {
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#dce2e8', // 中性色兜底，图片加载期间不闪白
        transform: 'translateZ(0)',
        willChange: 'transform',
      }
    }
    // 无自定义背景时显示渐变（与首页壁纸风格一致）
    return {
      background: '#dce2e8',
    }
  })

  // 先从缓存恢复登录卡片样式，避免 API 返回前闪现默认值
  const loginBlur = ref(cachedStyle.blur)
  const loginMaskOpacity = ref(cachedStyle.opacity)

  const loginCardStyle = computed(() => {
    return {
      '--glass-blur': `${loginBlur.value}px`,
      '--glass-bg-hover': `rgba(255, 255, 255, ${loginMaskOpacity.value})`,
    } as Record<string, string>
  })

  // 登录按钮玻璃层：相对登录卡片 ×1.2（模糊度与遮罩不透明度），颜色与主题 primary 协调
  const loginButtonStyle = computed(() => {
    const blur = Math.round(loginBlur.value * 1.2)
    const opacity = Math.min(loginMaskOpacity.value * 1.2, 1.0)
    return {
      '--btn-blur': `${blur}px`,
      '--btn-bg': `rgba(74, 144, 217, ${Math.max(opacity, 0.82)})`,
    } as Record<string, string>
  })

  async function initLoginPage() {
    try {
      const res = await getAbout<Record<string, string>>()
      if (res.code === 0 && res.data) {
        applyAboutResponse(res.data)
      }
    } catch (e) {
      // 排查站点信息无法显示的问题（如 CDN 缓存、WAF 拦截、网络错误）
      console.error('[login] getAbout failed:', e)
    } finally {
      pageLoading.value = false
    }
  }

  function applyAboutResponse(data: Record<string, string>) {
    // 1. 先应用站点信息（无论是否公开模式都需要，避免重定向时站点标题/图标/背景缺失）
    if (data.site_title) {
      siteTitle.value = data.site_title
      document.title = data.site_title
    }
    // 应用自定义图标到浏览器标签页
    if (data.favicon_url !== undefined) {
      localStorage.setItem(
        SITE_CACHE_KEY,
        JSON.stringify({ ...JSON.parse(localStorage.getItem(SITE_CACHE_KEY) || '{}'), favicon_url: data.favicon_url }),
      )
      updateFavicon(data.favicon_url || '')
      localStorage.setItem(SITE_CACHE_TS_KEY, String(Date.now()))
    }
    // 使用站点设置中的登录页背景图片
    const bgUrl = data.login_bg_image || ''
    if (bgUrl) {
      // 缓存 URL 用于下次访问
      localStorage.setItem(LOGIN_BG_CACHE_KEY, bgUrl)
      // 添加 <link rel="preload"> 提示浏览器提前下载
      preloadLoginBg(bgUrl)
      // 追踪壁纸加载状态，加载完成后触发淡入
      trackBgLoad(bgUrl)
      // 立即设置背景 URL，不要等图片加载完再切换（否则会闪现默认渐变）
      loginBgImage.value = bgUrl
    }
    // 读取登录卡片模糊度和遮罩不透明度设置
    if (data.login_blur !== undefined) {
      loginBlur.value = Number(data.login_blur)
    }
    if (data.login_mask_opacity !== undefined) {
      loginMaskOpacity.value = Number(data.login_mask_opacity)
    }
    // 同步全局玻璃变量，使登录页 Toaster 等玻璃元素与公告设置一致
    document.documentElement.style.setProperty('--ann-blur', `${loginBlur.value}px`)
    document.documentElement.style.setProperty('--ann-opacity', `${loginMaskOpacity.value}`)
    // 缓存样式用于下次访问
    localStorage.setItem(
      LOGIN_STYLE_CACHE_KEY,
      JSON.stringify({
        blur: loginBlur.value,
        opacity: loginMaskOpacity.value,
      }),
    )

    // 2. 处理公开模式重定向（站点信息已应用后再判断，避免重定向 return 跳过站点信息）
    const hasPublic = !!(data.panel_public_user_id || data.default_guest_mode === '1')
    if (hasPublic) {
      hasPublicMode.value = true
      localStorage.setItem(PUBLIC_MODE_KEY, '1')
      if (!localStorage.getItem(TOKEN_KEY)) {
        const skipAutoRedirect = sessionStorage.getItem(SKIP_REDIRECT_KEY)
        if (!skipAutoRedirect) {
          authStore.setGuestMode(null)
          router.push('/')
          return
        }
      }
    } else {
      localStorage.setItem(PUBLIC_MODE_KEY, '0')
    }
  }

  return {
    hasPublicMode,
    siteTitle,
    pageLoading,
    loginPageStyle,
    loginCardStyle,
    loginButtonStyle,
    bgImageReady,
    initLoginPage,
  }
}
