import { post } from '@/utils/request'

export function login<T>(username: string, password: string) {
  return post<T>({ url: '/login', data: { username, password } })
}