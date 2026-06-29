import type { SearchEngineConfig } from '../shared/searchEngine'

// ========== init 接口响应类型 ==========

/** 认证用户信息（精简版，用于 init 响应） */
export interface InitAuthUser {
  id: number
  username: string
  name: string
  role: number
}

/** 认证信息 */
export interface InitAuthInfo {
  user: InitAuthUser | null
  visitMode: number // 0=登录, 1=公开/访客
}

/** 图标（前端驼峰命名） */
export interface InitIcon {
  id: number
  icon: unknown
  title: string
  url: string
  description: string
  openMethod: number
  sort: number
  itemIconGroupId: number
  userId: number
  createTime: string
  updateTime: string
}

/** 图标分组（前端驼峰命名） */
export interface InitGroup {
  id: number
  icon: string
  title: string
  description: string
  sort: number
  publicVisible: number
  userId: number
  createTime: string
  updateTime: string
}

/** 面板数据 */
export interface InitPanelData {
  groups: InitGroup[]
  itemsMap: Record<number, InitIcon[]>
  panelConfig: Record<string, unknown>
}

/** init 接口聚合响应 */
export interface InitResponse extends InitPanelData {
  about: Record<string, string>
  authInfo: InitAuthInfo
  searchEngine: SearchEngineConfig
}
