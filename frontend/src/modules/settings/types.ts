/**
 * 设置模块类型定义
 */

import type { SearchEngineConfig } from '@/modules/search/types'

/** 站点全局设置（键值对集合） */
export type SiteSettings = Record<string, string>

/** 关于页/初始化返回的站点配置 */
export interface AboutResponse {
  site_title?: string
  login_bg_image?: string
  login_blur?: number
  login_mask_opacity?: number
  footer_html?: string
  logo_text?: string
  logo_image_src?: string
  favicon_url?: string
  panel_public_user_id?: string
  default_guest_mode?: string
  /** 搜索引擎配置（仅 /init 返回，/about 不返回） */
  searchEngine?: SearchEngineConfig
  [key: string]: string | number | undefined | SearchEngineConfig
}
