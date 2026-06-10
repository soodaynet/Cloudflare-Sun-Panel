import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { z } from 'zod'
import { authMiddleware, publicModeMiddleware, getAuthUser } from '../middleware/auth'
import { UserService } from '../services/UserService'
import { ok, fail } from '../utils/response'
import {
  validate,
  userUpdateSchema,
  userPasswordSchema,
} from '../utils/validate'

type Variables = {
  validatedBody: unknown
}

const usersApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>()

usersApp.post('/user/getAuthInfo', publicModeMiddleware, async (c) => {
  const svc = new UserService(c.env.DB)
  const user = getAuthUser(c)!

  const info = await svc.getUserInfo(user.userId)
  if (!info) return fail(c, '用户不存在')

  return ok(c, { user: info, visitMode: user.visitMode })
})

usersApp.post('/user/updateInfo', authMiddleware, validate(userUpdateSchema), async (c) => {
  const svc = new UserService(c.env.DB)
  const user = getAuthUser(c)!
  const { name } = c.get('validatedBody') as z.infer<typeof userUpdateSchema>

  await svc.updateName(user.userId, name)
  return ok(c, null)
})

usersApp.post('/user/updatePassword', authMiddleware, validate(userPasswordSchema), async (c) => {
  const svc = new UserService(c.env.DB)
  const user = getAuthUser(c)!
  const { oldPassword, newPassword } = c.get('validatedBody') as z.infer<typeof userPasswordSchema>

  await svc.updatePassword(user.userId, oldPassword, newPassword)

  return ok(c, null)
})

export default usersApp