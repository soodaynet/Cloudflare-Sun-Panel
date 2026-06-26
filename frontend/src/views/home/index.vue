<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { ArrowUp } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { useAuthStore, usePanelState } from '@/store'
import { deleteItems, saveItemSort } from '@/modules'
import { useAnnouncement } from './composables/useAnnouncement'
import { useItemEditor } from './composables/useItemEditor'
import { useSiteConfig, SITE_CACHE_KEY } from './composables/useSiteConfig'
import { useWallpaper } from './composables/useWallpaper'
import { useDataLoader, type ItemGroup } from './composables/useDataLoader'
// 首屏必须同步加载的
import HomeSidebar from './components/HomeSidebar.vue'
import HomeLogo from './components/HomeLogo.vue'
import HomeWallpaper from './components/HomeWallpaper.vue'
import HomeItemCard from './components/HomeItemCard.vue'

// 懒加载的非首屏组件
const HomeAppStarter = defineAsyncComponent(() => import('./components/HomeAppStarter.vue'))
const HomeEditIconModal = defineAsyncComponent(() => import('./components/HomeEditIconModal.vue'))
const HomeIframeModal = defineAsyncComponent(() => import('./components/HomeIframeModal.vue'))
import { useFavicon } from './composables/useFavicon'

const authStore = useAuthStore()
const panelState = usePanelState()

// 首屏预加载策略：前 3 个分组的前 12 个图标使用 eager 加载
const EAGER_COUNT_PER_GROUP = 12
const MAX_EAGER_GROUPS = 3
const eagerKeySet = new Set<string>()

function buildEagerSet() {
  eagerKeySet.clear()
  for (let gi = 0; gi < MAX_EAGER_GROUPS; gi++) {
    for (let ii = 0; ii < EAGER_COUNT_PER_GROUP; ii++) {
      eagerKeySet.add(`${gi}-${ii}`)
    }
  }
}

// 返回顶部按钮显示状态
const showBackTop = ref(false)
// 滚动百分比（0-100）
const scrollPercent = ref(0)
// 滚动节流：rAF 包装，每帧最多执行一次
let scrollRafId: number | null = null
function handleScroll() {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight
    showBackTop.value = scrollTop > 300
    // 仅整数值变化时更新，减少响应式触发
    const percent = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0
    if (percent !== scrollPercent.value) {
      scrollPercent.value = percent
    }
    scrollRafId = null
  })
}
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ---------- Composables ----------

const { siteConfig, siteConfigLoaded, handleSiteConfigUpdate, updateFavicon } = useSiteConfig()
const { effectiveBackgroundImage, syncEffectiveWallpaper, preloadIconImages, markDataReady } = useWallpaper(
  siteConfig,
  panelState,
  () => authStore.isVisitMode,
)

function applySiteConfigToDom(config: Panel.SiteConfig) {
  localStorage.setItem(SITE_CACHE_KEY, JSON.stringify(config))
  siteConfigLoaded.value = true
  if (config.site_title) {
    document.title = config.site_title
  }
  updateFavicon(config.favicon_url || '')
}

const { groups, visibleGroups, loadData, loadInitData, refreshAll } = useDataLoader({
  authStore,
  panelState,
  siteConfig,
  syncWallpaper: syncEffectiveWallpaper,
  preloadIcons: preloadIconImages,
  onSiteConfigUpdated: applySiteConfigToDom,
  markDataReady,
})

const { announcementVisible, announcementText, startAnnouncementTimer, dismissAnnouncement } = useAnnouncement()
const { editModalShow, editingItem, openAddItem, openEditItem, handleSaveItem } = useItemEditor(loadData)

// 分组编辑模式（控制每个分组内是否可排序/编辑/删除）
const editModeGroupId = ref<number | null>(null)

function toggleEditMode(groupId: number) {
  editModeGroupId.value = editModeGroupId.value === groupId ? null : groupId
}

// AppStarter
const starterShow = ref(false)

// 弹窗（iframe 内嵌）
const windowShow = ref(false)
const windowSrc = ref('')
const windowTitle = ref('')
const windowIframeIsLoad = ref(false)

const scrollContainerRef = ref<HTMLElement>()

const containerStyle = computed(() => {
  const config = panelState.panelConfig
  return {
    maxWidth: `${config.maxWidth || 1200}${config.maxWidthUnit || 'px'}`,
    marginTop: `${config.marginTop || 40}px`,
    marginBottom: `${config.marginBottom || 40}px`,
    paddingLeft: `${config.marginX || 20}px`,
    paddingRight: `${config.marginX || 20}px`,
  }
})

const glassVars = computed(() => ({
  '--ann-blur': `${panelState.panelConfig.announcementBlur ?? 12}px`,
  '--ann-opacity': panelState.panelConfig.announcementMaskOpacity ?? 0.15,
}))

function syncGlassVars() {
  const blur = panelState.panelConfig.announcementBlur ?? 12
  const opacity = panelState.panelConfig.announcementMaskOpacity ?? 0.15
  document.documentElement.style.setProperty('--ann-blur', `${blur}px`)
  document.documentElement.style.setProperty('--ann-opacity', `${opacity}`)
}

watch(
  () => [panelState.panelConfig.announcementBlur, panelState.panelConfig.announcementMaskOpacity],
  () => syncGlassVars(),
)

function openUrl(item: Panel.ItemInfo) {
  let url = item.url
  switch (item.openMethod) {
    case 1:
      window.location.href = url
      break
    case 2:
      window.open(url, '_blank')
      break
    case 3:
      windowShow.value = true
      windowSrc.value = url
      windowTitle.value = item.title || url
      windowIframeIsLoad.value = true
      break
    default:
      window.location.href = url
  }
}

function handleWindowIframeLoaded() {
  windowIframeIsLoad.value = false
}

// ====== favicon ======
const { getIconLoading, iconCandidates, getIconByUrl, selectIcon } = useFavicon()

async function handleDeleteItem(item: Panel.ItemInfo) {
  if (!item.id) return
  try {
    const res = await deleteItems([item.id])
    if (res.code === 0) {
      toast.success('删除成功')
      // 直接从本地 groups 中移除该 item，不发起额外请求
      for (const group of groups.value) {
        if (group.items) {
          const idx = group.items.findIndex((i: Panel.ItemInfo) => i.id === item.id)
          if (idx !== -1) {
            group.items.splice(idx, 1)
            break
          }
        }
      }
    } else toast.error(res.msg || '删除失败')
  } catch {
    toast.error('网络错误')
  }
}

// ====== 排序 ======
async function saveItemSortOrder(group: ItemGroup) {
  const sortItems = (group.items || []).filter((g) => g.id).map((item, i) => ({ id: item.id!, sort: i }))
  try {
    const res = await saveItemSort({ sortItems, itemIconGroupId: group.id! })
    if (res.code === 0) {
      toast.success('排序已保存')
      // 排序结果已在拖拽时本地更新，无需重新请求
    } else toast.error(res.msg || '排序保存失败')
  } catch {
    toast.error('网络错误')
  }
}

// ====== AppStarter 回调 ======
function handleStarterSaved() {
  refreshAll()
}
function handleGroupSaved() {
  refreshAll()
}

onMounted(async () => {
  syncGlassVars()
  buildEagerSet()
  // 一次 /init 调用替代 3 次 API 请求，显著减少首次加载的网络往返
  loadInitData()
  startAnnouncementTimer()
  window.addEventListener('scroll', handleScroll, { passive: true })
})

// 离开首页时清理侧边栏可能遗留的 overflow 锁定
onUnmounted(() => {
  document.documentElement.style.overflow = ''
  window.removeEventListener('scroll', handleScroll)
  if (scrollRafId !== null) cancelAnimationFrame(scrollRafId)
})

// 侧边栏展开时锁定/恢复页面滚动
function handleSidebarExpanded(val: boolean) {
  if (typeof document !== 'undefined') {
    document.documentElement.style.overflow = val ? 'hidden' : ''
  }
}

// 监听登录状态变化（退出登录 → 清缓存 + 重新加载 auth + 数据）
watch(() => authStore.isAuthenticated, () => {
  refreshAll()
})

// 退出登录时立刻清理所有登录态 UI 状态（编辑模式、设置面板等）
watch(() => authStore.isLoggedIn, (val) => {
  if (!val) {
    editModeGroupId.value = null
    starterShow.value = false
  }
})
</script>

<template>
  <HomeWallpaper
    :background-image-src="effectiveBackgroundImage"
    :background-blur="panelState.panelConfig.backgroundBlur || 0"
    :background-mask-number="panelState.panelConfig.backgroundMaskNumber ?? 0.3"
  />

  <div
    ref="scrollContainerRef"
    class="min-h-screen relative transition-all flex flex-col scroll-container pt-14 sm:pt-0"
    :class="{ 'bg-gray-900': !effectiveBackgroundImage }"
    :style="glassVars"
  >
    <!-- 侧边栏分组导航 -->
    <HomeSidebar :groups="visibleGroups" @open-settings="starterShow = true" @sidebar-expanded="handleSidebarExpanded" />

    <!-- Logo + 访客标识（独立固定定位组件） -->
    <HomeLogo />

    <!-- 公告 -->
    <Transition name="announce-fade">
      <div
        v-if="announcementVisible && announcementText"
        class="fixed top-4 right-2 sm:right-4 max-w-[90vw] sm:max-w-sm z-30 pointer-events-none"
      >
        <div
          class="flex items-start gap-3 max-w-sm pointer-events-auto glass-panel text-white px-4 py-3 rounded-xl shadow-lg text-sm leading-relaxed border border-white/10"
        >
          <span class="flex-1">{{ announcementText }}</span>
          <button
            @click="dismissAnnouncement"
            class="text-white/60 hover:text-white flex-shrink-0 text-lg leading-none"
          >
            &times;
          </button>
        </div>
      </div>
    </Transition>

    <!-- 主内容区域 -->
    <div class="relative z-10 mx-auto flex-1 w-full" :style="containerStyle">

      <!-- 内容区域（始终渲染，loading 结束后图标自动填充） -->
      <div>
        <template v-for="(group, gi) in visibleGroups" :key="group.id || gi">
          <div class="mb-2 group-section" :class="`item-group-index-${gi}`">
            <div class="flex items-center gap-2 mb-2 px-2 group-title-row">
              <h3 class="text-white text-base sm:text-lg font-medium">{{ group.title }}</h3>
              <div class="group-title-btns opacity-0 transition-opacity duration-200 flex items-center gap-1">
                <Button
                  v-if="!authStore.isVisitMode"
                  size="icon"
                  :variant="editModeGroupId === group.id ? 'secondary' : 'ghost'"
                  :title="editModeGroupId === group.id ? '完成' : '编辑'"
                  class="h-7 w-7 text-white hover:bg-white/20"
                  @click="toggleEditMode(group.id!)"
                >
                  {{ editModeGroupId === group.id ? '✓' : '✎' }}
                </Button>
                <Button
                  v-if="!authStore.isVisitMode"
                  size="icon"
                  variant="ghost"
                  title="添加"
                  class="h-7 w-7 text-white hover:bg-white/20"
                  @click="openAddItem(group.id!)"
                >+</Button>
              </div>
            </div>
            <VueDraggable
              v-if="editModeGroupId === group.id"
              v-model="group.items"
              :animation="200"
              class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 sm:gap-3"
              @end="saveItemSortOrder(group)"
            >
              <HomeItemCard
                v-for="(item, ii) in group.items"
                :key="item.id || ii"
                :item="item"
                :editable="true"
                :is-edit-mode="true"
                :eager-load="eagerKeySet.has(`${gi}-${ii}`)"
                @click="openUrl"
                @edit="openEditItem"
                @delete="handleDeleteItem"
              />
            </VueDraggable>
            <div v-else class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 sm:gap-3">
              <div
                v-for="(item, ii) in group.items"
                :key="item.id || ii"
                :title="item.description || undefined"
              >
                <HomeItemCard
                  :item="item"
                  :editable="false"
                  :is-edit-mode="false"
                  :eager-load="eagerKeySet.has(`${gi}-${ii}`)"
                  @click="openUrl"
                />
              </div>
            </div>
            <div
              v-if="!group.items || group.items.length === 0"
              class="text-center text-gray-400 text-xs sm:text-sm py-2 sm:py-3"
            >
              {{ authStore.isVisitMode ? '暂无图标' : '暂无图标，点击" + 添加"创建' }}
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 自定义页脚 -->
    <div
      v-if="panelState.panelConfig.footerHtml"
      class="sticky bottom-0 z-20 text-center py-4 text-gray-400 text-sm"
    >
      {{ panelState.panelConfig.footerHtml }}
    </div>

    <!-- 返回顶部 -->
    <Transition name="loader-fade">
      <button
        v-if="showBackTop"
        type="button"
        :title="`返回顶部 (${scrollPercent}%)`"
        class="back-top-btn fixed right-4 bottom-4 z-40 flex flex-col items-center justify-center rounded-full size-12 shadow-lg hover:scale-110 transition-all duration-200"
        @click="scrollToTop"
      >
        <ArrowUp class="size-4" />
        <span class="text-[10px] font-medium leading-none mt-0.5">{{ scrollPercent }}%</span>
      </button>
    </Transition>

    <!-- ========== AppStarter 应用启动器 ========== -->
    <HomeAppStarter
      v-model:visible="starterShow"
      :site-config="siteConfig"
      :groups="groups"
      :on-saved="handleStarterSaved"
      @update:site-config="handleSiteConfigUpdate"
      @group-saved="handleGroupSaved"
    />

    <!-- ========== 编辑图标弹窗 ========== -->
    <HomeEditIconModal
      v-model:visible="editModalShow"
      :editing-item="editingItem"
      :get-icon-loading="getIconLoading"
      :icon-candidates="iconCandidates"
      @save="handleSaveItem"
      @get-favicon="getIconByUrl(editingItem.url)"
      @select-icon="(url: string) => { if (editingItem.icon) editingItem.icon.src = selectIcon(url) }"
    />

    <!-- ========== 弹窗（iframe 内嵌页面） ========== -->
    <HomeIframeModal
      v-model:visible="windowShow"
      :src="windowSrc"
      :title="windowTitle"
      :is-loading="windowIframeIsLoad"
      @loaded="handleWindowIframeLoaded"
    />
  </div>
</template>

<style scoped>
/* 分组容器离屏渲染跳过，提升长列表滚动性能 */
.group-section {
  content-visibility: auto;
  contain-intrinsic-size: auto 300px;
  /* 纵向 padding：为 hover scale(1.05) 溢出留空间，避免 content-visibility 的 paint containment 裁切卡片 */
  padding-block: 6px;
}

/* 返回顶部按钮：玻璃质感，与公告设置同步 */
.back-top-btn {
  background-color: rgba(255, 255, 255, var(--ann-opacity, 0.15));
  backdrop-filter: blur(var(--ann-blur, 12px));
  -webkit-backdrop-filter: blur(var(--ann-blur, 12px));
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
  color: #fff;
}
.back-top-btn:hover {
  background-color: rgba(255, 255, 255, calc(var(--ann-opacity, 0.15) + 0.1));
}
</style>



