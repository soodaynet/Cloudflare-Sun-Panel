import { post } from '@/utils/request'
import type { LoginResponse } from './types'

/** 用户登录 */
export function login<T = LoginResponse>(username: string, password: string) {
  return post<T>({ url: '/login', data: { username, password } })
}
