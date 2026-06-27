# 模块说明

> 本文档说明 Cloudflare-Sun-Panel 项目的后端与前端模块结构、职责、注册方式与通信规则。
>
> 后端基于 Cloudflare Workers + Hono + D1，前端基于 Vue 3。所有持久化数据存于 D1（binding 名 `DB`，库名 `sun-panel-db`），不引入 KV/R2/其他数据库。

## 后端模块架构

### 核心约定

- 插件式模块化架构，所有业务逻辑以模块形式注册到全局 `ModuleRegistry`。
- 模块高内聚低耦合，模块间**不得**直接 import 其他模块的内部实现（`service.ts` / `validator.ts` / `routes.ts`）。
- 模块间通信只能通过：共享类型（`types.ts`）、共享工具（`src/modules/shared/`）、HTTP API。
- 每个模块目录 `src/modules/<name>/` 自包含 5 个文件：
  - `index.ts` —— 注册入口，导出 `ModuleDefinition`
  - `routes.ts` —— Hono 路由
  - `service.ts` —— 业务逻辑
  - `validator.ts` —— Zod schema 校验
  - `types.ts` —— 类型定义
- `AppContext.Variables` 实际为 `{ authUser?, validatedBody? }`：中间件往 `c.set('authUser', ...)` / `c.set('validatedBody', ...)` 写入，下游通过 `c.var.authUser` / `c.var.validatedBody` 读取。

### 模块注册机制

注册流程位于 `src/index.ts`：

1. 创建 `ModuleRegistry` 实例。
2. 按顺序 `registry.register(module)` 注册各模块（重复注册抛错）。
3. `registry.install(app)` 一次性挂载全部模块。

`registry.install(app)` 对每个模块的处理顺序（见 `src/modules/registry.ts`）：

1. 先挂载模块级 `middlewares`（仅作用于 `${mountPath}/*`）；
2. 再 `app.route(mountPath, router)` 挂载路由。

> 注意：模块的「实际请求路径」= `mountPath` + 路由内部定义的路径。多数模块的 `mountPath` 为 `/`，完整路径由 `routes.ts` 内部决定。

`ModuleDefinition` 接口（见 `src/modules/types.ts`）：

```ts
interface ModuleDefinition {
  name: string                                  // 模块名称（唯一标识）
  mountPath: string                             // 挂载路径（如 '/panel', '/user'）
  router: Hono<AppContext>                      // Hono 路由实例
  middlewares?: MiddlewareHandler<AppContext>[] // 模块级中间件（仅作用于 mountPath 下）
}
```

`src/index.ts` 中的注册顺序：

```ts
registry.register(authModule)
registry.register(initModule)
registry.register(panelModule)
registry.register(userConfigModule)
registry.register(usersAdminModule)
registry.register(userSelfModule)
registry.register(settingsModule)
registry.install(app)
```

> 此外，`src/index.ts` 还直接定义了两个不依赖 DB / 环境变量的根级路由：
> - `GET /api/health` —— 健康检查
> - `GET /api/favicon-proxy` —— Favicon 代理（公开，受 `isValidUrl` SSRF 校验，转发至 Google S2 favicon 服务，边缘缓存）
>
> 以及全局中间件：`corsMiddleware`、`csrfMiddleware`、`securityHeadersMiddleware`、`bodyLimitMiddleware`（均 `app.use('*', ...)`）。

### 后端模块清单

#### auth 模块

- **模块名 / 挂载路径**：`auth` / `/`（路由内部定义 `/login`，完整路径 `POST /login`）
- **职责**：登录认证。仅提供登录接口，**无注册接口**（用户由管理员后台创建）。
- **路由**：
  - `POST /login` —— 用户名密码登录，返回 JWT token 与用户信息；挂载 `loginLimiter`（10 次/分钟）与 `validate(loginSchema)`。
- **文件结构**：`index.ts` / `routes.ts` / `service.ts` / `validator.ts` / `types.ts`
- **Service**：`AuthService` —— `findByUsername`、`authenticate`（校验密码、检查账号状态、签发 token）。
- **依赖 shared**：`jwt`（`signToken`）、`password`（`verifyPassword`）、`db`（`queryFirst`）、`errors`、`response`（`ok`）、`validate`、`middleware/rateLimiter`（`createRateLimiter`）。
- **注册**：`registry.register(authModule)`

#### init 模块

- **模块名 / 挂载路径**：`init` / `/`（路由内部定义 `/init`，完整路径 `POST /init`）
- **职责**：初始化聚合接口，一次请求返回前端首屏所需的全部数据：`panelData` + `about`（站点信息）+ `authInfo`（当前用户）+ `searchEngine`（搜索引擎配置）。
- **路由**：
  - `POST /init` —— 挂载 `publicModeMiddleware`（公开访问模式可用）；响应头 `Cache-Control: private, max-age=60, stale-while-revalidate=300`。
- **文件结构**：`index.ts` / `routes.ts` / `service.ts` / `validator.ts` / `types.ts`
- **Service**：`InitService` —— `aggregate(user)`，内部组合 `PanelService` + `SettingsService` + `UserConfigService`。
- **跨模块组合**：`routes.ts` 实例化并注入三个兄弟模块的 Service 类（`PanelService` / `SettingsService` / `UserConfigService`）以聚合数据（详见「模块间通信规则」）。
- **注册**：`registry.register(initModule)`

#### panel 模块

- **模块名 / 挂载路径**：`panel` / `/panel`
- **职责**：面板核心模块。统一获取全部数据（分组 + 图标 + 用户配置），并拆分为 `itemIcon`（图标与站点元数据抓取）和 `itemIconGroup`（分组管理）两个子路由。
- **模块级中间件**：`router.use('*', publicModeMiddleware)` —— 整个 `/panel/*` 启用公开访问模式。
- **路由**：
  - `POST /panel/getAllData` —— 聚合查询（分组 + 所有图标 + 用户配置），替代 N+1 次请求；`private, max-age=30, stale-while-revalidate=60`。
  - 子路由 `/panel/itemIcon/*`（来自 `item-icon/routes.ts`）：
    - `POST /panel/itemIcon/getListByGroupId`
    - `POST /panel/itemIcon/getSiteFavicon` —— **SSRF 白名单唯一例外**：服务端抓取目标站点 HTML，解析 favicon link 与站点元数据，受 `isValidUrl` 约束，3s 超时，`cf: { cacheTtl: 3600 }` 边缘缓存。
    - `POST /panel/itemIcon/addMultiple` / `edit` / `deletes` / `saveSort`（访客模式 `visitMode === 1` 拒绝修改）
  - 子路由 `/panel/itemIconGroup/*`（来自 `group/routes.ts`）：
    - `POST /panel/itemIconGroup/getList`
    - `POST /panel/itemIconGroup/edit` / `deletes` / `saveSort`（访客模式拒绝修改；`deletes` 级联删除图标）
- **文件结构**：`index.ts` / `routes.ts` / `service.ts` / `validator.ts` / `types.ts`，外加子目录 `item-icon/routes.ts`、`group/routes.ts`
- **Service**：`PanelService` —— `getAllData`、`getIconsByGroupId`、`getSiteFavicon`、`addMultipleIcons`、`editIcon`、`deleteIcons`、`saveIconSort`、`getGroupList`、`editGroup`、`deleteGroups`、`saveGroupSort`。
- **依赖 shared**：`middleware/auth`（`getAuthUser`）、`validate`、`response`、`favicon`（`isValidUrl`）等。
- **注册**：`registry.register(panelModule)`

#### user-config 模块

- **模块名 / 挂载路径**：`user-config` / `/panel/userConfig`
- **职责**：用户配置管理，包含 panel 布局配置与 searchEngine 搜索引擎配置两块。
- **路由**：
  - `POST /panel/userConfig/get` —— 获取用户配置（公开模式可读）。
  - `POST /panel/userConfig/set` —— 保存用户配置（公开模式挂载，但访客 `visitMode === 1` 只读，返回 403）；`validate(userConfigSchema)`。
- **文件结构**：`index.ts` / `routes.ts` / `service.ts` / `validator.ts` / `types.ts`
- **Service**：`UserConfigService` —— `get(userId)`、`set(userId, panelJson, searchEngineJson)`。
- **依赖 shared**：`middleware/auth`（`publicModeMiddleware`、`getAuthUser`）、`validate`、`response`。
- **注册**：`registry.register(userConfigModule)`

#### users 模块（两个 ModuleDefinition）

users 模块导出**两个**模块定义，分别承担管理员与个人两条路由线：

1. **usersAdminModule**
   - **模块名 / 挂载路径**：`users-admin` / `/panel/users`
   - **职责**：管理员用户管理 CRUD + 公开访问用户配置。
   - **路由**（均 `authMiddleware` + `adminMiddleware`）：
     - `POST /panel/users/getList` —— 分页列表
     - `POST /panel/users/create` —— 创建用户（管理员后台创建，**无公开注册**）
     - `POST /panel/users/update` —— 更新用户
     - `POST /panel/users/deletes` —— 批量删除（排除当前登录用户）
     - `POST /panel/users/getPublicVisitUser` —— 获取公开访问用户
     - `POST /panel/users/setPublicVisitUser` —— 设置/取消公开访问用户
   - **注册**：`registry.register(usersAdminModule)`

2. **userSelfModule**
   - **模块名 / 挂载路径**：`user-self` / `/user`
   - **职责**：当前登录用户的个人信息与密码管理。
   - **路由**：
     - `POST /user/getAuthInfo` —— 获取当前用户信息（`publicModeMiddleware`）
     - `POST /user/updateInfo` —— 修改昵称（`authMiddleware`）
     - `POST /user/updatePassword` —— 修改密码（`authMiddleware`）
   - **注册**：`registry.register(userSelfModule)`

- **文件结构**（共享）：`index.ts`（导出两个 `ModuleDefinition`）/ `routes.ts`（导出 `adminRouter` + `selfRouter`）/ `service.ts` / `validator.ts` / `types.ts`
- **Service**：`UserService` —— `getList`、`adminCreate`、`adminUpdate`、`adminDelete`、`getUserInfo`、`updateName`、`updatePassword` 等。
- **跨模块组合**：管理员路由中 `getPublicVisitUser` / `setPublicVisitUser` 通过 `SettingsService` 读写公开访问用户配置（详见「模块间通信规则」）。
- **依赖 shared**：`middleware/auth`（`authMiddleware`、`adminMiddleware`、`publicModeMiddleware`、`getAuthUser`）、`validate`、`response`。

#### settings 模块

- **模块名 / 挂载路径**：`settings` / `/`（路由内部定义 `/system/...` 与 `/about`，完整路径见下）
- **职责**：系统设置（站点标题、favicon、登录页背景、logo、页脚 HTML、公开访问用户等键值对配置）。
- **路由**：
  - `POST /system/setting/get` —— 获取单个设置（公开，登录页可用）
  - `POST /system/setting/set` —— 保存单个设置（`authMiddleware` + `adminMiddleware`）
  - `POST /system/settings/saveAll` —— 批量保存设置（`authMiddleware` + `adminMiddleware`）
  - `GET /about` 与 `POST /about` —— 获取全部设置（公开；GET 免 CSRF，更适合登录页；`public, max-age=300, stale-while-revalidate=600`，CDN `no-cache`）
- **文件结构**：`index.ts` / `routes.ts` / `service.ts` / `validator.ts` / `types.ts`
- **Service**：`SettingsService` —— `get`、`set`、`saveAll`、`getAll`、`getPublicVisitUser`、`setPublicVisitUser`。
- **依赖 shared**：`middleware/auth`、`validate`、`response`。
- **注册**：`registry.register(settingsModule)`

#### shared（非注册模块）

- **职责**：共享工具与中间件集合，是模块间**唯一**的通信通道（与共享类型一起）。本身不注册到 `ModuleRegistry`，由各模块按需 import。
- **共享工具文件**（`src/modules/shared/`）：
  - `db.ts` —— D1 查询封装（如 `queryFirst`）
  - `env.ts` —— 环境变量校验（`validateEnv`，未配置 `JWT_SECRET` 启动失败）
  - `errors.ts` —— `AppError` 统一错误类（含 code / httpStatus）
  - `favicon.ts` —— `isValidUrl`（SSRF 防护：屏蔽 localhost / 回环 / 私网段 10.x、172.16-31、192.168、169.254、0.x）、favicon 候选解析
  - `jwt.ts` —— `signToken` / `verifyToken`
  - `logger.ts` —— 日志
  - `origin.ts` —— Origin 处理
  - `password.ts` —— `verifyPassword` 等密码工具
  - `response.ts` —— `ok` / `fail` 统一响应
  - `searchEngine.ts` —— 搜索引擎配置工具
  - `types.ts` —— 共享类型（`AuthUser`、`UserRow` 等）
  - `validate.ts` —— `validate` 中间件（基于 Zod，将校验结果写入 `c.var.validatedBody`）
- **中间件**（`src/modules/shared/middleware/`）：
  - `auth.ts` —— `authMiddleware`（登录鉴权）、`publicModeMiddleware`（公开访问模式，注入访客或登录用户）、`adminMiddleware`（管理员校验）、`getAuthUser`（读取 `c.var.authUser`）
  - `bodyLimit.ts` —— 请求体大小限制
  - `cors.ts` —— CORS
  - `csrf.ts` —— CSRF 防护（全局启用，不得绕过）
  - `rateLimiter.ts` —— `createRateLimiter` 限流工厂
  - `securityHeaders.ts` —— 安全响应头

## 前端模块架构

### 核心约定

- 每个业务模块 `frontend/src/modules/<name>/` 含 `api.ts`（API 调用封装）+ `types.ts`（类型定义）。
- 业务模块统一从 `@/modules` 导入，**不直接 deep import**。
- 页面（`frontend/src/views/`）与 store（`frontend/src/store/modules/`）消费业务模块。
- 后端 `types.ts` 与前端 `types.ts` 应保持一致的字段定义；后端 API 形状变更时必须同步前端类型。
- HTTP 请求统一走 `@/utils/request` 的 `get` / `post`。

### 前端模块清单

前端模块统一导出于 `frontend/src/modules/index.ts`。

#### auth 模块

- **职责**：登录认证 API。
- **文件**：`api.ts` / `types.ts`
- **API**：
  - `login(username, password)` → `POST /login`，返回 `LoginResponse`（token + userInfo）

#### panel 模块

- **职责**：面板数据 API（分组、图标、站点 favicon），并定义搜索引擎相关共享类型。
- **文件**：`api.ts` / `types.ts`
- **API**：
  - `getAllData()` → `POST /panel/getAllData`（聚合查询）
  - 分组：`getGroupList` → `/panel/itemIconGroup/getList`、`saveGroup` → `/panel/itemIconGroup/edit`、`deleteGroups` → `/panel/itemIconGroup/deletes`、`saveGroupSort` → `/panel/itemIconGroup/saveSort`
  - 图标：`addItems` → `/panel/itemIcon/addMultiple`、`editItem` → `/panel/itemIcon/edit`、`deleteItems` → `/panel/itemIcon/deletes`、`saveItemSort` → `/panel/itemIcon/saveSort`、`getSiteFavicon` → `/panel/itemIcon/getSiteFavicon`
- **类型**：`AllDataResponse`、`ItemIconGroup`、`ItemInfo`、`SiteFaviconResponse`、`SortItemRequest`、`ItemIconSortRequest`、`SearchEngine` / `SearchEngineConfig` 等。

#### users 模块

- **职责**：用户配置与用户管理 API（含个人与管理员两类）。
- **文件**：`api.ts` / `types.ts`
- **API**：
  - 用户配置：`setUserConfig` → `POST /panel/userConfig/set`
  - 个人：`updateUserInfo` → `/user/updateInfo`、`updatePassword` → `/user/updatePassword`
  - 管理员：`getUserList` → `/panel/users/getList`、`createUser` → `/panel/users/create`、`updateUser` → `/panel/users/update`、`deleteUsers` → `/panel/users/deletes`
  - 公开访问用户：`getPublicVisitUser` → `/panel/users/getPublicVisitUser`、`setPublicVisitUser` → `/panel/users/setPublicVisitUser`
- **类型**：`UserFormData`、`UserConfig`、`UserListResponse`、`PublicVisitUserResponse` 等（`UserFormData` 从 `@/modules` 统一导出）。

#### settings 模块

- **职责**：系统设置与聚合初始化 API。
- **文件**：`api.ts` / `types.ts`
- **API**：
  - `getAbout()` → `GET /about?_t=<timestamp>`（带时间戳绕过 HTTP 缓存，登录页获取最新站点信息）
  - `saveSiteSettings(settings)` → `POST /system/settings/saveAll`
  - `getInit()` → `POST /init`（聚合初始化）
- **类型**：`AboutResponse`、`SiteSettings`、`SystemSetting`。
  > 注意：`AboutResponse` 含可选 `searchEngine?: SearchEngineConfig` 字段，**仅 `/init` 返回**，`/about` 不返回；`searchEngine` 类型从 `@/modules/panel/types` 复用。

## 模块间通信规则

- **禁止**：模块 A 不得 import 模块 B 的 `service.ts` / `validator.ts` / `routes.ts`（内部实现）。
- **允许**：
  1. import 共享类型（各模块 `types.ts`、`shared/types.ts`）；
  2. import 共享工具与中间件（`src/modules/shared/`）；
  3. 通过 HTTP API 调用其他模块。
- **现状说明（跨模块 Service 组合）**：当前代码库中存在两处通过实例化兄弟模块 Service 类来完成聚合/复用的情形，作为既有的组合方式保留：
  - `init` 模块在 `routes.ts` 中实例化 `PanelService` + `SettingsService` + `UserConfigService`（import 自各自 `service.ts`），注入 `InitService` 完成首屏聚合，避免额外的 HTTP 往返。
  - `users` 管理员路由中 `getPublicVisitUser` / `setPublicVisitUser` 复用 `SettingsService`（import 自 `settings/service.ts`）读写公开访问用户配置。
- **新增模块时**：优先通过共享类型 / 共享工具 / HTTP API 通信；如需跨模块复用 Service，应评估是否将该能力下沉到 `shared/` 或暴露为独立 API，避免直接 import 兄弟模块的 `service.ts`。
