import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import { UserService } from '../services/UserService'
import { validate, loginSchema, registerSchema } from '../utils/validate'
import { ok } from '../utils/response'
import { createRateLimiter } from '../middleware/rateLimiter'

type Variables = {
  validatedBody: unknown
}

const authApp = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET?: string }; Variables: Variables }>()

const loginLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60000 })

/**
 * 登录
 * POST /api/login
 */
authApp.post('/login', loginLimiter, validate(loginSchema), async (c) => {
  const body = c.get('validatedBody') as { username: string; password: string }
  const userService = new UserService(c.env.DB)
  const jwtSecret = c.env.JWT_SECRET

  const result = await userService.authenticate(body.username, body.password, jwtSecret)

  return ok(c, { token: result.token, userInfo: result.userInfo })
})

/**
 * 注册
 * POST /api/register
 */
authApp.post('/register', validate(registerSchema), async (c) => {
  const body = c.get('validatedBody') as { username: string; password: string; name?: string; mail?: string }
  const userService = new UserService(c.env.DB)
  const jwtSecret = c.env.JWT_SECRET

  const result = await userService.register(body.username, body.password, body.name, body.mail, jwtSecret)

  return ok(c, { token: result.token, userInfo: result.userInfo })
})

export default authApp