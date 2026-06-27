/**
 * 请求缓存与去重工具
 * - 去重：同一请求进行中时，后续调用共享同一个 Promise
 * - 缓存：请求完成后结果缓存指定时间，过期后自动失效
 */

interface CacheEntry<T> {
  promise: Promise<T>
  settled: boolean
  data?: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<unknown>>()

/**
 * /init 请求缓存 key 工厂：按用户隔离
 * FE-5（登录页预取）可 import 此函数写入同一 key，实现跨页面缓存共享
 */
export const initCacheKey = (userId: string | number | undefined): string => `init:${userId || 'guest'}`

/** 请求去重 + 内存缓存：同一 key 在 maxAge 秒内只发一次请求 */
export function cachedRequest<T>(key: string, requestFn: () => Promise<T>, maxAge: number = 60): Promise<T> {
  const now = Date.now()
  const existing = cache.get(key) as CacheEntry<T> | undefined

  // 缓存命中：已完成的请求且未过期
  if (existing && existing.settled && now - existing.timestamp < maxAge * 1000) {
    return Promise.resolve(existing.data!)
  }

  // 去重：请求正在进行中，共享同一个 Promise
  if (existing && !existing.settled) {
    return existing.promise
  }

  // 新请求
  const entry: CacheEntry<T> = {
    promise: requestFn()
      .then((data) => {
        entry.settled = true
        entry.data = data
        entry.timestamp = Date.now()
        return data
      })
      .catch((err) => {
        cache.delete(key)
        throw err
      }),
    settled: false,
    timestamp: now,
  }

  cache.set(key, entry)
  return entry.promise
}

/** 清除指定 key 的缓存 */
export function invalidateCache(key: string): void {
  cache.delete(key)
}

/** 清除所有匹配前缀的缓存 */
export function invalidateCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}
