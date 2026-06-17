import type { D1Database } from '@cloudflare/workers-types'
import { PanelService } from './PanelService'
import { UserService } from './UserService'
import { SettingsService } from './SettingsService'

/**
 * 服务工厂 — 单例模式的 Service 实例管理器
 *
 * 使用 WeakMap 以 DB 实例为 key 缓存 Service 实例，避免每次请求都 new Service()。
 * 同一 Worker 实例内复用 Service 对象，减少 GC 压力和对象创建开销。
 *
 * @example
 * ```ts
 * const factory = ServiceFactory.from(c.env.DB)
 * const panelData = await factory.panel.getAllData(userId)
 * const user = await factory.user.findByUsername('admin')
 * const settings = await factory.settings.getAll()
 * ```
 */
export class ServiceFactory {
  private static instances = new WeakMap<D1Database, ServiceFactory>()

  readonly panel: PanelService
  readonly user: UserService
  readonly settings: SettingsService

  private constructor(db: D1Database) {
    this.panel = new PanelService(db)
    this.user = new UserService(db)
    this.settings = new SettingsService(db)
  }

  /** 获取或创建与指定 DB 实例关联的 ServiceFactory */
  static from(db: D1Database): ServiceFactory {
    let instance = this.instances.get(db)
    if (!instance) {
      instance = new ServiceFactory(db)
      this.instances.set(db, instance)
    }
    return instance
  }
}