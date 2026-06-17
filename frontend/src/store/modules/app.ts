import { defineStore } from 'pinia'
import { LANG_KEY, THEME_KEY } from '@/utils/storageKeys'

export const useAppStore = defineStore('app', {
  state: () => ({
    language: (localStorage.getItem(LANG_KEY) as string) || 'zh-CN',
    theme: (localStorage.getItem(THEME_KEY) as 'light' | 'dark' | 'auto') || 'auto',
  }),

  actions: {
    setLanguage(lang: string) {
      this.language = lang
      localStorage.setItem(LANG_KEY, lang)
    },

    setTheme(theme: 'light' | 'dark' | 'auto') {
      this.theme = theme
      localStorage.setItem(THEME_KEY, theme)
    },
  },
})