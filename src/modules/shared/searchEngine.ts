// ========== 搜索引擎配置（共享类型与默认配置） ==========

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

/** 内置默认搜索引擎配置（首次使用或配置为空时返回） */
export function getDefaultSearchEngineConfig(): SearchEngineConfig {
  return {
    engines: [
      { name: 'Google', url: 'https://www.google.com/search?q=' },
      { name: 'Bing', url: 'https://www.bing.com/search?q=' },
      { name: 'Yandex', url: 'https://yandex.com/search/?text=' },
    ],
    currentIndex: 0,
  }
}

/**
 * 规范化搜索引擎配置：
 * - 输入为空对象或缺少 engines 字段时返回默认配置
 * - engines 为空数组时返回默认配置
 * - 否则返回原配置（确保 currentIndex 在合法范围内）
 */
export function normalizeSearchEngineConfig(raw: unknown): SearchEngineConfig {
  const def = getDefaultSearchEngineConfig()
  if (!raw || typeof raw !== 'object') return def
  const cfg = raw as Partial<SearchEngineConfig>
  if (!Array.isArray(cfg.engines) || cfg.engines.length === 0) return def
  const currentIndex =
    typeof cfg.currentIndex === 'number' &&
    cfg.currentIndex >= 0 &&
    cfg.currentIndex < cfg.engines.length
      ? cfg.currentIndex
      : 0
  return { engines: cfg.engines, currentIndex }
}
