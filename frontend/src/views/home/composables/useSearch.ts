import { ref, computed, watch, type Ref } from 'vue'
import type { SearchEngineConfig } from '@/modules'
import type { ItemGroup } from './useDataLoader'

/** 本地匹配结果最大数量 */
const MAX_LOCAL_MATCHES = 8
/** 输入防抖延时（ms），避免每次按键触发遍历 */
const DEBOUNCE_MS = 200

/**
 * 前端内置默认搜索引擎配置（与后端默认一致）。
 * 仅作初始占位，/init 返回后会被真实配置覆盖。
 */
export function getDefaultSearchEngineConfig(): SearchEngineConfig {
  return {
    engines: [
      { name: 'Google', url: 'https://www.google.com/search?q=' },
      { name: 'Bing', url: 'https://www.bing.com/search?q=' },
      { name: 'Yandex', url: 'https://www.yandex.com/search/?text=' },
    ],
    currentIndex: 0,
  }
}

/**
 * 首页搜索逻辑：本地图标匹配（防抖）+ 外部搜索引擎跳转。
 */
export function useSearch(options: {
  visibleGroups: Ref<ItemGroup[]>
  searchEngineConfig: Ref<SearchEngineConfig>
  openUrl: (item: Panel.ItemInfo) => void
}) {
  const { visibleGroups, searchEngineConfig, openUrl } = options

  // 输入值
  const searchQuery = ref('')
  // 下拉面板是否展开
  const isDropdownOpen = ref(false)
  // 当前高亮的本地图标索引，-1 表示无高亮
  const highlightIndex = ref(-1)
  // 会话级搜索引擎覆盖索引：仅本次会话生效，不持久化；null 表示沿用默认 currentIndex
  const sessionEngineIndex = ref<number | null>(null)

  // 防抖：输入 200ms 后才更新过滤依据
  const debouncedQuery = ref('')
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  watch(searchQuery, (val) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debouncedQuery.value = val
    }, DEBOUNCE_MS)
  })

  // 本地图标匹配：基于防抖后的关键词过滤，最多取 8 项
  const localMatches = computed<Panel.ItemInfo[]>(() => {
    const q = debouncedQuery.value.trim().toLowerCase()
    if (!q) return []
    const result: Panel.ItemInfo[] = []
    for (const group of visibleGroups.value) {
      for (const item of group.items || []) {
        const title = (item.title || '').toLowerCase()
        const desc = (item.description || '').toLowerCase()
        const url = (item.url || '').toLowerCase()
        if (title.includes(q) || desc.includes(q) || url.includes(q)) {
          result.push(item)
          if (result.length >= MAX_LOCAL_MATCHES) return result
        }
      }
    }
    return result
  })

  // 当前生效的引擎索引：会话覆盖优先，越界回退到 currentIndex
  const activeEngineIndex = computed(() => {
    const cfg = searchEngineConfig.value
    const session = sessionEngineIndex.value
    // 会话覆盖越界保护：若 session 超出 engines 范围，回退到 currentIndex
    if (session !== null && session >= 0 && session < cfg.engines.length) {
      return session
    }
    return cfg.currentIndex
  })

  // 当前选中的搜索引擎
  const currentEngine = computed(() => {
    const cfg = searchEngineConfig.value
    return cfg.engines[activeEngineIndex.value] || cfg.engines[0]
  })

  // 切换搜索引擎：仅修改本次会话的当前引擎，不持久化、不改变默认
  function selectEngine(index: number) {
    const cfg = searchEngineConfig.value
    if (index < 0 || index >= cfg.engines.length) return
    sessionEngineIndex.value = index
  }

  // 触发外部搜索：用当前引擎在新标签页打开搜索结果
  function handleExternalSearch() {
    const query = searchQuery.value.trim()
    if (!query) return
    window.open(currentEngine.value.url + encodeURIComponent(query), '_blank')
  }

  // 回车：优先打开高亮的本地图标，否则走外部搜索，随后清空并关闭
  function handleEnter() {
    if (highlightIndex.value >= 0 && highlightIndex.value < localMatches.value.length) {
      openUrl(localMatches.value[highlightIndex.value])
    } else {
      handleExternalSearch()
    }
    searchQuery.value = ''
    closeDropdown()
  }

  // 上下键高亮：在 -1 到 localMatches.length 之间循环
  function moveHighlight(direction: 1 | -1) {
    const len = localMatches.value.length
    if (len === 0) {
      highlightIndex.value = -1
      return
    }
    let next = highlightIndex.value + direction
    if (next < -1) next = len - 1
    if (next >= len) next = -1
    highlightIndex.value = next
  }

  function closeDropdown() {
    isDropdownOpen.value = false
    highlightIndex.value = -1
  }

  return {
    searchQuery,
    isDropdownOpen,
    highlightIndex,
    localMatches,
    currentEngine,
    activeEngineIndex,
    selectEngine,
    handleExternalSearch,
    handleEnter,
    moveHighlight,
    closeDropdown,
  }
}
