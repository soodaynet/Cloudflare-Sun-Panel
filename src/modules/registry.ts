import type { Hono } from 'hono'
import type { AppContext, ModuleDefinition } from './types'

export class ModuleRegistry {
  private modules = new Map<string, ModuleDefinition>()

  /** 注册模块（重复注册抛错） */
  register(module: ModuleDefinition): void {
    if (this.modules.has(module.name)) {
      throw new Error(`Module "${module.name}" is already registered`)
    }
    this.modules.set(module.name, module)
  }

  /** 将所有模块挂载到 Hono App */
  install(app: Hono<AppContext>): void {
    for (const module of this.modules.values()) {
      // 先挂载模块级中间件
      if (module.middlewares) {
        for (const mw of module.middlewares) {
          app.use(`${module.mountPath}/*`, mw)
        }
      }
      // 再挂载路由
      app.route(module.mountPath, module.router)
    }
  }
}
