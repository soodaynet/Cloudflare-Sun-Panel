import { Hono } from 'hono'
import type { R2Bucket, D1Database } from '@cloudflare/workers-types'
import { authMiddleware, type AuthUser } from '../middleware/auth'
import { R2Service } from '../services/R2Service'
import { ok, fail } from '../utils/response'

const uploadApp = new Hono<{ Bindings: { DB: D1Database; MEDIA_BUCKET?: R2Bucket }; Variables: { authUser: AuthUser } }>()

/**
 * 上传图片到 R2
 * POST /api/upload/image
 * Content-Type: multipart/form-data
 * Body: file=<image>
 */
uploadApp.post('/image', authMiddleware, async (c) => {
  const r2 = new R2Service(c.env.MEDIA_BUCKET)

  if (!r2.isAvailable()) {
    return fail(c, 'R2 存储未配置，请在 Cloudflare 控制台创建 R2 存储桶并在 wrangler.toml 中添加绑定', 501)
  }

  let file: File | null = null
  try {
    const body = await c.req.parseBody({ all: true })
    const files = Object.values(body).filter(v => v instanceof File) as File[]
    file = files[0] ?? null
  } catch {
    return fail(c, '无法解析上传文件', 400)
  }

  if (!file) {
    return fail(c, '未上传文件，请使用 file 字段上传图片', 400)
  }

  try {
    const user = c.get('authUser')
    const url = await r2.uploadImage(file, user!.userId)
    return ok(c, { url })
  } catch (e: unknown) {
    return fail(c, (e as Error).message || '上传失败', 400)
  }
})

export default uploadApp