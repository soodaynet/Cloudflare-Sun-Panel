# CLAUDE.md — Cloudflare-Sun-Panel 项目工作指引

> 本文档面向未来在本仓库工作的 AI 助手。请先通读全文再动手，严格遵守「禁区清单」与「模块注册表架构说明」两节。
>
> **重要提醒**：前端 pnpm 包名是 `sun-panel-frontend`（不是 `frontend`）。`pnpm --filter frontend ...` 会失败，必须用 `pnpm --filter sun-panel-frontend ...` 或 `cd frontend && pnpm run ...`。

---

## 1. 项目概述

Cloudflare-Sun-Panel（sun-panel）是一个基于 **Cloudflare Workers + D1 + Vue 3** 的个人导航面板应用。整体定位于「一键部署到 Cloudflare、零服务器运维的私有导航面板」：用户登录后可管理图标分组、自定义面板样式与搜索引擎，管理员可管理系统设置与用户。

---

## 2. 技术栈版本清单

### 后端（根 `package.json`，包名 `sun-panel-worker`）
| 依赖 | 版本 |
| --- | --- |
| hono | ^4.7.8 |
| zod | ^3.24.0 |
| @cloudflare/workers-types | ^4.20250605.0 |
| wrangler | ^4.0.0 |
| typescript | ^5.9.0 |
| @types/node | ^24.0.0 |
| eslint | ^10.4.1 |
| @eslint/js | ^10.0.1 |
| typescript-eslint | ^8.60.1 |
| eslint-plugin-vue | ^10.9.2 |
| vue-eslint-parser | ^10.4.1 |
| globals | ^17.6.0 |
| Node 运行时 | 24 |

### 前端（`frontend/package.json`，包名 `sun-panel-frontend`）
| 依赖 | 版本 |
| --- | --- |
| vue | ^3.5.13 |
| vite | ^6.0.6 |
| @vitejs/plugin-vue | ^5.2.1 |
| tailwindcss | ^4.0.0 |
| @tailwindcss/vite | ^4.0.0 |
| reka-ui | ^2.0.0 |
| shadcn-vue | 生成式组件（见 `components.json`，style=new-york, baseColor=neutral, iconLibrary=lucide） |
| class-variance-authority | ^0.7.0 |
| clsx | ^2.1.1 |
| tailwind-merge | ^2.5.0 |
| lucide-vue-next | ^0.460.0 |
| pinia | ^3.0.0 |
| vue-router | ^4.5.0 |
| vue-i18n | ^11.0.0 |
| typescript | ^5.8.0 |
| vue-tsc | ^2.2.0 |
| tw-animate-css | ^1.0.0 |
| axios | ^1.7.9 |
| vue-draggable-plus | ^0.6.0 |

> **生成组件与新 UI 库**：`frontend/src/components/ui/**` 为 shadcn-vue 生成代码，**允许修改视觉样式**（颜色/尺寸/间距/圆角/阴影/透明度/边框/过渡动画等），**不得**改动逻辑/props API/事件/插槽/a11y 语义；修改处须加中文注释 `// shadcn-vue 生成，本地修改：<说明>`，并在 `/workspace/MODIFICATIONS.md` 登记。如需引入新 UI 库（含 naive-ui / dompurify / unplugin-vue-components 等），须在 PR 说明中给出明确理由，并在 `/workspace/MODIFICATIONS.md` 登记。

### 数据库与认证
- **数据库**：Cloudflare D1（SQLite 兼容），binding 名 `DB`，库名 `sun-panel-db`。**D1 是唯一持久化存储**。
- **认证**：JWT HMAC-SHA256，基于 Web Crypto API 实现（`src/modules/shared/jwt.ts`），Token 有效期 7 天。
- **包管理**：pnpm 10.15.1，workspace monorepo（根 + `frontend/`，见 `pnpm-workspace.yaml`）。
- **CI/CD**：GitHub Actions（`.github/workflows/pr-check.yml` + `deploy-worker.yml`）。

---

## 3. 目录结构

```
/workspace
├── src/                                # 后端 Cloudflare Worker
│   ├── index.ts                        # Hono App 入口：全局中间件 + 模块注册表 + SPA 回退
│   ├── modules/                        # 插件式模块化架构
│   │   ├── types.ts                    # AppContext、AppBindings、ModuleDefinition 接口
│   │   ├── registry.ts                 # ModuleRegistry 类（register/install/get/list）
│   │   ├── shared/                     # 共享工具与中间件（模块间唯一通信通道）
│   │   │   ├── jwt.ts                  # JWT 签名/验证（Web Crypto API）
│   │   │   ├── env.ts                  # 环境变量校验（JWT_SECRET 必填）
│   │   │   ├── db.ts、password.ts、validate.ts、origin.ts
│   │   │   ├── response.ts、errors.ts、logger.ts、favicon.ts
│   │   │   ├── types.ts                # 共享类型：UserRow、AuthUser、ApiResponse 等
│   │   │   └── middleware/             # cors、csrf、securityHeaders、bodyLimit、auth、rateLimiter
│   │   ├── auth/                       # 登录模块（无注册接口）
│   │   ├── init/                       # 初始化状态接口
│   │   ├── panel/                      # 面板模块（item-icon、group 子模块 + getAllData 聚合）
│   │   ├── user-config/                # 用户配置
│   │   ├── users/                      # 用户管理（usersAdminModule + userSelfModule）
│   │   └── settings/                   # 系统设置
│   │   （每个模块自包含：index.ts/routes.ts/service.ts/validator.ts/types.ts）
│   └── （旧 routes/、services/、utils/、middleware/、validators/、models/ 历史目录，保留以备参考）
├── frontend/                           # Vue 3 前端（pnpm 包名：sun-panel-frontend）
│   ├── package.json、vite.config.ts、tsconfig.json、components.json
│   ├── src/
│   │   ├── main.ts、App.vue、env.d.ts
│   │   ├── components/ui/              # shadcn-vue 生成组件（视觉样式可改，见 §5）
│   │   ├── modules/                    # 业务模块（auth/panel/users/settings，每个含 api.ts + types.ts）
│   │   ├── views/                      # 页面（login/home/exception 等）
│   │   ├── hooks/                      # 组合式函数（useTheme 等）
│   │   ├── store/modules/              # Pinia store（app、auth、panel）
│   │   ├── locales/                    # i18n（zh-CN、en-US）
│   │   ├── router/、lib/utils.ts（cn helper）
│   │   ├── styles/main.css（Tailwind 4 @theme 指令）、global.css
│   │   ├── utils/                      # 工具函数（faviconUtils、importExport、requestCache、storageKeys 等）
│   │   └── （旧 api/ 目录，历史保留以备参考）
├── .github/workflows/
│   ├── pr-check.yml                    # PR 检查（typecheck + build + lint，pnpm 10.15.1 + Node 24）
│   └── deploy-worker.yml               # 推送 main 自动部署
├── schema.sql                          # D1 表结构 + 默认管理员 admin/admin
├── wrangler.toml                       # Cloudflare Workers 配置（database_id 占位符）
├── eslint.config.js、tsconfig.json、pnpm-workspace.yaml
└── CLAUDE.md、AGENTS.md、README.md
```

---

## 4. 模块注册表架构说明

### 核心约定

后端采用**插件式模块化架构**，所有业务逻辑以模块形式注册到全局 `ModuleRegistry`。模块高内聚低耦合，模块间**不得**直接 import 其他模块的内部实现，仅通过 `shared/` 共享工具、共享类型（`types.ts`）、HTTP API 通信。

- **模块目录**：每个模块位于 `src/modules/<name>/`，自包含 5 个文件：
  - `index.ts` — 导出 `ModuleDefinition` 对象（`name` / `mountPath` / `router` / `middlewares?`）
  - `routes.ts` — 定义该模块的 Hono 路由
  - `service.ts` — 业务逻辑（数据库操作、聚合查询等）
  - `validator.ts` — Zod 请求体/参数校验
  - `types.ts` — 模块内部类型定义
- **注册流程**：在 `src/index.ts` 中 `registry.register(module)` 注册，最后 `registry.install(app)` 一次性挂载。
- **挂载机制**：`registry.install(app)` 会先挂载模块级 `middlewares`（仅作用于 `mountPath/*`），再 `app.route(mountPath, router)` 挂载路由。
- **模块间通信**：模块**不得**引用彼此的 `service.ts` / `validator.ts` / `routes.ts`；只能通过 `shared/` 共享工具、共享类型（`types.ts`）、或 HTTP API 通信。
- **中间件分层**：
  - 全局中间件在 `src/index.ts` 顶部 `app.use('*', ...)` 挂载（cors / csrf / securityHeaders / bodyLimit）
  - 模块级中间件（如 `auth`）通过 `ModuleDefinition.middlewares` 挂载

### 新增后端模块步骤

1. 创建 `src/modules/<name>/`，实现 `index.ts` / `routes.ts` / `service.ts` / `validator.ts` / `types.ts`
2. 在 `index.ts` 中导出符合 `ModuleDefinition` 接口的对象：
   ```ts
   import type { ModuleDefinition } from '../types'
   import { router } from './routes'
   import { authMiddleware } from '../shared/middleware/auth'

   export const fooModule: ModuleDefinition = {
     name: 'foo',
     mountPath: '/api/foo',
     router,
     middlewares: [authMiddleware], // 可选
   }
   ```
3. 在 `src/index.ts` 中 `import { fooModule } from './modules/foo'` 并 `registry.register(fooModule)`
4. 校验逻辑放 `validator.ts`，业务逻辑放 `service.ts`，路由层只做参数解析、调用 service、统一响应
5. 同步更新前端 `frontend/src/modules/<name>/types.ts`（如有 API 形状变更）

### 关键接口（`src/modules/types.ts`）

> **重要**：`Variables` 字段为 `{ authUser?, validatedBody? }`。认证用户通过 `c.var.authUser` 访问，校验后的请求体通过 `c.var.validatedBody` 访问。**不要**使用 `c.get('userId')` / `c.get('username')` / `c.get('role')` / `c.get('isPublicMode')` 等旧字段——它们不存在。

```ts
import type { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { D1Database, Fetcher } from '@cloudflare/workers-types'
import type { AuthUser } from './shared/types'

// 应用环境变量绑定
export interface AppBindings {
  DB: D1Database
  ASSETS: Fetcher
  JWT_SECRET: string
}

// 应用上下文（Hono 上下文泛型）
export interface AppContext {
  Bindings: AppBindings
  Variables: {
    // 认证用户（由 auth 中间件注入）
    authUser?: AuthUser
    // 校验后的请求体（由 validate 中间件注入）
    validatedBody?: unknown
  }
}

// 模块定义接口
export interface ModuleDefinition {
  name: string
  mountPath: string
  router: Hono<AppContext>
  middlewares?: MiddlewareHandler<AppContext>[]
}
```

### AuthUser 类型（`src/modules/shared/types.ts`）

```ts
export interface AuthUser {
  userId: number
  username: string
  name: string
  role: number       // 1=管理员
  visitMode: number  // 0=登录, 1=公开/访客
}
```

### 认证用户访问模式

```ts
import { getAuthUser } from '../shared/middleware/auth'
// 方式一：辅助函数
const user = getAuthUser(c) // AuthUser | null
// 方式二：直接读 context
const user = c.var.authUser
const userId = c.var.authUser?.userId

// 校验后的请求体
const body = c.var.validatedBody as CreateFooInput
```

### 中间件清单（`src/modules/shared/middleware/`）
- `authMiddleware` — 登录鉴权，从 Authorization header 解析 JWT，写入 `c.var.authUser`
- `publicModeMiddleware` — 公开/访客模式，无 token 时使用公开访问账号
- `adminMiddleware` — 管理员鉴权，需先通过 `authMiddleware`，校验 `role === 1`
- `csrfMiddleware`、`corsMiddleware`、`securityHeadersMiddleware`、`bodyLimitMiddleware`、`rateLimiter`

---

## 5. 前端 shadcn-vue 约定

### UI 组件使用
- 组件位于 `frontend/src/components/ui/<name>/`，每个目录有 `index.ts` 统一导出
- 导入方式：`import { Button } from '@/components/ui/button'`
- `components.json` 配置：`style=new-york`、`baseColor=neutral`、`cssVariables=true`、`iconLibrary=lucide`、Tailwind CSS 指向 `src/styles/main.css`
- **允许修改视觉样式**：`frontend/src/components/ui/**` 下为 shadcn-vue 生成代码，**允许修改视觉样式**（颜色/尺寸/间距/圆角/阴影/透明度/边框/过渡动画等），**不得**改动逻辑/props API/事件/插槽/a11y 语义；修改处须加中文注释 `// shadcn-vue 生成，本地修改：<说明>`，并在 `/workspace/MODIFICATIONS.md` 登记。

### 新增 UI 组件
```bash
pnpm --filter sun-panel-frontend dlx shadcn-vue@latest add <name>
# 或
cd frontend && pnpm dlx shadcn-vue@latest add <name>
```

### 业务模块
- 位于 `frontend/src/modules/<name>/`，包含 `api.ts`（API 调用）+ `types.ts`（类型），统一从 `@/modules` 导入
- 已有模块：`auth` / `panel` / `users` / `settings`
- 后端 `types.ts` 与前端 `types.ts` 应保持一致的字段定义；后端 API 形状变更时**必须**同步更新前端 `types.ts`

### Toast 与对话框
- Toast 替代 Naive UI `useMessage`：
  ```ts
  import { toast } from '@/components/ui/sonner'
  toast.success('保存成功')
  toast.error('保存失败')
  ```
- 对话框使用 shadcn `Dialog`

### 主题
- 通过 CSS 变量 + `<html>` 上的 `dark` class 切换（见 `frontend/src/hooks/useTheme.ts`），不再依赖 store 驱动样式
- 支持 `light` / `dark` / `auto`（auto 跟随系统 `prefers-color-scheme`）
- Tailwind 4 使用 CSS-first 配置（`@theme` 指令），**无 `tailwind.config.js`**
- 关键 CSS 变量（玻璃拟态主题）：`--ann-blur`、`--ann-opacity`、`--glass-blur`、`--glass-bg-hover`、`--glass-border`

### 样式约束
- **禁止内联样式** `style="..."`；动态样式用 `:style="{ '--var': value }"` 绑定 CSS 变量
- **生成组件仅改视觉样式**：`frontend/src/components/ui/**` 可改视觉样式，不得改逻辑/props/a11y；修改须加注释并在 `/workspace/MODIFICATIONS.md` 登记

---

## 6. 常用命令

> **注意**：前端 pnpm 包名是 `sun-panel-frontend`，`pnpm --filter frontend ...` 会失败。

```bash
# ========== 后端开发 ==========
pnpm install                              # 安装依赖
pnpm run dev                              # wrangler dev（端口 8787）
pnpm run db:init:local                    # 初始化本地 D1
pnpm run typecheck                        # 后端 tsc --noEmit
pnpm run lint                             # ESLint
pnpm run format                           # Prettier 格式化
pnpm run format:check                     # Prettier 检查

# ========== 前端开发（包名 sun-panel-frontend）==========
pnpm --filter sun-panel-frontend run dev          # Vite dev（端口 3000，代理 /api 到 8787）
pnpm --filter sun-panel-frontend run typecheck    # vue-tsc --noEmit
pnpm --filter sun-panel-frontend run build        # 构建（含 vue-tsc 类型检查）
pnpm --filter sun-panel-frontend run build:fast   # 仅 vite build，跳过类型检查
# 等价写法：cd frontend && pnpm run dev/typecheck/build

# ========== 数据库 ==========
pnpm run db:init:local                    # 本地 D1 初始化（执行 schema.sql）
pnpm run db:init                          # 远程 D1 初始化
# wrangler d1 execute sun-panel-db --file=./schema.sql --local

# ========== 部署 ==========
pnpm run deploy                           # wrangler deploy
pnpm run deploy:dry                       # wrangler deploy --dry-run（预检）

# ========== Secret 管理 ==========
wrangler secret put JWT_SECRET            # 必填，未配置则 Worker 启动失败
wrangler secret put CF_API_TOKEN
wrangler secret put CF_ACCOUNT_ID
wrangler secret put CF_D1_DATABASE_ID

# ========== 提交前全套验证 ==========
pnpm run typecheck && pnpm --filter sun-panel-frontend run typecheck && pnpm run lint && pnpm --filter sun-panel-frontend run build
```

---

## 7. 密钥与变量管理

### Cloudflare Workers Secrets
| 名称 | 必填 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | ✅ 必填 | JWT 签名密钥，通过 `wrangler secret put JWT_SECRET` 配置；未配置时 `validateEnv` 抛错，Worker 启动失败并提示 `JWT_SECRET is required` |
| `CF_API_TOKEN` | 部署用 | Cloudflare API Token（Workers 编辑权限），通过 GitHub Actions Secret 注入 |
| `CF_ACCOUNT_ID` | 部署用 | Cloudflare Account ID，通过 GitHub Actions Secret 注入 |
| `CF_D1_DATABASE_ID` | 部署用 | D1 数据库 ID，CI 通过 `sed` 注入到 `wrangler.toml` |

### GitHub Actions Secrets
- 命名**不得**以 `GITHUB_` 开头（保留给 GitHub 内部使用）。
- 同名变量：`CF_API_TOKEN`、`CF_ACCOUNT_ID`、`CF_D1_DATABASE_ID`、`JWT_SECRET`。

### wrangler.toml 占位符
- `database_id = "__D1_DATABASE_ID__"` 保持占位符，**不得**在仓库中写入真实 ID。
- CI 在部署时通过 `sed -i "s/__D1_DATABASE_ID__/${{ secrets.CF_D1_DATABASE_ID }}/g" wrangler.toml` 注入真实值。

### 禁止
- 不得硬编码 `JWT_SECRET`、`CF_API_TOKEN`、`CF_ACCOUNT_ID`、`CF_D1_DATABASE_ID` 到源码。
- 不得在 `wrangler.toml` 写真实 `database_id`。

---

## 8. 默认管理员说明

- `schema.sql` 在 `users` 表为空时插入默认管理员：
  - 用户名：`admin`
  - 密码：`admin`
  - 密码哈希算法：**SHA-256**（仅用于首次登录），哈希值：`8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918`
  - 角色：`1`（管理员），状态：`1`（启用）
- **首次登录后必须立即修改密码**。
- 系统为私有面板，**无注册接口**，用户由管理员后台通过 `/panel/users/create` 创建。

---

## 9. 代码风格约定

- **TypeScript 严格模式**：`"strict": true`
- **Vue 单文件组件**：使用 `<script setup lang="ts">` 语法
- **类型导入**：使用 `import type { ... }` 导入类型
- **Conventional Commits**：`feat` / `fix` / `refactor` / `docs` / `chore` / `test` / `perf` / `style` / `ci`，scope 用模块名（`auth`/`panel`/`users`/`settings`/`user-config`/`init`/`frontend`/`backend` 等）
- **Lint 与格式化**：ESLint + Prettier（`.prettierrc`）
- **注释**：中文注释，标识符用英文
- **统一响应格式**：后端统一 `{ code: number, msg: string, data: T | null }`，`code: 0` 表示成功

提交信息示例：
```
feat(panel): 新增图标批量排序接口

支持在一次请求中保存多个图标的排序位置，减少网络往返。
```

---

## 10. 禁区清单

> 以下行为**严格禁止**，违反将破坏架构或引入安全风险。

- ❌ 不得硬编码 `JWT_SECRET`、`CF_API_TOKEN`、`CF_ACCOUNT_ID`、`CF_D1_DATABASE_ID` 到源码
- ❌ 不得新增未遵循 `docs/ssrf-policy.md` 规范的 SSRF 功能（URL 校验、超时、缓存等强制约束）——允许 SSRF 但必须合规
- ❌ 不得恢复用户公开注册接口（`/register`）——私有面板场景，用户由管理员后台创建
- ❌ 不得新增内联样式（`style="..."`）——动态样式用 `:style` 绑定 CSS 变量
- ❌ 不得跨模块直接引用其他模块的内部实现（`service.ts` / `validator.ts` / `routes.ts`）——只通过 `shared/`、共享类型、HTTP API 通信
- ❌ 不得修改 `frontend/src/components/ui/**` 生成组件的逻辑/props API/事件/插槽/a11y 语义（视觉样式可改，须加注释并在 `/workspace/MODIFICATIONS.md` 登记）
- ❌ 不得让 GitHub Secret 名称使用 `GITHUB_` 前缀（保留给 GitHub 内部）
- ❌ 不得在 `wrangler.toml` 写真实 `database_id`——保持 `__D1_DATABASE_ID__` 占位符
- ❌ **不得引入 KV / R2 / 其他数据库**——D1 是唯一持久化存储（session/缓存等临时数据可用内存或 `c.var` 上下文，但不得持久化到非 D1 存储）
- ❌ 不得绕过全局 `csrfMiddleware` / `authMiddleware` / `adminMiddleware`
- ❌ 不得主动删除已废弃的旧目录（`src/routes/`、`src/services/`、`src/validators/`、`src/utils/`、`src/middleware/`、`src/models/`、`frontend/src/api/`）——仅为向后兼容保留
- ❌ 不得给 `JWT_SECRET` 添加默认回退值——未配置时 Worker 必须启动失败

---

## 11. 测试与验证流程

### CI 工作流
- **PR 检查**（`.github/workflows/pr-check.yml`，pnpm 10.15.1 + Node 24）：触发于 PR 到 `main`，自动运行：
  1. 后端 typecheck（`pnpm run typecheck`）
  2. 前端 typecheck（`pnpm run typecheck`，working-directory=`./frontend`）
  3. 前端 build（`pnpm run build`，working-directory=`./frontend`）
  4. Lint（`pnpm run lint`）
- **部署**（`.github/workflows/deploy-worker.yml`）：触发于推送 `main`，自动：
  1. 后端 + 前端 typecheck
  2. 前端 build
  3. `sed` 注入 D1 database_id
  4. `wrangler deploy`（部署 Worker + 静态前端）
  5. `wrangler d1 execute --remote --file=./schema.sql`（D1 初始化，`continue-on-error: true`）

### 本地验证（提交前必跑）
```bash
pnpm run typecheck && pnpm --filter sun-panel-frontend run typecheck && pnpm run lint && pnpm --filter sun-panel-frontend run build
```

### 部署后验证
- 访问 `/api/health`，预期返回：
  ```json
  { "code": 0, "msg": "ok", "data": { "status": "running", "time": "<ISO8601>" } }
  ```
- 默认管理员登录验证：用户名 `admin`，密码 `admin`，登录后立即修改密码。

---

## 12. 常见任务示例

### 示例 A：新增一个后端 API 模块（以 `bookmark` 为例）

1. 创建 `src/modules/bookmark/`，包含 5 文件：
   - `types.ts`：定义 DTO 与 Zod schema 类型
   - `validator.ts`：
     ```ts
     import { z } from 'zod'
     export const createBookmarkSchema = z.object({
       title: z.string().min(1),
       url: z.string().url(),
     })
     ```
   - `service.ts`：
     ```ts
     import type { D1Database } from '@cloudflare/workers-types'
     export async function listBookmarks(db: D1Database, userId: number) {
       const { results } = await db.prepare('SELECT * FROM bookmarks WHERE user_id = ?').bind(userId).all()
       return results
     }
     ```
   - `routes.ts`：
     ```ts
     import { Hono } from 'hono'
     import type { AppContext } from '../types'
     import { authMiddleware } from '../shared/middleware/auth'
     import { getAuthUser } from '../shared/middleware/auth'
     import { listBookmarks } from './service'

     const router = new Hono<AppContext>()
     router.get('/', authMiddleware, async (c) => {
       const user = getAuthUser(c)
       const data = await listBookmarks(c.env.DB, user!.userId)
       return c.json({ code: 0, msg: 'ok', data })
     })
     export { router }
     ```
   - `index.ts`：
     ```ts
     import type { ModuleDefinition } from '../types'
     import { router } from './routes'
     import { authMiddleware } from '../shared/middleware/auth'

     export const bookmarkModule: ModuleDefinition = {
       name: 'bookmark',
       mountPath: '/api/bookmark',
       router,
       middlewares: [authMiddleware],
     }
     ```
2. 在 `src/index.ts` 中：
   ```ts
   import { bookmarkModule } from './modules/bookmark'
   registry.register(bookmarkModule)
   ```
3. 同步更新前端 `frontend/src/modules/bookmark/types.ts` 与 `api.ts`
4. 跑 `pnpm run typecheck && pnpm run lint`，提交时用 `feat(bookmark): 新增书签模块`

### 示例 B：新增一个前端页面（以 `/about` 为例）

1. 在 `frontend/src/views/about/index.vue` 创建页面组件（`<script setup lang="ts">`）
2. 在 `frontend/src/router/index.ts` 注册路由
3. 业务 API 放 `frontend/src/modules/<name>/api.ts`，类型放 `types.ts`，统一从 `@/modules` 导入
4. UI 组件从 `@/components/ui/*` 引入；Toast 用 `@/components/ui/sonner` 的 `toast`
5. 文案走 i18n：在 `frontend/src/locales/zh-CN.json` 与 `en-US.json` 补充 key
6. 需要状态管理时在 `frontend/src/store/modules/` 新增 Pinia store
7. 验证：`pnpm --filter sun-panel-frontend run typecheck && pnpm --filter sun-panel-frontend run build`

---

## 参考文档
- `README.md` — 项目说明
- `AGENTS.md` — 子代理协作指引（与本文件保持一致，两者互为补充）
- `docs/ssrf-policy.md` — SSRF 安全使用规范（URL 校验、超时、缓存等强制约束）
- `docs/dependencies.md` — 后端与前端依赖清单与用途说明
- `docs/modules.md` — 后端与前端模块结构与职责说明
- `wrangler.toml` — Cloudflare Workers 配置（含密钥与路由说明注释）
- `schema.sql` — D1 数据库表结构
- `.github/workflows/` — CI/CD 工作流
- `src/modules/types.ts` — AppContext / AppBindings / ModuleDefinition 权威定义
