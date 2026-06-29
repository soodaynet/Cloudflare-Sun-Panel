// ========== 数据库行类型 ==========

// user_configs 表行
export interface UserConfigRow {
  user_id: number
  panel_json: string
  search_engine_json: string
  created_at: string
  updated_at: string
}

// ========== API 请求/响应类型 ==========

// 用户配置数据（前端驼峰命名）
export interface UserConfigData {
  panel: Record<string, unknown>
  searchEngine: Record<string, unknown>
}

// POST /set 请求体
export interface UserConfigSetBody {
  panel?: Record<string, unknown>
  searchEngine?: Record<string, unknown>
}
