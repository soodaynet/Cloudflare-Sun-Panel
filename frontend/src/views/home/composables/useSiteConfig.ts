import { ref } from 'vue'
import { updateFavicon, getCachedSiteConfig } from '@/utils/faviconUtils'
import { SITE_CACHE_KEY } from '@/utils/storageKeys'

export { SITE_CACHE_KEY }

export function useSiteConfig() {
  function loadCachedSiteConfig(): Panel.SiteConfig {
    return getCachedSiteConfig()
  }

  const siteConfig = ref<Panel.SiteConfig>(loadCachedSiteConfig())
  const siteConfigLoaded = ref(false)

  // 立即用缓存值设置标题和图标
  if (siteConfig.value.site_title) {
    document.title = siteConfig.value.site_title
  }
  if (siteConfig.value.favicon_url) {
    updateFavicon(siteConfig.value.favicon_url)
  }

  function handleSiteConfigUpdate(config: Panel.SiteConfig) {
    siteConfig.value = config
    localStorage.setItem(SITE_CACHE_KEY, JSON.stringify(config))
    if (config.site_title) {
      document.title = config.site_title
    }
    updateFavicon(config.favicon_url || '')
  }

  return {
    siteConfig,
    siteConfigLoaded,
    handleSiteConfigUpdate,
    updateFavicon,
  }
}