# 依赖清单

> 本文档列出 Cloudflare-Sun-Panel 项目所有依赖及其用途。新增依赖时必须同步更新本文档并说明理由。
> 包管理器：pnpm 10.15.1（workspace monorepo，根 + frontend/）

## 后端依赖（根 package.json，包名 sun-panel-worker）

### 运行时依赖（dependencies）

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| hono | ^4.7.8 | Cloudflare Workers 上的 Web 框架，提供路由、中间件、上下文（Context）等核心能力，是后端模块化架构的运行基座 |
| zod | ^3.24.0 | 运行时 schema 校验，用于所有 API 入参验证（见各模块 `validator.ts`），确保不直接信任请求体 |

### 开发依赖（devDependencies）

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| @cloudflare/workers-types | ^4.20250605.0 | Cloudflare Workers 运行时类型定义（D1Database、Fetcher、ExecutionContext 等），供 TypeScript 识别 Workers 全局类型 |
| wrangler | ^4.0.0 | Cloudflare Workers CLI，用于本地开发（`wrangler dev`）、部署（`wrangler deploy`）、D1 操作（`wrangler d1 execute`） |
| typescript | ^5.9.0 | TypeScript 类型系统，支撑后端 `tsc --noEmit` 类型检查 |
| @types/node | ^24.0.0 | Node.js 类型定义，供构建脚本与本地工具链使用 |
| eslint | ^10.4.1 | ESLint 代码检查核心，配合 `pnpm run lint` 检查 `.ts/.tsx/.vue` 文件 |
| @eslint/js | ^10.0.1 | ESLint 官方 JS 推荐配置（recommended config）的入口包 |
| typescript-eslint | ^8.60.1 | ESLint 的 TypeScript 解析与规则集（含 parser、plugin），支持 TS 代码 lint |
| eslint-plugin-vue | ^10.9.2 | ESLint 的 Vue 插件，提供 Vue SFC 模板与脚本规则 |
| vue-eslint-parser | ^10.4.1 | ESLint 的 Vue 单文件组件解析器，配合 eslint-plugin-vue 使用 |
| globals | ^17.6.0 | 全局变量定义库，供 ESLint 配置 `env` / `globals` 字段引用 |

### 运行时

- Node 24（CI 与本地开发统一）

## 前端依赖（frontend/package.json，包名 sun-panel-frontend）

### 运行时依赖（dependencies）

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| vue | ^3.5.13 | 前端框架，本项目使用 Vue 3 组合式 API |
| vue-router | ^4.5.0 | 前端路由库，负责 `frontend/src/router/` 路由注册与导航 |
| pinia | ^3.0.0 | Vue 状态管理库，对应 `frontend/src/store/modules/` 下的各业务 store |
| vue-i18n | ^11.0.0 | 国际化库，承载 `frontend/src/locales/zh-CN.json` 与 `en-US.json` 文案切换 |
| axios | ^1.7.9 | HTTP 客户端，封装于 `frontend/src/modules/<name>/api.ts` 与请求拦截器 |
| vue-draggable-plus | ^0.6.0 | 拖拽排序库，用于分组管理、搜索引擎排序等交互场景 |
| tailwindcss | ^4.0.0 | Tailwind CSS 4 框架，采用 CSS-first 配置（无 `tailwind.config.js`） |
| @tailwindcss/vite | ^4.0.0 | Tailwind CSS 4 的 Vite 插件，负责构建期 CSS 处理 |
| reka-ui | ^2.0.0 | 无样式（headless）Vue 组件库，作为 shadcn-vue 生成的底层依赖 |
| class-variance-authority | ^0.7.0 | 组件变体管理工具，shadcn-vue 通过 `cva` 定义组件样式变体 |
| clsx | ^2.1.1 | className 条件合并工具，与 `tailwind-merge` 一起构成 `cn` helper |
| tailwind-merge | ^2.5.0 | Tailwind class 合并去重工具，与 `clsx` 一起构成 `cn` helper |
| lucide-vue-next | ^0.460.0 | 图标库，作为 shadcn-vue 默认 iconLibrary，提供 Vue 组件形式图标 |

### 开发依赖（devDependencies）

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| vite | ^6.0.6 | 前端构建工具，承担 dev server 与生产构建 |
| @vitejs/plugin-vue | ^5.2.1 | Vite 的 Vue 插件，使 Vite 能编译 `.vue` 单文件组件 |
| typescript | ^5.8.0 | TypeScript 类型系统，支撑前端 `vue-tsc --noEmit` 类型检查 |
| vue-tsc | ^2.2.0 | Vue 类型检查工具（基于 Volar），用于 `pnpm run typecheck` 与构建前置检查 |

## 依赖管理规则

- Node 24 兼容：仅升级到 Node 24 兼容的最新稳定版
- 新增依赖必须在 PR 说明中给出明确理由，并同步更新本文档
- shadcn-vue 为生成式组件（见 `frontend/components.json`），其组件代码生成到 `frontend/src/components/ui/`，**不列入 package.json 依赖**；如需新增基础组件用 `pnpm --filter sun-panel-frontend dlx shadcn-vue@latest add <name>` 生成
- 生成组件仅允许修改视觉样式，逻辑/props API/事件/插槽/a11y 语义不得改动；修改须加注释并在 `/workspace/MODIFICATIONS.md` 登记
- 升级依赖前先运行 `pnpm run typecheck && pnpm run lint` 确保基线通过
- 后端依赖写在根 `package.json`，前端依赖写在 `frontend/package.json`，包管理器统一使用 `pnpm@10.15.1`
- 引入新 UI 库（含 naive-ui / dompurify / unplugin-vue-components 等）须在 PR 说明中给出明确理由，并在 `/workspace/MODIFICATIONS.md` 登记
