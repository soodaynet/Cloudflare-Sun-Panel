import { z } from 'zod'

// POST /panel/users/getList 请求体
export const userListSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

// POST /panel/users/create 请求体
export const userCreateSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string(),
  name: z.string().max(50).optional(),
  role: z.number().int().min(1).max(2).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

// POST /panel/users/update 请求体
export const userUpdateSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().min(1).max(100).optional(),
  password: z.string().max(128).optional().default(''),
  name: z.string().max(50).optional(),
  role: z.number().int().min(1).max(2).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

// POST /panel/users/deletes 请求体
export const userDeleteSchema = z.object({
  userIds: z.array(z.number().int().positive()).min(1, 'userIds 不能为空'),
})

// POST /user/updateInfo 请求体
export const updateNameSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
})

// POST /user/updatePassword 请求体
export const updatePasswordSchema = z.object({
  oldPassword: z.string().min(1, '密码不能为空'),
  newPassword: z.string(),
})

// POST /panel/users/setPublicVisitUser 请求体
export const publicVisitUserSchema = z.object({
  userId: z.number().int().positive().nullable(),
})
