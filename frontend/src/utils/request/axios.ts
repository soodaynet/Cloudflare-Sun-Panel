import axios, { type AxiosResponse } from 'axios'
import { router } from '@/router'
import { useAuthStore } from '@/store/modules/auth'

const service = axios.create({
  baseURL: '',
  timeout: 30000,
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
    if (error.response?.status === 401) {
      const authStore = useAuthStore()
      authStore.removeToken()
      // 避免在登录页重复跳转导致循环
      if (router.currentRoute.value.name !== 'login') {
        router.push('/login')
      }
    }
    if (error.code === 'ECONNABORTED' && error.message?.includes('timeout')) {
      return Promise.reject(new Error('请求超时，请稍后重试'))
    }
    return Promise.reject(error)
  },
)

export default service