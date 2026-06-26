import { z } from 'zod'

/** 分组编辑/创建 */
export const iconGroupSchema = z.object({
  id: z.number().int().positive().optional(),
  icon: z.string().optional(),
  title: z.string().min(1, '标题不能为空'),
  description: z.string().optional(),
  sort: z.number().int().optional(),
  publicVisible: z.number().int().min(0).max(1).optional(),
})

/** 图标编辑/创建 */
export const iconEditSchema = z.object({
  id: z.number().int().positive().optional(),
  icon: z
    .object({
      itemType: z.number().int(),
      src: z.string().optional(),
      text: z.string().optional(),
      backgroundColor: z.string().optional(),
    })
    .optional(),
  title: z.string().min(1, '标题不能为空'),
  url: z.string(),
  description: z.string().optional(),
  openMethod: z.number().int().optional(),
  sort: z.number().int().optional(),
  itemIconGroupId: z.number().int(),
})

/** 批量添加图标 */
export const iconAddMultipleSchema = z.array(
  z.object({
    icon: z
      .object({
        itemType: z.number().int(),
        src: z.string().optional(),
        text: z.string().optional(),
        backgroundColor: z.string().optional(),
      })
      .optional(),
    title: z.string(),
    url: z.string(),
    description: z.string().optional(),
    openMethod: z.number().int().optional(),
    sort: z.number().int().optional(),
    itemIconGroupId: z.number().int(),
  }),
)

/** 批量删除（ids） */
export const idsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'ids 不能为空'),
})

/** 保存排序 */
export const sortSchema = z.object({
  sortItems: z
    .array(
      z.object({
        id: z.number().int().positive(),
        sort: z.number().int(),
      }),
    )
    .min(1),
})

/** 根据分组 ID 查询图标 */
export const getListByGroupIdSchema = z.object({
  itemIconGroupId: z.number().int().optional(),
})

/** favicon 查询 */
export const faviconSchema = z.object({
  url: z.string().min(1, 'url 不能为空'),
})
