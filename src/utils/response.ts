import type { Context } from 'hono'
import type { ApiResponse } from '../models/types'

export function ok<T>(c: Context, data: T, status = 200) {
  c.status(status as Parameters<typeof c.status>[0])
  return c.json({ code: 0, msg: 'ok', data } satisfies ApiResponse<T>)
}

export function fail(c: Context, msg: string, code = 400, status?: number) {
  c.status((status ?? (code >= 500 ? 500 : code)) as Parameters<typeof c.status>[0])
  return c.json({ code, msg, data: null } satisfies ApiResponse)
}

export function serverError(c: Context, msg = '服务器内部错误') {
  return fail(c, msg, 500, 500)
}