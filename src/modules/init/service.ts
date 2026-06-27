import type { AuthUser } from '../shared/types'
import type { PanelService } from '../panel/service'
import type { SettingsService } from '../settings/service'
import type { UserConfigService } from '../user-config/service'
import type { InitAuthInfo, InitResponse } from './types'
import { normalizeSearchEngineConfig } from '../shared/searchEngine'

/**
 * init 服务层 — 聚合面板初始化所需的全部数据
 *
 * 聚合内容：
 * - 面板数据（分组、图标、面板配置）：PanelService.getAllData
 * - 系统设置：SettingsService.getAll
 * - 认证信息：基于 auth 中间件注入的 user 构建
 * - 搜索引擎配置：UserConfigService.get（空配置时回退默认）
 */
export class InitService {
  constructor(
    private panel: PanelService,
    private settings: SettingsService,
    private userConfig: UserConfigService,
  ) {}

  /**
   * 聚合返回面板数据、系统设置、认证信息、搜索引擎配置
   * @param user 认证用户（未登录时为 null）
   */
  async aggregate(user: AuthUser | null): Promise<InitResponse> {
    const userId = user?.userId || 0
    // 预取 user_configs 一次（panel_json + search_engine_json），供 getAllData 与 userConfig.get 复用；
    // /init 路径下中间件已保证 authUser 存在，跳过 userConfig.get 内的 users 存在性校验
    const userConfigRow = await this.userConfig.getRawRow(userId)

    const [panelData, about, authInfo, userCfg] = await Promise.all([
      this.panel.getAllData(userId, userConfigRow),
      this.settings.getAll(),
      InitService.buildAuthInfo(user),
      this.userConfig.get(userId, userConfigRow),
    ])

    return {
      ...panelData,
      about,
      authInfo,
      searchEngine: normalizeSearchEngineConfig(userCfg.searchEngine),
    }
  }

  /** 根据认证用户构建 authInfo */
  private static buildAuthInfo(user: AuthUser | null): InitAuthInfo {
    if (user) {
      return {
        user: {
          id: user.userId,
          username: user.username,
          name: user.name || '',
          role: user.role,
        },
        visitMode: user.visitMode,
      }
    }
    return { user: null, visitMode: 1 }
  }
}
