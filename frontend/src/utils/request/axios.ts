import axios, { type AxiosResponse } from 'axios'
import { router } from '@/router'
import { useAuthStore } from '@/store/modules/auth'
import { toast } from '@/components/ui/sonner'

const service = axios.create({
  baseURL: '',
  timeout: 15000,
})

service.interceptors.request.use(
  (config) => {
    const token = useAuthStore().token
    if (token)
      config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

service.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => {
    if (response.status === 200) return response
    throw new Error(response.status.toString())
  },
  (error) => {
    const status = error.response?.status
    if (status === 401) {
      const authStore = useAuthStore()
      authStore.removeToken()
      toast.error('登录已过期，请重新登录')
      // 避免在登录页重复跳转导致循环
      if (router.currentRoute.value.name !== 'login') {
        router.push('/login')
      }
    } else if (error.code === 'ECONNABORTED' && error.message?.includes('timeout')) {
      toast.error('请求超时，请稍后重试')
      return Promise.reject(new Error('请求超时，请稍后重试'))
    } else if (!error.response) {
      // 网络错误（断网/无法连接服务器）
      toast.error('网络异常，请检查网络连接')
    } else {
      const data = error.response?.data
      const msg = (data && typeof data === 'object' && 'msg' in data ? (data as { msg: unknown }).msg : null)
        || error.message
        || '请求失败'
      toast.error(typeof msg === 'string' ? msg : '请求失败')
    }
    return Promise.reject(error)
  },
)

export default service
