import { post } from '@/utils/request'
import type { SearchEngineConfig } from './types'

/**
 * 保存搜索引擎配置
 * 内部调用 /panel/userConfig/set，参数为 { searchEngine: config }
 */
export function saveSearchEngineConfig(config: SearchEngineConfig) {
  return post({ url: '/panel/userConfig/set', data: { searchEngine: config } })
}
