/** 一言请求参数 */
export interface HitokotoParams {
  /** 上游 API 地址，默认 https://v1.hitokoto.cn/ */
  apiUrl?: string
  /** 句子分类，对应 hitokoto 的 c 参数 */
  categories?: string[]
  /** 最小长度 */
  minLength?: number
  /** 最大长度 */
  maxLength?: number
}

/** 一言返回数据（与后端 HitokotoData 对齐） */
export interface HitokotoData {
  id: number
  hitokoto: string
  from: string
  from_who: string
  uuid: string
  type: string
}
