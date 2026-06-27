import { defineStore } from 'pinia'
import { detectLocale, loadLocaleAsync, type AppLocale } from '@/locales'
import { LANG_KEY, THEME_KEY } from '@/utils/storageKeys'

export const useAppStore = defineStore('app', {
  state: () => ({
    language: detectLocale(),
    theme: (localStorage.getItem(THEME_KEY) as 'light' | 'dark' | 'auto') || 'auto',
  }),

  actions: {
    setLanguage(lang: string) {
      const locale: AppLocale = lang === 'en-US' ? 'en-US' : 'zh-CN'
      this.language = locale
      localStorage.setItem(LANG_KEY, locale)
      // 切换 vue-i18n 全局 locale；未加载的语言包会先懒加载再切换，期间 fallback 保证不空文案
      void loadLocaleAsync(locale)
    },

    setTheme(theme: 'light' | 'dark' | 'auto') {
      this.theme = theme
      localStorage.setItem(THEME_KEY, theme)
    },
  },
})
