import type { HitokotoParams, HitokotoData } from './types'

/** 默认上游一言 API */
const DEFAULT_API_URL = 'https://v1.hitokoto.cn/'
/** 请求超时（毫秒） */
const FETCH_TIMEOUT = 3000

/**
 * 直连上游一言 API 获取一条随机一言。
 * 不走后端代理，浏览器直连（hitokoto.cn 已发送 CORS 头）。
 * 返回裸 HitokotoData（与上游响应形状一致，不再包装为 { code, msg, data }）。
 */
export async function getHitokoto(params?: HitokotoParams): Promise<HitokotoData> {
  const base = params?.apiUrl || DEFAULT_API_URL
  const url = new URL(base)
  // 分类参数可多次出现
  if (params?.categories && params.categories.length > 0) {
    for (const c of params.categories) url.searchParams.append('c', c)
  }
  if (params?.minLength != null) url.searchParams.set('min_length', String(params.minLength))
  if (params?.maxLength != null) url.searchParams.set('max_length', String(params.maxLength))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const res = await fetch(url.toString(), { method: 'GET', signal: controller.signal })
    if (!res.ok) throw new Error(`一言请求失败: ${res.status}`)
    const data = (await res.json()) as HitokotoData
    return data
  } finally {
    clearTimeout(timer)
  }
}
