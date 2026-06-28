/**
 * 搜索模块类型定义
 */

/** 搜索引擎 */
export interface SearchEngine {
  name: string
  url: string
  icon?: string
}

/** 搜索引擎配置 */
export interface SearchEngineConfig {
  engines: SearchEngine[]
  currentIndex: number
}
