import type { R2Bucket } from '@cloudflare/workers-types'

const UPLOAD_PREFIX = 'uploads'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/bmp']

export class R2Service {
  constructor(private bucket?: R2Bucket) {}

  isAvailable(): boolean {
    return !!this.bucket
  }

  /** 上传图片文件到 R2，返回媒体代理 URL */
  async uploadImage(file: File, userId: number): Promise<string> {
    if (!this.bucket) {
      throw new Error('R2 存储未配置，请在 wrangler.toml 中添加 r2_buckets 绑定')
    }

    this.validateFile(file)

    const ext = this.getExtension(file)
    const key = `${UPLOAD_PREFIX}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    await this.bucket.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { userId: String(userId), uploadedAt: new Date().toISOString() },
    })

    return `/media/${key}`
  }

  /** 从 R2 获取文件，用于 Worker 媒体代理路由 */
  async getObject(key: string) {
    if (!this.bucket) return null
    return this.bucket.get(key)
  }

  /** 根据媒体代理 URL 删除 R2 文件 */
  async deleteByUrl(url: string, userId: number): Promise<void> {
    if (!this.bucket) return
    const key = this.urlToKey(url)
    if (!key) return

    const obj = await this.bucket.head(key)
    if (!obj) return

    // 验证所有权
    const ownerId = obj.customMetadata?.userId
    if (ownerId && Number(ownerId) !== userId) {
      throw new Error('无权删除此文件')
    }

    await this.bucket.delete(key)
  }

  // ========== 辅助方法 ==========

  private validateFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`不支持的文件格式: ${file.type}，仅支持 PNG/JPEG/GIF/WebP/SVG/ICO/BMP`)
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`文件大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }
  }

  private getExtension(file: File): string {
    const nameExt = file.name.split('.').pop()?.toLowerCase()
    if (nameExt && /^[a-z0-9]+$/.test(nameExt) && nameExt.length <= 5) return nameExt

    // 从 MIME type 推断扩展名
    const mimeMap: Record<string, string> = {
      'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
      'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/x-icon': 'ico',
      'image/bmp': 'bmp',
    }
    return mimeMap[file.type] || 'png'
  }

  private urlToKey(url: string): string | null {
    const match = url.match(/\/media\/(.+)/)
    return match ? match[1] : null
  }
}