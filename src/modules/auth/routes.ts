import { Hono } from 'hono'
import type { AppContext } from '../types'
import { validate } from '../shared/validate'
import { createRateLimiter } from '../shared/middleware/rateLimiter'
import { ok } from '../shared/response'
import { loginSchema } from './validator'
import { AuthService } from './service'

export const router = new Hono<AppContext>()

const loginLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60000 })

router.post('/login', loginLimiter, validate(loginSchema), async (c) => {
  const body = c.var.validatedBody as { username: string; password: string }
  const service = new AuthService(c.env.DB)
  const result = await service.authenticate(body.username, body.password, c.env.JWT_SECRET)
  return ok(c, { token: result.token, userInfo: result.userInfo })
})
