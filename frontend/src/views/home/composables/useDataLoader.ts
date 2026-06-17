import { ref, computed, type Ref } from 'vue'
import type { useAuthStore, usePanelState } from '@/store'
import { getAllData, getInit } from '@/api/index'
import { cachedRequest, invalidateCacheByPrefix, invalidateCache } from '@/utils/requestCache'
import { PUBLIC_MODE_KEY } from '@/utils/storageKeys'

export interface ItemGroup extends Panel.ItemIconGroup {
  hoverStatus?: boolean
  items: Panel.ItemInfo[]
  sortStatus?: boolean
}

interface InitData {
  groups: Panel.ItemIconGroup[]
  itemsMap: Record<number, Panel.ItemInfo[]>
  panelConfig: Panel.panelConfig
  about: Record<string, string>
  authInfo: { user: User.Info | null; visitMode: number }
}

interface PreloadGroup {
  items?: Array<{ icon?: { src?: string } | null }>
}

export function useDataLoader(options: {
  authStore: ReturnType<typeof useAuthStore>
  panelState: ReturnType<typeof usePanelState>
  siteConfig: Ref<Panel.SiteConfig>
  syncWallpaper: () => void
  preloadIcons: (groups: PreloadGroup[], count?: number) => void
  onSiteConfigUpdated: (config: Panel.SiteConfig) => void
  markDataReady: () => void
}) {
  const { authStore, panelState, siteConfig, syncWallpaper, preloadIcons, onSiteConfigUpdated, markDataReady } = options

  const groups = ref<ItemGroup[]>([])
  const loading = ref(true)

  /** 访客模式下仅显示 publicVisible !== 0 的分组，用户模式下显示全部分组 */
  const visibleGroups = computed(() => {
    if (!authStore.isVisitMode) return groups.value
    return groups.value.filter((g) => g.publicVisible !== 0)
  })

  function mapGroups(rawGroups: Panel.ItemIconGroup[], itemsMap: Record<number, Panel.ItemInfo[]>) {
    return (rawGroups || []).map((g) => ({
      ...g,
      hoverStatus: false,
      sortStatus: false,
      items: g.id && itemsMap[g.id] ? itemsMap[g.id] : [],
    })) as ItemGroup[]
  }

  /** 统一加载分组 + 图标 + 面板配置（缓存 5 分钟） */
  async function loadData() {
    loading.value = true
    try {
      const res = await cachedRequest('panel:allData', () =>
        getAllData<{
          groups: Panel.ItemIconGroup[]
          itemsMap: Record<number, Panel.ItemInfo[]>
          panelConfig: Panel.panelConfig
        }>(),
        600,
      )

      if (res.code === 0 && res.data) {
        const { groups: rawGroups, itemsMap, panelConfig } = res.data

        groups.value = mapGroups(rawGroups, itemsMap)

        if (panelConfig && Object.keys(panelConfig).length > 0) {
          panelState.updatePanelConfigFromCloud(panelConfig)
        }
        syncWallpaper()
        markDataReady()
        preloadIcons(groups.value)
      }
    } catch (e) {
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  /** 首次加载：合并 auth + siteConfig + panel 三个请求为一次 /init 调用 */
  async function loadInitData() {
    loading.value = true
    try {
      const res = await getInit<InitData>()
      if (res.code === 0 && res.data) {
        const { groups: rawGroups, itemsMap, panelConfig, about, authInfo } = res.data

        // 1. 认证信息
        if (authInfo) {
          if (authInfo.user) {
            authStore.setUserInfo(authInfo.user)
            authStore.setVisitMode(authInfo.visitMode)
          } else if (localStorage.getItem(PUBLIC_MODE_KEY) === '1') {
            // 未登录时，仅当公开模式可用时才设置 visitMode
            authStore.setVisitMode(authInfo.visitMode)
          }
        }

        // 2. 面板数据（必须在站点配置之前应用，确保风格壁纸优先于站点壁纸，避免壁纸闪烁）
        groups.value = mapGroups(rawGroups, itemsMap)

        if (panelConfig && Object.keys(panelConfig).length > 0) {
          panelState.updatePanelConfigFromCloud(panelConfig)
        }

        // 3. 站点配置（在面板数据之后应用，这样 watchEffect 中 backgroundImageSrc 已就绪，login_bg_image 作为兜底不会覆盖）
        if (about && Object.keys(about).length > 0) {
          const config: Panel.SiteConfig = {
            site_title: about.site_title || '',
            login_bg_image: about.login_bg_image || '',
            login_blur: about.login_blur !== undefined ? Number(about.login_blur) : 12,
            login_mask_opacity: about.login_mask_opacity !== undefined ? Number(about.login_mask_opacity) : 0.15,
            footer_html: about.footer_html || '',
            logo_text: about.logo_text || '',
            logo_image_src: about.logo_image_src || '',
            favicon_url: about.favicon_url || '',
          }
          siteConfig.value = config
          onSiteConfigUpdated(config)
        }

        syncWallpaper()
        markDataReady()
        preloadIcons(groups.value)
      }
    } catch (e) {
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  /** 刷新全部数据：清缓存 + 单次 /init 调用（替代原来的 3 次独立请求） */
  function refreshAll() {
    invalidateCacheByPrefix('panel:')
    invalidateCache('site:about')
    loadInitData()
  }

  return {
    groups,
    loading,
    visibleGroups,
    loadData,
    loadInitData,
    refreshAll,
  }
}