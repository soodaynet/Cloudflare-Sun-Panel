import { createI18n } from 'vue-i18n'
import type { App } from 'vue'
import zhCN from './zh-CN.json'
import enUS from './en-US.json'
import { LANG_KEY } from '@/utils/storageKeys'

const messages = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

// 从本地存储恢复上次选择的语言，避免刷新后回退到默认语言
const savedLang = localStorage.getItem(LANG_KEY) || 'zh-CN'

export const i18n = createI18n({
  legacy: false,
  locale: savedLang,
  fallbackLocale: 'zh-CN',
  messages,
})

export function setupI18n(app: App) {
  app.use(i18n)
}
