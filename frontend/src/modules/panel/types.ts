/**
 * 面板模块类型定义
 */

export type PanelConfigStyleEnum = 'text' | 'image' | 'detail'

export interface SortItemRequest {
  id: number
  sort: number
}

export interface ItemIcon {
  itemType: number
  src?: string
  text?: string
  backgroundColor?: string
}

export interface ItemIconGroup {
  id?: number
  icon?: string
  title: string
  description?: string
  sort?: number
  publicVisible?: number
  userId?: number
  createTime?: string
  updateTime?: string
}

export interface ItemInfo {
  id?: number
  icon: ItemIcon | null
  title: string
  url: string
  sort?: number
  description?: string
  openMethod: number
  itemIconGroupId?: number
  userId?: number
  createTime?: string
  updateTime?: string
}

export interface ItemIconSortRequest {
  sortItems: SortItemRequest[]
  itemIconGroupId: number
}

export interface PanelConfig {
  backgroundImageSrc?: string
  backgroundBlur?: number
  backgroundMaskNumber?: number
  iconStyle?: PanelConfigStyleEnum
  iconTextColor?: string
  iconTextInfoHideDescription?: boolean
  iconTextIconHideTitle?: boolean
  logoText?: string
  logoImageSrc?: string
  logoPositionTop?: number
  logoPositionLeft?: number
  logoSize?: number
  clockShowSecond?: boolean
  clockColor?: string
  searchBoxShow?: boolean
  searchBoxSearchIcon?: boolean
  marginTop?: number
  marginBottom?: number
  maxWidth?: number
  maxWidthUnit?: string
  marginX?: number
  footerHtml?: string
  announcement?: string
  announcementDuration?: number
  announcementBlur?: number
  announcementMaskOpacity?: number
  systemMonitorShow?: boolean
  systemMonitorShowTitle?: boolean
  systemMonitorPublicVisitModeShow?: boolean
}

/** getAllData 一次性返回的聚合数据 */
export interface AllDataResponse {
  groups: ItemIconGroup[]
  itemsMap: Record<number, ItemInfo[]>
  panelConfig: PanelConfig
}

/** getSiteFavicon 返回结构 */
export interface SiteFaviconResponse {
  favicon: string
  iconUrls?: string[]
  title?: string
  description?: string
  siteName?: string
}

/** 搜索引擎 */
export interface SearchEngine {
  name: string
  url: string
  icon?: string
}

/** 搜索引擎配置 */
export interface SearchEngineConfig {
  engines: SearchEngine[]
  currentIndex: number
}
