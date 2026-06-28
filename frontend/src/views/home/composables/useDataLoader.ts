import { ref, computed, type Ref } from 'vue'
import type { useAuthStore, usePanelState } from '@/store'
import { getAllData, getInit } from '@/modules'
import { cachedRequest, invalidateCacheByPrefix, invalidateCache, initCacheKey } from '@/utils/requestCache'
import { PUBLIC_MODE_KEY, panelDataKey } from '@/utils/storageKeys'
import type { SearchEngineConfig } from '@/modules'

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
  searchEngine?: SearchEngineConfig
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
  onSearchEngineUpdated?: (config: SearchEngineConfig) => void
}) {
  const { authStore, panelState, siteConfig, syncWallpaper, preloadIcons, onSiteConfigUpdated, markDataReady, onSearchEngineUpdated } = options

  const groups = ref<ItemGroup[]>([])
  const loading = ref(true)
  // 首次数据就绪标志：初始 false，首次 loadInitData 成功后置 true 且不再重置。
  // 用于门控搜索框/Logo 渲染，避免加载期间显示默认值后被真实配置替换的闪烁。
  const initialLoaded = ref(false)

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
      // FE-1: 走 cachedRequest 去重 + 60s 内存缓存（与后端 /init max-age=60 对齐，按用户隔离）
      const res = await cachedRequest(initCacheKey(authStore.userInfo?.id), () => getInit<InitData>(), 60)
      if (res.code === 0 && res.data) {
        const { groups: rawGroups, itemsMap, panelConfig, about, authInfo, searchEngine } = res.data

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

        // FE-6: 写入 panelData 首屏缓存（仅 groups+itemsMap+panelConfig，不含 about/authInfo/searchEngine）
        try {
          localStorage.setItem(
            panelDataKey(authStore.userInfo?.id),
            JSON.stringify({ data: { groups: rawGroups, itemsMap, panelConfig }, ts: Date.now() }),
          )
        } catch {
          // 配额溢出等异常，忽略
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

        // 4. 搜索引擎配置（仅 /init 返回）
        if (searchEngine) {
          onSearchEngineUpdated?.(searchEngine)
        }

        // 首次加载成功后标记，刷新时不再重置（保持搜索框/Logo 不消失）
        initialLoaded.value = true
      }
    } catch (e) {
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  /**
   * FE-6: 同步读取 localStorage 中的 panelData 首屏缓存，立即渲染（秒开）
   * 仅应用 groups + panelConfig，/init 网络返回后由 loadInitData 覆盖
   * 不含 about/authInfo/searchEngine（敏感/易变，仅 /init 返回时应用）
   */
  function applyCachedPanelData(): boolean {
    try {
      const raw = localStorage.getItem(panelDataKey(authStore.userInfo?.id))
      if (!raw) return false
      const parsed = JSON.parse(raw) as {
        data: {
          groups: Panel.ItemIconGroup[]
          itemsMap: Record<number, Panel.ItemInfo[]>
          panelConfig: Panel.panelConfig
        }
        ts: number
      }
      if (!parsed?.data) return false
      const { groups: rawGroups, itemsMap, panelConfig } = parsed.data
      groups.value = mapGroups(rawGroups, itemsMap)
      if (panelConfig && Object.keys(panelConfig).length > 0) {
        panelState.updatePanelConfigFromCloud(panelConfig)
      }
      preloadIcons(groups.value)
      return true
    } catch {
      return false
    }
  }

  /** 刷新全部数据：清缓存 + 单次 /init 调用（替代原来的 3 次独立请求） */
  function refreshAll() {
    invalidateCacheByPrefix('panel:')
    invalidateCacheByPrefix('init:')
    invalidateCache('site:about')
    loadInitData()
  }

  return {
    groups,
    loading,
    initialLoaded,
    visibleGroups,
    loadData,
    loadInitData,
    applyCachedPanelData,
    refreshAll,
  }
}