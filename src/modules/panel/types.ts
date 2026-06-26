import type { ItemIconRow, ItemIconGroupRow } from '../shared/types'

// 重新导出数据库行类型，方便模块内统一引用
export type { ItemIconRow, ItemIconGroupRow }

// ========== 前端驼峰对象类型 ==========

/** 图标对象（前端驼峰命名） */
export interface IconItem {
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

/** 分组对象（前端驼峰命名） */
export interface GroupItem {
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

/** 图标 icon 子对象 */
export interface IconObject {
  itemType: number
  src?: string
  text?: string
  backgroundColor?: string
}

// ========== 请求体类型 ==========

/** 图标编辑/创建请求体 */
export interface IconEditBody {
  id?: number
  icon?: IconObject
  title: string
  url: string
  description?: string
  openMethod?: number
  sort?: number
  itemIconGroupId: number
}

/** 批量添加图标请求体 */
export type IconAddMultipleBody = IconEditBody[]

/** 分组编辑/创建请求体 */
export interface GroupEditBody {
  id?: number
  icon?: string
  title: string
  description?: string
  sort?: number
  publicVisible?: number
}

/** 排序项 */
export interface SortItem {
  id: number
  sort: number
}

// ========== 响应类型 ==========

/** getAllData 响应 */
export interface AllDataResponse {
  groups: GroupItem[]
  itemsMap: Record<number, IconItem[]>
  panelConfig: Record<string, unknown>
}

/** getSiteFavicon 响应 */
export interface FaviconResponse {
  iconUrls: string[]
}
