/**
 * 认证模块类型定义
 */

export interface LoginRequest {
  username: string
  password: string
}

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

export interface LoginResponse {
  token: string
  userInfo: UserInfo
}
