import type { UserRow, UserInfo } from '../shared/types'

// 重新导出数据库行类型，方便模块内统一引用
export type { UserRow, UserInfo }

// 用户列表单条记录（getList 映射后）
export interface UserListItem {
  id: number
  username: string
  name: string
  headImage: string
  status: number
  role: number
  mail: string
  createTime: string
  updateTime: string
}

// getList 响应
export interface UserListResponse {
  list: UserListItem[]
  total: number
  page: number
  pageSize: number
}

