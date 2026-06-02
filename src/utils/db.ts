import type { D1Database } from '@cloudflare/workers-types'

/**
 * D1 泛型查询包装器 - 查询多条记录
 */
export async function queryAll<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const result = await db.prepare(sql).bind(...params).all()
  return result.results as unknown as T[]
}

/**
 * D1 泛型查询包装器 - 查询单条记录
 */
export async function queryFirst<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  const result = await db.prepare(sql).bind(...params).first()
  return result as unknown as T | null
}