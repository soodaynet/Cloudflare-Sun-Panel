/**
 * 用户模块类型定义
 */

export interface UserInfo {
  id: number
  username: string
  name: string
  headImage: string
  status: number
  role: number
  mail: string
  created_at: string
}

/** 用户管理表单数据（创建/编辑） */
export interface UserFormData {
  username: string
  name: string
  role: number
  status: number
  password?: string
  id?: number
}

/** 用户配置（面板 + 搜索引擎），两者均可独立保存 */
export interface UserConfig {
  panel?: Record<string, unknown>
  searchEngine?: Record<string, unknown>
}

export interface UserListResponse {
  list: UserInfo[]
  total: number
  page: number
  pageSize: number
}

/**
 * 公开访问用户信息
 *
 * 后端 SettingsService.getPublicVisitUser() 返回完整用户对象或 null
 * （未配置公开访问用户、或配置的用户已被删除时返回 null）。
 */
export type PublicVisitUserResponse = UserInfo | null
