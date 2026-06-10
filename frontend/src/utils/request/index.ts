import type { AxiosResponse, GenericAbortSignal } from 'axios'
import request from './axios'
import { useAuthStore } from '@/store/modules/auth'

export interface HttpOption {
  url: string
  data?: unknown
  signal?: GenericAbortSignal
  beforeRequest?: () => void
  afterRequest?: () => void
}

export interface Response<T = unknown> {
  data: T
  msg: string
  code: number
}

function http<T = unknown>({ url, data, signal, beforeRequest, afterRequest }: HttpOption) {
  const authStore = useAuthStore()

  const successHandler = (res: AxiosResponse<Response<T>>) => {
    if (res.data.code === 0) return res.data

    if (res.data.code === 401 || res.data.code === 1001 || res.data.code === 1000) {
      authStore.removeToken()
      return res.data
    }

    return Promise.reject(res.data)
  }

  const failHandler = (error: Response<Error>) => {
    afterRequest?.()
    throw new Error(error?.msg || 'Error')
  }

  beforeRequest?.()

  const params = data ?? {}

  return request.post(url, params, { signal }).then(successHandler, failHandler)
}

export function post<T = unknown>(opt: HttpOption): Promise<Response<T>> {
  return http<T>(opt)
}