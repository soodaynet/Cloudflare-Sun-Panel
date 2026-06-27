<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Search, ChevronDown, Check } from 'lucide-vue-next'
import type { SearchEngineConfig } from '@/modules/panel/types'
import type { ItemGroup } from '../composables/useDataLoader'
import { useSearch } from '../composables/useSearch'

const props = defineProps<{
  visibleGroups: ItemGroup[]
  searchEngineConfig: SearchEngineConfig
}>()

const emit = defineEmits<{
  (e: 'openUrl', item: Panel.ItemInfo): void
  (e: 'engineChanged', config: SearchEngineConfig): void
}>()

const { t } = useI18n()

// 本地可写配置：从 props 同步，selectEngine 时本地更新并通知父组件
const engineConfig = ref<SearchEngineConfig>({ ...props.searchEngineConfig })
watch(
  () => props.searchEngineConfig,
  (cfg) => {
    engineConfig.value = { ...cfg }
  },
)

// visibleGroups 以 computed 形式喂给 useSearch，保证响应式
const visibleGroupsRef = computed(() => props.visibleGroups)

const {
  searchQuery,
  isDropdownOpen,
  highlightIndex,
  localMatches,
  currentEngine,
  selectEngine,
  handleExternalSearch,
  handleEnter,
  moveHighlight,
  closeDropdown,
} = useSearch({
  visibleGroups: visibleGroupsRef,
  searchEngineConfig: engineConfig,
  openUrl: (item) => emit('openUrl', item),
})

// 切换搜索引擎：本地更新（selectEngine 内同步完成）+ 通知父组件刷新
function onSelectEngine(index: number) {
  selectEngine(index)
  emit('engineChanged', { ...engineConfig.value })
}

// 点击本地图标匹配项
function onSelectMatch(i: number) {
  const item = localMatches.value[i]
  if (item) emit('openUrl', item)
  closeDropdown()
}

// 点击外部搜索行
function onExternalSearch() {
  handleExternalSearch()
  closeDropdown()
}

// 点击外部关闭下拉面板（原生监听，不依赖 @vueuse/core）
const rootRef = ref<HTMLElement>()
function handleDocumentClick(e: MouseEvent) {
  const target = e.target as Node
  if (rootRef.value && !rootRef.value.contains(target)) {
    closeDropdown()
  }
}
onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})
onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div ref="rootRef" class="relative w-full max-w-2xl mx-auto">
    <!-- 搜索框主体：玻璃质感 -->
    <div
      class="flex items-center gap-1 sm:gap-2 glass-panel rounded-full pl-1.5 pr-3 py-1 border border-white/10 shadow-lg"
    >
      <!-- 引擎切换 -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="flex items-center gap-1 pl-1.5 pr-2 py-1.5 rounded-full hover:bg-white/15 text-white text-sm font-medium transition-colors flex-shrink-0"
            title="切换搜索引擎"
          >
            <img
              v-if="currentEngine.icon"
              :src="currentEngine.icon"
              class="size-4 rounded-sm object-cover"
              alt=""
              referrerpolicy="no-referrer"
              @error="($event.target as HTMLImageElement).style.display = 'none'"
            />
            <span
              v-else
              class="size-4 flex items-center justify-center rounded-sm bg-white/25 text-[10px] font-bold"
              >{{ currentEngine.name.charAt(0) }}</span
            >
            <span class="hidden sm:inline max-w-[64px] truncate">{{ currentEngine.name }}</span>
            <ChevronDown class="size-3 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="glass-panel border-white/10 text-white min-w-[150px]" align="start">
          <DropdownMenuItem
            v-for="(eng, i) in engineConfig.engines"
            :key="i"
            class="flex items-center gap-2 focus:bg-white/15 text-white"
            @select="onSelectEngine(i)"
          >
            <img
              v-if="eng.icon"
              :src="eng.icon"
              class="size-4 rounded-sm object-cover"
              alt=""
              referrerpolicy="no-referrer"
              @error="($event.target as HTMLImageElement).style.display = 'none'"
            />
            <span
              v-else
              class="size-4 flex items-center justify-center rounded-sm bg-white/25 text-[10px] font-bold"
              >{{ eng.name.charAt(0) }}</span
            >
            <span class="flex-1">{{ eng.name }}</span>
            <Check v-if="i === engineConfig.currentIndex" class="size-3 text-white/80" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div class="w-px h-5 bg-white/20 flex-shrink-0" />

      <Input
        v-model="searchQuery"
        class="flex-1 h-9 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-0 px-2 text-white placeholder:text-white/50"
        :placeholder="t('deskModule.searchBox.inputPlaceholder')"
        @focus="isDropdownOpen = true"
        @keydown.down.prevent="moveHighlight(1)"
        @keydown.up.prevent="moveHighlight(-1)"
        @keydown.enter.prevent="handleEnter"
        @keydown.esc.prevent="closeDropdown"
      />

      <Search class="size-4 text-white/60 flex-shrink-0" />
    </div>

    <!-- 搜索建议下拉面板：毛玻璃基于公告设置（--ann-blur/--ann-opacity）再 +20% -->
    <div
      v-if="isDropdownOpen && (localMatches.length > 0 || searchQuery.trim())"
      class="absolute left-0 right-0 mt-2 search-dropdown-glass rounded-xl border border-white/10 shadow-xl overflow-hidden text-white z-50"
      @wheel.stop
    >
      <!-- 本地图标区 -->
      <div class="px-3 py-1.5 text-xs text-white/50 border-b border-white/10">{{ t('deskModule.searchBox.localIcons') }}</div>
      <div v-if="localMatches.length > 0" class="max-h-64 overflow-y-auto search-scroll-hide">
        <button
          v-for="(item, i) in localMatches"
          :key="item.id || i"
          type="button"
          class="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
          :class="i === highlightIndex ? 'bg-white/15' : 'hover:bg-white/10'"
          @click="onSelectMatch(i)"
          @mouseenter="highlightIndex = i"
        >
          <div class="size-6 rounded-md overflow-hidden flex items-center justify-center flex-shrink-0">
            <img
              v-if="item.icon?.src"
              :src="item.icon.src"
              class="size-full object-cover"
              alt=""
              referrerpolicy="no-referrer"
              @error="($event.target as HTMLImageElement).style.display = 'none'"
            />
            <!-- 无 src 图标显示空占位，保持容器尺寸避免布局抖动 -->
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm truncate">{{ item.title }}</div>
            <div v-if="item.description" class="text-xs text-white/50 truncate">{{ item.description }}</div>
          </div>
        </button>
      </div>
      <div v-else class="px-3 py-3 text-sm text-white/50">{{ t('deskModule.searchBox.noMatch') }}</div>

      <!-- 外部搜索区 -->
      <button
        v-if="searchQuery.trim()"
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2.5 text-left border-t border-white/10 hover:bg-white/10 transition-colors"
        @click="onExternalSearch"
      >
        <Search class="size-4 flex-shrink-0" />
        <span class="text-sm truncate">
          {{ t('deskModule.searchBox.searchWith', { engine: currentEngine.name }) }} “<span class="font-medium">{{ searchQuery.trim() }}</span>”
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 搜索下拉面板毛玻璃：在公告设置（--ann-blur / --ann-opacity）基础上 +20% */
.search-dropdown-glass {
  background-color: rgba(255, 255, 255, calc(var(--ann-opacity, 0.15) * 1.2));
  backdrop-filter: blur(calc(var(--ann-blur, 12px) * 1.2));
  -webkit-backdrop-filter: blur(calc(var(--ann-blur, 12px) * 1.2));
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}
/* 隐藏本地图标列表滚动条，与主页面一致（可滚动但不显示） */
.search-scroll-hide {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.search-scroll-hide::-webkit-scrollbar {
  display: none;
}
</style>
