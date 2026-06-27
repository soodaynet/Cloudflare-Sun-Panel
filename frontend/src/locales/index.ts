import { createI18n } from 'vue-i18n'
import type { App } from 'vue'
import zhCN from './zh-CN.json'
import { LANG_KEY } from '@/utils/storageKeys'

export type AppLocale = 'zh-CN' | 'en-US'

// 默认/兜底语言：始终同步加载，确保首屏不出现空文案
const FALLBACK_LOCALE = 'zh-CN' as const

// 从本地存储恢复上次选择的语言；无则按浏览器语言推断，最终兜底 zh-CN
export function detectLocale(): AppLocale {
  const saved = localStorage.getItem(LANG_KEY)
  if (saved === 'en-US' || saved === 'zh-CN') return saved
  return navigator.language?.startsWith('en') ? 'en-US' : 'zh-CN'
}

const savedLang = detectLocale()

// en-US 留空占位：运行时由 loadLocaleAsync 异步填充，未加载期间按键 fallback 到 zh-CN；
// 占位使 Locales 推断为 'zh-CN' | 'en-US'，locale.value 即可在两者间切换，并保留 t() 键校验
export const i18n = createI18n({
  legacy: false,
  // 首屏先用已同步加载的兜底语言，避免空文案；若与当前语言不一致，setupI18n 后异步加载再切换
  locale: FALLBACK_LOCALE,
  fallbackLocale: FALLBACK_LOCALE,
  messages: {
    'zh-CN': zhCN,
    'en-US': {} as typeof zhCN,
  },
})

// 已加载语言包，避免重复 merge
const loadedLocales = new Set<AppLocale>(['zh-CN'])

// 异步加载语言包并切换；zh-CN 已同步加载，此处仅 en-US 需懒加载。
// 加载期间 fallbackLocale 保证不出现空文案，加载完成后再切到目标语言（避免闪烁）。
export async function loadLocaleAsync(locale: AppLocale): Promise<void> {
  if (!loadedLocales.has(locale)) {
    const { default: msgs } = await import('./en-US.json')
    i18n.global.mergeLocaleMessage(locale, msgs)
    loadedLocales.add(locale)
  }
  i18n.global.locale.value = locale
}

export function setupI18n(app: App) {
  app.use(i18n)
  // 首屏：若当前语言非默认语言，异步加载并切换（期间显示 zh-CN 兜底，加载完自动切换）
  if (savedLang !== FALLBACK_LOCALE) {
    void loadLocaleAsync(savedLang)
  }
}
