import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { z } from 'zod'
import { authMiddleware, adminMiddleware, publicModeMiddleware, getAuthUser } from '../middleware/auth'
import { ServiceFactory } from '../services/ServiceFactory'
import { ok, fail } from '../utils/response'
import {
  validate,
  userUpdateSchema,
  userPasswordSchema,
  userAdminCreateSchema,
  userAdminUpdateSchema,
  userDeleteSchema,
  paginationSchema,
  publicVisitUserSchema,
} from '../utils/validate'

type Variables = {
  validatedBody: unknown
}

const usersApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>()

usersApp.post('/user/getAuthInfo', publicModeMiddleware, async (c) => {
  const factory = ServiceFactory.from(c.env.DB)
  const user = getAuthUser(c)!

  const info = await factory.user.getUserInfo(user.userId)
  if (!info) return fail(c, '用户不存在')

  return ok(c, { user: info, visitMode: user.visitMode })
})

usersApp.post('/user/updateInfo', authMiddleware, validate(userUpdateSchema), async (c) => {
  const factory = ServiceFactory.from(c.env.DB)
  const user = getAuthUser(c)!
  const { name } = c.get('validatedBody') as z.infer<typeof userUpdateSchema>

  await factory.user.updateName(user.userId, name)
  return ok(c, null)
})

usersApp.post('/user/updatePassword', authMiddleware, validate(userPasswordSchema), async (c) => {
  const factory = ServiceFactory.from(c.env.DB)
  const user = getAuthUser(c)!
  const { oldPassword, newPassword } = c.get('validatedBody') as z.infer<typeof userPasswordSchema>

  await factory.user.updatePassword(user.userId, oldPassword, newPassword)

  return ok(c, null)
})

const usersAdminApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>()

usersAdminApp.post('/getList', authMiddleware, adminMiddleware, validate(paginationSchema), async (c) => {
  const factory = ServiceFactory.from(c.env.DB)
  const { page, pageSize } = c.get('validatedBody') as z.infer<typeof paginationSchema>

  const data = await factory.user.getList(page, pageSize)
  return ok(c, data)
})

usersAdminApp.post('/create', authMiddleware, adminMiddleware, validate(userAdminCreateSchema), async (c) => {
  const factory = ServiceFactory.from(c.env.DB)
  const { username, password, name, role, status } = c.get('validatedBody') as z.infer<typeof userAdminCreateSchema>

  await factory.user.adminCreate(username, password, name || username, role, status)

  return ok(c, null)
})

usersAdminApp.post('/update', authMiddleware, adminMiddleware, validate(userAdminUpdateSchema), async (c) => {
  const factory = ServiceFactory.from(c.env.DB)
  const { id, ...data } = c.get('validatedBody') as z.infer<typeof userAdminUpdateSchema>

  await factory.user.adminUpdate(id, data)

  return ok(c, null)
})

usersAdminApp.post('/deletes', authMiddleware, adminMiddleware, validate(userDeleteSchema), async (c) => {
  const factory = ServiceFactory.from(c.env.DB)
  const authUser = getAuthUser(c)!
  const { userIds } = c.get('validatedBody') as z.infer<typeof userDeleteSchema>

  await factory.user.adminDelete(userIds, authUser.userId)

  return ok(c, null)
})

usersAdminApp.post('/getPublicVisitUser', authMiddleware, adminMiddleware, async (c) => {
  const factory = ServiceFactory.from(c.env.DB)
  const data = await factory.settings.getPublicVisitUser()
  return ok(c, data)
})

usersAdminApp.post(
  '/setPublicVisitUser',
  authMiddleware,
  adminMiddleware,
  validate(publicVisitUserSchema),
  async (c) => {
    const factory = ServiceFactory.from(c.env.DB)
    const { userId } = c.get('validatedBody') as z.infer<typeof publicVisitUserSchema>

    if (userId === null || userId === undefined) {
      await factory.settings.setPublicVisitUser(null)
      return ok(c, null)
    }

    await factory.settings.setPublicVisitUser(userId)
    return ok(c, null)
  },
)

export { usersApp, usersAdminApp }
export default usersApp