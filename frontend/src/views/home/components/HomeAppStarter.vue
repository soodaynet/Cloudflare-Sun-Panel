<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue'
import { storeToRefs } from 'pinia'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/components/ui/sonner'
import { useAuthStore, usePanelState } from '@/store'
import { saveGroup, deleteGroups } from '@/modules'
import AppStarterSidebar from './AppStarterSidebar.vue'
import type { SearchEngineConfig } from '@/modules'

// 8 个 Panel 改为按需加载：首屏只下载当前激活 Tab 的 chunk，其余在切换时再拉取
const UsersManage = defineAsyncComponent(() => import('@/components/apps/Users/index.vue'))
const PanelUserInfo = defineAsyncComponent(() => import('./panels/PanelUserInfo.vue'))
const PanelStyleSettings = defineAsyncComponent(() => import('./panels/PanelStyleSettings.vue'))
const PanelAnnounceSettings = defineAsyncComponent(() => import('./panels/PanelAnnounceSettings.vue'))
const PanelGroupManage = defineAsyncComponent(() => import('./panels/PanelGroupManage.vue'))
const PanelImportExport = defineAsyncComponent(() => import('./panels/PanelImportExport.vue'))
const PanelSiteSettings = defineAsyncComponent(() => import('./panels/PanelSiteSettings.vue'))
const PanelSearchSettings = defineAsyncComponent(() => import('./panels/PanelSearchSettings.vue'))
const PanelHitokotoSettings = defineAsyncComponent(() => import('./panels/PanelHitokotoSettings.vue'))
const PanelMusicSettings = defineAsyncComponent(() => import('./panels/PanelMusicSettings.vue'))

interface App {
  name: string
  key: string
  icon: string
  adminOnly?: boolean
}

interface ItemGroup {
  id?: number
  title: string
  sort?: number
  items?: Panel.ItemInfo[]
  publicVisible?: number
  hoverStatus?: boolean
  sortStatus?: boolean
}

const props = defineProps<{
  visible: boolean
  siteConfig: Panel.SiteConfig
  groups: ItemGroup[]
  searchEngineConfig: SearchEngineConfig
  onSaved: () => void
}>()

const emit = defineEmits<{
  (e: 'update:visible', visible: boolean): void
  (e: 'update:siteConfig', config: Panel.SiteConfig): void
  (e: 'update:searchEngineConfig', config: SearchEngineConfig): void
  (e: 'groupSaved'): void
}>()

const show = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const authStore = useAuthStore()
const panelState = usePanelState()
const { panelConfig } = storeToRefs(panelState)

const activeApp = ref('UserInfo')
const collapsed = ref(false)
const screenWidth = ref(window.innerWidth)
const isSmallScreen = ref(false)
const editGroupModalVisible = ref(false)
const editingGroup = ref<Panel.ItemIconGroup>({ title: '' })

const apps = computed<App[]>(() => {
  const list: App[] = [
    { name: '我的信息', key: 'UserInfo', icon: '👤' },
    { name: '风格设置', key: 'Style', icon: '🎨' },
    { name: '公告设置', key: 'Announce', icon: '📢' },
    { name: '分组管理', key: 'GroupManage', icon: '📁' },
    { name: '导入导出', key: 'ImportExport', icon: '📦' },
    { name: '搜索引擎', key: 'SearchSettings', icon: '🔍' },
    { name: '一言', key: 'Hitokoto', icon: '💬' },
    { name: '音乐', key: 'Music', icon: '🎵' },
  ]
  if (authStore.isAdmin) {
    list.push({ name: '用户管理', key: 'Users', icon: '👥', adminOnly: true })
    list.push({ name: '站点设置', key: 'SiteSettings', icon: '⚙', adminOnly: true })
  }
  return list
})

// resize 节流：避免拖动窗口时高频触发重排
let resizeTimer: ReturnType<typeof setTimeout> | null = null
function handleResize() {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    screenWidth.value = window.innerWidth
    isSmallScreen.value = screenWidth.value < 640
    if (isSmallScreen.value) collapsed.value = true
  }, 150)
}

const layoutHeight = computed(() => 'min(90vh, 860px)')

onMounted(() => {
  window.addEventListener('resize', handleResize, { passive: true })
  handleResize()
  syncSiteConfig()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (resizeTimer) clearTimeout(resizeTimer)
})

// ====== 站点设置 ======
const localSiteConfig = ref<Panel.SiteConfig>({})

function syncSiteConfig() {
  localSiteConfig.value = { ...props.siteConfig }
}

// 浅 watch：siteConfig 始终通过引用重新赋值更新（useSiteConfig / useDataLoader 均执行 siteConfig.value = config），浅监听足以触发同步
watch(() => props.siteConfig, () => syncSiteConfig())

function handleSiteConfigUpdate(config: Panel.SiteConfig) {
  emit('update:siteConfig', config)
}

// ====== 分组管理 ======
function openEditGroup(group: ItemGroup) {
  editingGroup.value = { id: group.id, title: group.title, sort: group.sort, publicVisible: group.publicVisible ?? 1 }
  editGroupModalVisible.value = true
}

async function handleSaveGroup() {
  try {
    const res = await saveGroup(editingGroup.value)
    if (res.code === 0) { toast.success('保存成功'); editGroupModalVisible.value = false; props.onSaved() }
    else toast.error(res.msg || '保存失败')
  } catch { toast.error('网络错误') }
}

async function handleDeleteGroup(group: ItemGroup) {
  if (!group.id) return
  try {
    const res = await deleteGroups([group.id])
    if (res.code === 0) { toast.success('删除成功'); props.onSaved() }
  } catch { toast.error('网络错误') }
}

function openAddGroup() {
  editingGroup.value = { title: '', publicVisible: 1 }
  editGroupModalVisible.value = true
}

function handleGroupSaved() {
  emit('groupSaved')
}
</script>

<template>
  <Dialog v-model:open="show">
    <DialogContent class="w-[95vw] max-w-[1200px] sm:max-w-[1200px] p-0">
      <DialogHeader class="px-4 py-3 border-b">
        <DialogTitle class="flex items-center select-none cursor-pointer">
          <span class="text-lg mr-2" @click="collapsed = !collapsed">{{ collapsed ? '▶' : '◀' }}</span>
          <span>{{ apps.find(a => a.key === activeApp)?.name || '应用启动器' }}</span>
        </DialogTitle>
      </DialogHeader>

      <div class="flex" :style="{ height: layoutHeight }">
        <AppStarterSidebar
          :apps="apps"
          v-model:active-app="activeApp"
          v-model:collapsed="collapsed"
          :is-small-screen="isSmallScreen"
        />
        <div class="flex-1 min-w-0 overflow-hidden @container" :style="{ height: layoutHeight }">
          <div class="h-full overflow-auto p-3 sm:p-4">
            <!-- Tab 切换淡入过渡 + KeepAlive 缓存：直接包裹组件 VNode，避免外层 div 导致缓存失效 -->
            <Transition name="tab-fade" mode="out-in">
              <KeepAlive>
                <!-- ====== 我的信息 ====== -->
                <PanelUserInfo v-if="activeApp === 'UserInfo'" />

                <!-- ====== 风格设置 ====== -->
                <PanelStyleSettings
                  v-else-if="activeApp === 'Style'"
                  :panel-config="panelConfig"
                  :on-saved="props.onSaved"
                />

                <!-- ====== 公告设置 ====== -->
                <PanelAnnounceSettings
                  v-else-if="activeApp === 'Announce'"
                  :panel-config="panelConfig"
                  :on-saved="props.onSaved"
                />

                <!-- ====== 分组管理 ====== -->
                <PanelGroupManage
                  v-else-if="activeApp === 'GroupManage'"
                  :groups="props.groups"
                  @add-group="openAddGroup"
                  @edit-group="openEditGroup"
                  @delete-group="handleDeleteGroup"
                  @saved="handleGroupSaved"
                />

                <!-- ====== 导入导出 ====== -->
                <PanelImportExport
                  v-else-if="activeApp === 'ImportExport'"
                />

                <!-- ====== 搜索引擎 ====== -->
                <PanelSearchSettings
                  v-else-if="activeApp === 'SearchSettings'"
                  :search-engine-config="searchEngineConfig"
                  @update:search-engine-config="(cfg) => $emit('update:searchEngineConfig', cfg)"
                />

                <!-- ====== 一言 ====== -->
                <PanelHitokotoSettings
                  v-else-if="activeApp === 'Hitokoto'"
                  :panel-config="panelConfig"
                  :on-saved="props.onSaved"
                />

                <!-- ====== 音乐 ====== -->
                <PanelMusicSettings
                  v-else-if="activeApp === 'Music'"
                  :panel-config="panelConfig"
                  :on-saved="props.onSaved"
                />

                <!-- ====== 用户管理 ====== -->
                <div v-else-if="activeApp === 'Users'" class="flex flex-col gap-4">
                  <UsersManage />
                </div>

                <!-- ====== 站点设置 ====== -->
                <PanelSiteSettings
                  v-else-if="activeApp === 'SiteSettings'"
                  :site-config="localSiteConfig"
                  @update:site-config="handleSiteConfigUpdate"
                />
              </KeepAlive>
            </Transition>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <!-- 分组编辑弹窗 -->
  <Dialog v-model:open="editGroupModalVisible">
    <DialogContent class="w-[95vw] sm:w-[400px] max-w-[400px]">
      <DialogHeader>
        <DialogTitle>编辑分组</DialogTitle>
      </DialogHeader>
      <div v-if="editingGroup" class="flex flex-col gap-4">
        <div>
          <label class="block text-sm mb-1">分组名称 *</label>
          <Input v-model="editingGroup.title" placeholder="请输入分组名称" />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-sm">访客可见</label>
          <Switch
            :model-value="editingGroup.publicVisible === 1"
            @update:model-value="(v: boolean) => (editingGroup.publicVisible = v ? 1 : 0)"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="editGroupModalVisible = false">取消</Button>
        <Button @click="handleSaveGroup">保存</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
/* Tab 切换淡入过渡 */
.tab-fade-enter-active {
  transition: opacity 150ms ease-out;
}
.tab-fade-enter-from {
  opacity: 0;
}
</style>