import type { MiddlewareHandler } from 'hono'
import type { ZodSchema } from 'zod'
import type { AppContext } from '../types'
import { fail } from './response'

/** 请求体校验中间件工厂：校验失败返回 400，成功时将结果写入 c.var.validatedBody */
export function validate(schema: ZodSchema): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      body = {}
    }
    const result = schema.safeParse(body)
    if (!result.success) {
      const firstError = result.error.errors[0]
      return fail(c, `${firstError.path.join('.')}: ${firstError.message}`)
    }
    c.set('validatedBody', result.data)
    await next()
  }
}
