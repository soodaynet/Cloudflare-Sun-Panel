import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { z } from 'zod'
import { UserService } from '../services/UserService'
import { ok, fail } from '../utils/response'
import { validate, loginSchema, registerSchema } from '../utils/validate'
import { rateLimit } from '../middleware/rateLimit'
import { signToken } from '../utils/jwt'

type Variables = { validatedBody: unknown }

const authApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>()

authApp.use('/login', rateLimit(5, 60 * 1000))
authApp.use('/register', rateLimit(3, 60 * 1000))

authApp.post('/login', validate(loginSchema), async (c) => {
  const { username, password } = c.get('validatedBody') as z.infer<typeof loginSchema>
  const svc = new UserService(c.env.DB)

  const result = await svc.authenticate(username, password)
  if ('error' in result) return fail(c, result.error as string)

  return ok(c, result)
})

authApp.post('/register', validate(registerSchema), async (c) => {
  const { username, password, name, mail } = c.get('validatedBody') as z.infer<typeof registerSchema>
  const svc = new UserService(c.env.DB)

  const existing = await svc.findByUsername(username)
  if (existing) return fail(c, '该用户名已被注册')

  const userId = await svc.createUser(username, password, name || username)
  const token = await signToken({ userId, username, role: 2 })

  return ok(c, {
    token,
    userInfo: {
      id: userId, username, name: name || username,
      headImage: '', status: 1, role: 2,
      mail: mail || '', created_at: new Date().toISOString(),
    },
  })
})

export default authApp