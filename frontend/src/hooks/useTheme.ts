import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import { useAppStore } from '@/store'

export type ThemeMode = 'light' | 'dark' | 'auto'

function applyDark(isDark: boolean) {
  const root = document.documentElement
  if (isDark) root.classList.add('dark')
  else root.classList.remove('dark')
}

/**
 * 主题 hook：基于 CSS 变量切换主题
 * - 通过向 <html> 添加/移除 `dark` class 驱动 Tailwind dark 变体
 * - 支持 light / dark / auto（auto 跟随系统 prefers-color-scheme）
 * - 主题偏好持久化由 appStore 处理（localStorage THEME_KEY）
 */
export function useTheme() {
  const appStore = useAppStore()
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const systemDark = ref(mediaQuery.matches)

  // 解析后的实际主题（auto 模式跟随系统）
  const resolvedTheme = computed<'light' | 'dark'>(() => {
    if (appStore.theme === 'dark') return 'dark'
    if (appStore.theme === 'auto') return systemDark.value ? 'dark' : 'light'
    return 'light'
  })

  const isDark = computed(() => resolvedTheme.value === 'dark')

  // 响应式应用 dark class（watchEffect 在 setup 阶段立即执行，避免主题闪烁）
  watchEffect(() => {
    applyDark(isDark.value)
  })

  let handler: ((e: MediaQueryListEvent) => void) | null = null

  onMounted(() => {
    handler = (e: MediaQueryListEvent) => { systemDark.value = e.matches }
    mediaQuery.addEventListener('change', handler)
  })

  onUnmounted(() => {
    if (handler) mediaQuery.removeEventListener('change', handler)
  })

  function setTheme(theme: ThemeMode) {
    appStore.setTheme(theme)
  }

  return { theme: computed(() => appStore.theme), resolvedTheme, isDark, systemDark, setTheme }
}
