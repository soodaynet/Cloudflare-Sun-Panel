import { get, post } from '@/utils/request'
import type { AboutResponse, SiteSettings } from './types'

// ========== 系统设置 API ==========
/**
 * 获取站点配置（公开接口，GET 请求）
 * 登录页调用时需跳过 CDN/浏览器缓存，确保获取最新站点信息
 * （site_title/favicon_url/login_bg_image 等），避免公开访问开关
 * 变更后短时间内仍命中旧缓存导致站点信息无法正常显示。
 * GET 请求免 CSRF 校验，不会被 WAF 误判；加 _t 时间戳绕过 HTTP 缓存。
 */
export function getAbout<T = AboutResponse>() {
  return get<T>({ url: `/about?_t=${Date.now()}` })
}

// ========== 站点全局设置 API ==========
export function saveSiteSettings<T>(settings: SiteSettings) {
  return post<T>({ url: '/system/settings/saveAll', data: settings })
}

// ========== 聚合初始化 API ==========
export function getInit<T = AboutResponse>() {
  return post<T>({ url: '/init' })
}
