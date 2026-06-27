import type { AxiosResponse, GenericAbortSignal } from 'axios'
import request from './axios'
import { useAuthStore } from '@/store/modules/auth'
import { toast } from '@/components/ui/sonner'

export interface HttpOption {
  url: string
  data?: unknown
  method?: 'GET' | 'POST'
  signal?: GenericAbortSignal
  beforeRequest?: () => void
  afterRequest?: () => void
}

export interface Response<T = unknown> {
  data: T
  msg: string
  code: number
}

// 业务码：表示需要重新登录（移除 token 后交由调用方处理，避免重复提示）
const AUTH_CODES = [401, 1000, 1001]

function http<T = unknown>({ url, data, method = 'POST', signal, beforeRequest, afterRequest }: HttpOption) {
  const authStore = useAuthStore()

  const successHandler = (res: AxiosResponse<Response<T>>) => {
    if (res.data.code === 0) return res.data

    if (AUTH_CODES.includes(res.data.code)) {
      authStore.removeToken()
      return res.data
    }

    // 其他业务错误：toast 提示后拒绝
    if (res.data.msg) toast.error(res.data.msg)
    return Promise.reject(res.data)
  }

  const failHandler = (error: Response<Error>) => {
    afterRequest?.()
    throw new Error(error?.msg || 'Error')
  }

  beforeRequest?.()

  const params = data ?? {}

  // GET 请求不发送请求体，URL 中的 query 参数由调用方拼接
  const requestPromise = method === 'GET'
    ? request.get(url, { signal })
    : request.post(url, params, { signal })

  return requestPromise.then(successHandler, failHandler)
}

export function post<T = unknown>(opt: HttpOption): Promise<Response<T>> {
  return http<T>(opt)
}

export function get<T = unknown>(opt: HttpOption): Promise<Response<T>> {
  return http<T>({ ...opt, method: 'GET' })
}
