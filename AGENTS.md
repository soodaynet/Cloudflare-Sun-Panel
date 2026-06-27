# AGENTS.md

面向通用 AI Agent 的 Cloudflare-Sun-Panel 协作规范。任何 AI 助手在本仓库工作前**必须**先读完本文档。

项目背景：基于 Cloudflare Workers + D1 + Vue 3 的个人导航面板，已完成插件式模块化架构重构 + shadcn-vue 前端现代化。

---

## ⚠️ 关键强调点（开工前必读）

1. **D1 唯一持久化存储，不得引入 KV/R2/其他数据库**。D1 binding 名为 `DB`，库名 `sun-panel-db`。session/缓存等临时数据可用内存或 `c.var` 上下文，但不得持久化到非 D1 存储。
2. **插件式模块化架构，每个模块高内聚低耦合，模块间不得直接 import 内部实现**。模块间通信只能通过共享类型、`src/modules/shared/`、或 HTTP API。
3. **前端包名是 `sun-panel-frontend`，`pnpm --filter frontend` 会失败**。必须用 `pnpm --filter sun-panel-frontend` 或 `cd frontend && pnpm run ...`。

---

## 1. AI Agent 协作总则

- **先读 spec**：开始任务前先读 `/workspace/.trae/specs/` 下相关 spec 文档，理解上下文与已定方案。
- **遵守模块边界**：不跨模块修改内部实现，只通过共享接口或 HTTP API 通信。
- **不跨层修改**：前端不直接调用后端 `service.ts`，后端不直接操作前端 store。
- **最小化修改**：只改完成任务所必需的文件，不做无关重构、不"顺手"优化。
- **模块化架构**：旧 `src/routes/`、`src/services/`、`src/validators/`、`src/utils/`、`src/middleware/`、`src/models/` 与 `frontend/src/api/` 目录已由 `src/modules/` 与 `frontend/src/modules/` 模块化架构取代，不再保留。
- **验证后提交**：提交前必须运行 `pnpm run typecheck` + `pnpm run lint` + `pnpm --filter sun-panel-frontend run build` 全部通过。
- **中文注释**：标识符用英文，注释用中文。
- **不创建文档**：除 `docs/` 下既定文档（`ssrf-policy.md`/`dependencies.md`/`modules.md` 等）外，**不得**主动创建 `.md` 文档。
- **生成组件可改（仅视觉样式）**：`frontend/src/components/ui/**` 是 shadcn-vue 生成代码，**允许修改视觉样式**（颜色/尺寸/间距/圆角/阴影/透明度/边框/过渡动画等），**不得**改动逻辑/props API/事件/插槽/a11y 语义。修改处须加中文注释 `// shadcn-vue 生成，本地修改：<说明>`，并在 `/workspace/MODIFICATIONS.md` 登记。
- **不假设依赖可用**：使用新库前先查 `package.json` / `frontend/package.json`，确认已安装。

---

## 2. 模块边界规则

### 后端模块自包含

每个后端模块目录 `src/modules/<name>/` 必须包含以下 5 个文件，且不依赖其他模块内部实现：

```
src/modules/<name>/
├── index.ts        # 注册入口：导出 ModuleDefinition
├── routes.ts       # Hono 路由
├── service.ts      # 业务逻辑
├── validator.ts    # Zod schema 校验
└── types.ts        # 类型定义
```

- 模块通过 `registry.register(module)` 注册，在 `src/index.ts` 中挂载。
- 新增模块**必须**在 `src/index.ts` 中 import 并 `registry.register()`。
- 模块间**不得**直接 import 其他模块的 `service.ts` / `validator.ts` / `routes.ts`。
- **AppContext.Variables 实际为 `{ authUser?, validatedBody? }`**（不是 userId/username/role 等）。中间件应往 `c.set('authUser', ...)` 或 `c.set('validatedBody', ...)` 写入，下游通过 `c.var.authUser` / `c.var.validatedBody` 读取。

### 前端模块自包含

每个前端业务模块 `frontend/src/modules/<name>/` 包含：

```
frontend/src/modules/<name>/
├── api.ts          # API 请求封装
└── types.ts        # 类型定义
```

- 业务模块统一从 `@/modules` 导入，不直接 deep import。
- 页面（`frontend/src/views/`）与 store（`frontend/src/store/modules/`）消费业务模块。

### UI 组件仅样式

- `frontend/src/components/ui/**` 是 shadcn-vue 生成代码（badge、button、card、dialog、form、input、select、table 等）。
- **允许修改视觉样式**（颜色/尺寸/间距/圆角/阴影/透明度/边框等），**不得**改动逻辑/props API/事件/插槽/a11y 语义；修改处加注释 `// shadcn-vue 生成，本地修改：<说明>` 并在 `/workspace/MODIFICATIONS.md` 登记。
- 新增基础组件用 `pnpm --filter sun-panel-frontend dlx shadcn-vue@latest add <name>` 生成。

### 跨层修改需谨慎

- 修改后端 API 形状（请求/响应字段）时，**必须**同步更新前端 `frontend/src/modules/<name>/types.ts`。
- 后端 `types.ts` 与前端 `types.ts` 应保持一致的字段定义。

### 共享代码位置

- 后端共享工具与中间件放 `src/modules/shared/`（如 `db.ts`、`env.ts`、`errors.ts`、`jwt.ts`、`response.ts`、`middleware/*`）。
- 前端共享工具放 `frontend/src/utils/`，组合式函数放 `frontend/src/hooks/`。

### 不跨模块直接引用

- 模块 A **不得** import 模块 B 的 `service.ts`。
- 模块间通信只能通过：共享类型（`types.ts`）、共享工具（`shared/`）、或 HTTP API。

---

## 3. 提交信息规范（Conventional Commits）

格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### type

`feat`（新功能）、`fix`（修复）、`refactor`（重构）、`docs`（文档）、`chore`（杂项）、`test`（测试）、`perf`（性能）、`style`（格式）、`ci`（CI 配置）

### scope（可选）

模块名：`auth`、`panel`、`users`、`settings`、`user-config`、`init`、`frontend`、`backend`、`docs`、`ci`

### 规则

- subject：简短描述，祈使语气，**不大写**开头，**不加**句号。
- body（可选）：详细说明，每行不超过 72 字符。
- footer（可选）：`BREAKING CHANGE` 说明、关联 issue。
- 破坏性变更在 type 后加 `!`，并在 footer 写明 `BREAKING CHANGE`。

### 示例

```
feat(panel): 新增图标批量排序接口

支持在一次请求中保存多个图标的排序位置，减少网络往返。
```

```
fix(auth)!: 移除 JWT_SECRET 默认值，未配置时启动失败

BREAKING CHANGE: 部署前必须配置 Cloudflare Secret `JWT_SECRET`，否则 Worker 启动失败。
```

```
refactor(frontend): 将用户管理表单迁移到 shadcn-vue Form
```

---

## 4. PR 检查清单

PR 合并前**必须**全部通过：

- [ ] `pnpm run typecheck`（后端 tsc）通过
- [ ] `pnpm --filter sun-panel-frontend run typecheck`（前端 vue-tsc）通过
- [ ] `pnpm run lint` 通过
- [ ] `pnpm --filter sun-panel-frontend run build` 构建成功
- [ ] 生成组件修改与新 UI 库引入已在 `/workspace/MODIFICATIONS.md` 登记
- [ ] 无新增内联样式（`style="..."`），动态 `:style` 绑定除外
- [ ] 无硬编码密钥、密码、ID
- [ ] 无图片代理相关代码（`proxy-image`、`/api/proxy`）
- [ ] 无用户注册相关代码（`/register`）
- [ ] 新增后端模块已在 `src/index.ts` 中正确 `registry.register()`
- [ ] 提交信息符合 Conventional Commits 规范
- [ ] 文档同步更新（如有 API 变更）

> CI 工作流 `.github/workflows/pr-check.yml`（pnpm 10.15.1 + Node 24）会自动校验 typecheck / build / lint，本地提交前应先跑一遍。

---

## 5. 依赖管理规则

- **Node 24 兼容**：仅升级到 Node 24 兼容的最新稳定版。
- **依赖位置**：后端依赖写在根 `package.json`，前端依赖写在 `frontend/package.json`。
- **包管理器**：统一使用 `pnpm@10.15.1`（workspace monorepo，根 + `frontend/`）。
- **可引入新 UI 库**：已使用 shadcn-vue + Reka UI v2 + Tailwind CSS 4；如需引入新 UI 库（含 naive-ui / dompurify / unplugin-vue-components 等），须在 PR 说明中给出明确理由，并在 `/workspace/MODIFICATIONS.md` 登记。
- **升级前验证基线**：升级依赖前先运行 `pnpm run typecheck && pnpm run lint` 确保基线通过。
- **新增依赖需理由**：新增依赖**必须**在 PR 说明中给出明确理由。
- **生成组件仅改视觉样式**：UI 组件由 `shadcn-vue` CLI 生成，可修改视觉样式（颜色/尺寸等），不得改逻辑/props/a11y；修改须加注释并在 `/workspace/MODIFICATIONS.md` 登记。

---

## 6. 安全实践

- **变量外置**：`JWT_SECRET`、`CF_API_TOKEN`、`CF_ACCOUNT_ID`、`CF_D1_DATABASE_ID` 全部通过 Cloudflare Secrets 或 GitHub Actions Secrets 管理，**不得**硬编码。
- **SSRF 规范化**：允许 SSRF 但必须遵循 `docs/ssrf-policy.md` 规范（URL 校验、超时、缓存、仅 GET、响应大小限制等强制约束）。如需外部图片，优先前端直连目标 URL 或公开 favicon 服务；服务端抓取须合规。
  - **现有合规端点**：`GET /api/favicon-proxy`（代理 google favicon 服务，校验 domain，30 天缓存）、`POST /panel/itemIcon/getSiteFavicon`（抓取目标站点 HTML 解析 favicon + 元数据，`isValidUrl` 校验，3s 超时，1 小时缓存）。新增 SSRF 端点必须在 PR 说明中引用 `docs/ssrf-policy.md` 并补充到合规清单。
- **无公开注册**：用户仅由管理员后台通过 `/panel/users/create` 创建，**不得**恢复 `/register` 接口。
- **JWT 必填**：未配置 `JWT_SECRET` 时 Worker 启动失败（`src/modules/shared/env.ts` 校验），**不得**添加默认回退值。
- **D1 唯一存储**：所有持久化数据存 Cloudflare D1（binding 名 `DB`，库名 `sun-panel-db`），**不得**引入 KV/R2/其他数据库。session/缓存等临时数据可用内存或 `c.var` 上下文，但不得持久化到非 D1 存储。
- **输入校验**：所有 API 入参用 Zod schema 校验（见各模块 `validator.ts`），**不得**直接信任请求体。
- **认证中间件**：受保护接口必须挂载 `authMiddleware`，管理员接口加 `adminMiddleware`（来自 `src/modules/shared/middleware/auth.ts`）。
- **CSRF 防护**：全局 `csrfMiddleware` 已启用（`src/index.ts`），**不得**绕过。
- **默认管理员**：`admin` / `admin` 仅用于首次登录，登录后立即修改密码。

---

## 7. 常见任务模式

### 7.1 新增后端 API

1. 在 `src/modules/<name>/` 下补全文件（如模块不存在则按 §2 创建）。
2. `types.ts` 定义请求/响应类型。
3. `validator.ts` 定义 Zod schema。
4. `service.ts` 实现业务逻辑（通过 `shared/db.ts` 操作 D1）。
5. `routes.ts` 挂载路由，受保护接口加 `authMiddleware` / `adminMiddleware`。
6. `index.ts` 导出 `ModuleDefinition`。
7. **新模块**需在 `src/index.ts` 中 `registry.register()`。
8. 同步更新前端 `frontend/src/modules/<name>/types.ts`。

### 7.2 新增前端页面

1. 在 `frontend/src/views/<name>/` 创建页面组件。
2. 业务请求走 `frontend/src/modules/<name>/api.ts`，类型从 `@/modules` 导入。
3. 需要状态管理时在 `frontend/src/store/modules/` 新增 Pinia store。
4. 路由在 `frontend/src/router/index.ts` 注册。
5. 组件优先复用 `frontend/src/components/ui/` 下的 shadcn-vue 组件。
6. 国际化文案同步写入 `frontend/src/locales/zh-CN.json` 与 `en-US.json`。

### 7.3 修复 Bug

1. 定位问题模块（后端 `src/modules/<name>/` 或前端 `frontend/src/modules/<name>/`）。
2. **最小化修改**：只改问题文件，不重构周边代码。
3. 提交信息用 `fix(<scope>): <描述>`。
4. 跑通 §4 检查清单后提交。

### 7.4 常用命令

```bash
# 后端开发
pnpm install                 # 安装依赖
pnpm run dev                 # 启动 wrangler dev（端口 8787）
pnpm run db:init:local       # 初始化本地 D1
pnpm run typecheck           # 后端类型检查
pnpm run lint                # ESLint
pnpm run format              # Prettier 格式化

# 前端开发（注意：前端包名是 sun-panel-frontend，pnpm --filter frontend 会失败）
pnpm --filter sun-panel-frontend run dev          # Vite dev（端口 3000）
pnpm --filter sun-panel-frontend run typecheck    # vue-tsc 类型检查
pnpm --filter sun-panel-frontend run build        # 构建（含类型检查）
# 或 cd frontend && pnpm run dev/typecheck/build

# 提交前全套验证
pnpm run typecheck && pnpm --filter sun-panel-frontend run typecheck && pnpm run lint && pnpm --filter sun-panel-frontend run build
```
