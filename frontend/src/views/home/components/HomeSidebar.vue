<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Menu } from 'lucide-vue-next'
import { useAuthStore } from '@/store'

const props = defineProps<{
  groups: Array<{ title?: string; id?: number }>
}>()

const emit = defineEmits<{
  (e: 'open-settings'): void
  (e: 'sidebar-expanded', value: boolean): void
}>()

const router = useRouter()
const authStore = useAuthStore()

const expanded = ref(false)
const isMobile = ref(false)
const mobileMenuOpen = ref(false)
// 与 Tailwind md 断点对齐：<768px 走移动端抽屉，≥768px 走桌面侧边栏
const mobileWidth = 768
const scrollOffset = 80

function checkMobile() {
  isMobile.value = window.innerWidth < mobileWidth
}

// 通知父组件侧边栏展开状态变化（仅桌面端）
watch(expanded, (val) => {
  if (!isMobile.value) {
    emit('sidebar-expanded', val)
  }
})

// 抽屉打开时锁定 body 滚动，防止 iOS Safari 背景滚动穿透
watch(mobileMenuOpen, (open) => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = open ? 'hidden' : ''
  }
})

function handleResize() {
  checkMobile()
}

const navItems = computed(() => {
  return props.groups.map((g, i) => ({
    title: g.title || `分组 ${i + 1}`,
    groupIndex: i,
  }))
})

function scrollToGroup(index: number) {
  const groups = document.querySelectorAll('.group-section')
  const target = groups[index]
  if (target) {
    const top = target.getBoundingClientRect().top + window.scrollY - scrollOffset
    window.scrollTo({ top, behavior: 'smooth' })
  }
  mobileMenuOpen.value = false
}

function handleLogin() {
  sessionStorage.setItem('sun-panel-skip-redirect', '1')
  router.push('/login')
}

function handleSettings() {
  emit('open-settings')
  expanded.value = false
}

// 设置面板 chunk 预取（去重，悬停/聚焦时触发，点击时几乎立即可用）
let settingsChunkPrefetched = false
function prefetchSettingsChunk() {
  if (settingsChunkPrefetched) return
  settingsChunkPrefetched = true
  // 预取 HomeAppStarter chunk
  import('./HomeAppStarter.vue').catch(() => {
    // 预取失败则重置标记，允许下次重试
    settingsChunkPrefetched = false
  })
}

// 空闲时间预取全部 async chunk（去重）
const prefetchedChunks = new Set<string>()
function prefetchAllChunksIdle() {
  if (prefetchedChunks.has('app-starter')) return
  prefetchedChunks.add('app-starter')
  prefetchedChunks.add('edit-icon-modal')
  prefetchedChunks.add('iframe-modal')
  // 显式 import 字面量，确保 bundler 识别为 chunk 拆分
  Promise.all([
    import('./HomeAppStarter.vue'),
    import('./HomeEditIconModal.vue'),
    import('./HomeIframeModal.vue'),
  ]).catch(() => {
    // 预取失败则清空标记，允许下次重试
    prefetchedChunks.clear()
  })
}

// 兼容不支持 requestIdleCallback 的浏览器，降级为 setTimeout
const scheduleIdle = (cb: () => void) => {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(cb, { timeout: 3000 })
  } else {
    setTimeout(cb, 1500)
  }
}

function handleLogout() {
  authStore.removeToken()
  router.push('/login')
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', handleResize, { passive: true })
  // 空闲时间预取弹窗 chunk，点击时几乎立即可用
  scheduleIdle(() => {
    prefetchAllChunksIdle()
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  // 组件卸载时恢复 body 滚动，避免遗留锁定
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <!-- 桌面端：侧边栏 -->
  <div v-if="!isMobile" class="sidebar-root" @mouseenter="expanded = true" @mouseleave="expanded = false">
    <div class="sidebar-bar" :class="{ expanded }">
      <div class="sidebar-inner">
        <!-- 分组导航（可滚动） -->
        <div class="sidebar-nav">
          <div class="sidebar-nav-inner">
            <div
              v-for="(item, i) in navItems"
              :key="i"
              class="nav-item"
              @click="scrollToGroup(i)"
            >
              <div class="nav-slip" />
              <span class="nav-title">{{ item.title }}</span>
            </div>
          </div>
        </div>

        <!-- 分隔线 -->
        <div class="sidebar-divider" />

        <!-- 底部操作按钮（始终可见） -->
        <div class="sidebar-actions">
          <template v-if="authStore.isLoggedIn">
            <div
              class="nav-item sidebar-action-item"
              @click="handleSettings"
              @mouseenter="prefetchSettingsChunk"
              @focus="prefetchSettingsChunk"
            >
              <div class="nav-slip" />
              <span class="nav-title">设 置</span>
            </div>
            <div class="nav-item sidebar-action-item" @click="handleLogout">
              <div class="nav-slip" />
              <span class="nav-title">退出登录</span>
            </div>
          </template>
          <template v-else>
            <div class="nav-item sidebar-action-item" @click="handleLogin">
              <div class="nav-slip" />
              <span class="nav-title">登 录</span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- 移动端：触发按钮（圆形毛玻璃，使用 lucide Menu 图标） -->
  <button
    v-if="isMobile"
    class="drawer-trigger"
    aria-label="打开导航菜单"
    @click.stop="mobileMenuOpen = !mobileMenuOpen"
  >
    <Menu class="h-5 w-5" />
  </button>

  <!-- 移动端：侧滑抽屉（Teleport 到 body 以确保层级正确） -->
  <Teleport to="body">
    <Transition name="drawer-overlay">
      <div
        v-if="isMobile && mobileMenuOpen"
        class="drawer-overlay"
        @click="mobileMenuOpen = false"
        @touchmove.prevent
      />
    </Transition>
    <Transition name="drawer-slide">
      <div
        v-if="isMobile && mobileMenuOpen"
        class="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="导航菜单"
        @click.stop
      >
        <!-- 顶部标题区 -->
        <div class="drawer-header">
          <span class="drawer-title">导航</span>
        </div>
        <!-- 分组列表（可滚动，面板内不阻止 touchmove 以允许滚动） -->
        <div class="drawer-nav">
          <div
            v-for="(item, i) in navItems"
            :key="i"
            class="drawer-nav-item"
            @click="scrollToGroup(i)"
          >
            <span class="drawer-nav-title">{{ item.title }}</span>
          </div>
        </div>
        <!-- 底部固定操作区 -->
        <div class="drawer-divider" />
        <div class="drawer-actions">
          <template v-if="authStore.isLoggedIn">
            <div
              class="drawer-nav-item drawer-action-item"
              @click="handleSettings"
              @mouseenter="prefetchSettingsChunk"
              @focus="prefetchSettingsChunk"
            >设 置</div>
            <div class="drawer-nav-item drawer-action-item" @click="handleLogout">退出登录</div>
          </template>
          <template v-else>
            <div class="drawer-nav-item drawer-action-item" @click="handleLogin">登 录</div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ===== 桌面端侧边栏 ===== */
.sidebar-root {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  z-index: 50;
  display: flex;
  align-items: center;
}

.sidebar-bar {
  width: 40px;
  padding: 10px;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease, background-color 0.3s ease;
  border-top-right-radius: 20px;
  border-bottom-right-radius: 20px;
  background-color: transparent;
}

.sidebar-bar.expanded {
  width: 200px;
  background-color: var(--glass-bg-hover);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.2);
}

.sidebar-inner {
  width: 200px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-nav-inner {
  margin-top: auto;
  margin-bottom: auto;
}

.sidebar-nav::-webkit-scrollbar {
  width: 4px;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.sidebar-actions {
  flex-shrink: 0;
  padding-top: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
  touch-action: manipulation;
  user-select: none;
}

.nav-slip {
  width: 20px;
  height: 6px;
  background-color: white;
  border-radius: 4px;
  margin: 15px 0;
  transition: height 0.3s ease, width 0.3s ease;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.5);
  flex-shrink: 0;
}

.nav-title {
  opacity: 0;
  white-space: nowrap;
  transition: opacity 0.3s ease, transform 0.3s ease, margin-left 0.3s ease;
  font-size: 14px;
  color: white;
  margin-left: 0;
}

.sidebar-bar.expanded .nav-title {
  opacity: 1;
  margin-left: 10px;
}

.sidebar-bar.expanded .nav-item {
  padding: 4px 0;
}

.sidebar-bar.expanded .nav-slip {
  box-shadow: none;
}

.sidebar-bar.expanded .nav-item:hover .nav-slip {
  width: 40px;
}

.sidebar-bar.expanded .nav-item:hover .nav-title {
  font-size: 20px;
}

.sidebar-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.15);
  margin: 8px 0;
  transition: opacity 0.3s ease;
  opacity: 0;
}

.sidebar-bar.expanded .sidebar-divider {
  opacity: 1;
}

.sidebar-action-item .nav-slip {
  background-color: rgba(255, 255, 255, 0.5) !important;
}

/* ===== 移动端触发按钮 ===== */
.drawer-trigger {
  position: fixed;
  top: 20px;
  left: 20px;
  width: 48px;
  height: 48px;
  background-color: hsl(var(--background) / 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid hsl(var(--border) / 0.5);
  border-radius: 9999px;
  color: hsl(var(--foreground));
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  z-index: 50;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.2s ease;
}
.drawer-trigger:hover {
  background-color: hsl(var(--background) / 0.8);
}

/* ===== 移动端侧滑抽屉 ===== */
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 49;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}
.drawer-overlay-enter-active,
.drawer-overlay-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-overlay-enter-from,
.drawer-overlay-leave-to {
  opacity: 0;
}

.drawer-panel {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: 50vw;
  max-width: 320px;
  z-index: 50;
  background-color: var(--glass-bg-hover);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 2px 0 16px rgba(0, 0, 0, 0.3);
}
.drawer-slide-enter-active {
  transition: transform 0.25s ease-out;
}
.drawer-slide-leave-active {
  transition: transform 0.25s ease-in;
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(-100%);
}

.drawer-header {
  padding: 16px 20px;
  flex-shrink: 0;
}
.drawer-title {
  font-size: 16px;
  font-weight: 600;
  color: white;
}

.drawer-nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  padding: 0 12px;
  -webkit-overflow-scrolling: touch;
}
.drawer-nav::-webkit-scrollbar {
  width: 4px;
}
.drawer-nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.drawer-nav-item {
  padding: 12px 14px;
  color: white;
  font-size: 14px;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.2s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.drawer-nav-item:hover,
.drawer-nav-item:active {
  background: rgba(255, 255, 255, 0.1);
}

.drawer-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.15);
  margin: 4px 16px;
}

.drawer-actions {
  flex-shrink: 0;
  padding: 8px 12px 16px;
}
.drawer-action-item {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}
</style>