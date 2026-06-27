import { z } from 'zod'

// 用户配置校验 schema（panel 与 searchEngine 均为任意键值对象）
export const userConfigSchema = z.object({
  panel: z.record(z.unknown()).optional(),
  searchEngine: z.record(z.unknown()).optional(),
})
