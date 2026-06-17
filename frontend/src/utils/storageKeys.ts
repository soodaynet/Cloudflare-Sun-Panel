/**
 * 统一 localStorage / sessionStorage key 常量管理
 * 所有 key 集中定义，避免散落各处导致拼写错误和维护困难
 */

// ========== 认证相关 ==========
export const TOKEN_KEY = 'sun-panel-token'
export const USER_KEY = 'sun-panel-user'
export const VISIT_MODE_KEY = 'sun-panel-visit-mode'

// ========== 应用设置 ==========
export const LANG_KEY = 'sun-panel-lang'
export const THEME_KEY = 'sun-panel-theme'

// ========== 站点配置缓存 ==========
export const SITE_CACHE_KEY = 'sun-panel-site-config'
export const SITE_CACHE_TS_KEY = 'sun-panel-site-config-ts'

// ========== 登录页缓存 ==========
export const LOGIN_BG_CACHE_KEY = 'sun-panel-login-bg'
export const LOGIN_STYLE_CACHE_KEY = 'sun-panel-login-style'

// ========== 壁纸缓存 ==========
export const WALLPAPER_CACHE_KEY = 'sun-panel-effective-wallpaper'

// ========== 公开模式 ==========
export const PUBLIC_MODE_KEY = 'sun-panel-public-mode'

// ========== 面板状态 ==========
export const PANEL_STATE_KEY = 'sun-panel-state'

// ========== sessionStorage ==========
export const SKIP_REDIRECT_KEY = 'sun-panel-skip-redirect'