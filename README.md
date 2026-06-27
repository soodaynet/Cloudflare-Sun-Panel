# Cloudflare-Sun-Panel

一个基于 Cloudflare Workers + D1 + Vue 3 的轻量级私有导航面板，支持多用户、图标分组管理、访客模式、主题切换。后端采用插件式模块化架构（Hono + ModuleRegistry），前端基于 shadcn-vue + Tailwind CSS 4 现代化 UI，一键部署到 Cloudflare，零服务器运维。

## 目录

- [项目架构](#项目架构)
- [环境要求](#环境要求)
- [前置条件](#前置条件)
- [快速开始（本地开发）](#快速开始本地开发)
- [部署到 Cloudflare](#部署到-cloudflare)
  - [1. 创建 D1 数据库](#1-创建-d1-数据库)
  - [2. 配置 wrangler.toml](#2-配置-wranglertoml)
  - [3. 初始化数据库](#3-初始化数据库)
  - [4. 构建前端](#4-构建前端)
  - [5. 部署 Worker](#5-部署-worker)
  - [6. 配置 JWT_SECRET](#6-配置-jwt_secret)
  - [7. 验证部署](#7-验证部署)
- [CI/CD 自动部署](#cicd-自动部署)
- [环境变量说明](#环境变量说明)
- [项目目录结构](#项目目录结构)
- [API 接口概览](#api-接口概览)
- [数据导入导出](#数据导入导出)
- [默认账号](#默认账号)
- [常见问题排查](#常见问题排查)
- [回滚策略](#回滚策略)
- [验证部署成功](#验证部署成功)
- [致谢](#致谢)
- [相关文档](#相关文档)

---

## 项目架构

```
浏览器 ──→ Cloudflare Worker (Hono)
               │
               ├── 全局中间件 (CORS → CSRF → SecurityHeaders → BodyLimit)
               │
               ├── 模块注册表 (ModuleRegistry)
               │   ├── /login          (auth 模块)
               │   ├── /init           (init 模块)
               │   ├── /panel/*        (panel + user-config + users 模块)
               │   ├── /user/*         (users 模块)
               │   ├── /system/*       (settings 模块)
               │   └── /about          (settings 模块)
               │       └── D1 数据库 (SQLite)
               │
               └── 静态资源 (Vue 3 SPA, History 模式) ── 由 Worker Assets 直接返回
```

- **后端**：TypeScript + [Hono](https://hono.dev/) ^4.7.8 运行于 Cloudflare Workers，插件式模块化架构（`src/modules/<name>/`）
- **数据库**：Cloudflare D1（SQLite 兼容），binding 名 `DB`，库名 `sun-panel-db`
- **前端**：Vue 3 + Vite 6 + shadcn-vue + Reka UI + Tailwind CSS 4（CSS-first 配置）
- **认证**：JWT HMAC-SHA256（基于 Web Crypto API），Token 有效期 7 天
- **安全**：CSRF 防护、安全响应头、请求体大小限制（1MB）、登录频率限制；SSRF 合规化（受 `docs/ssrf-policy.md` 约束）、无公开注册
- **密码**：SHA-256 哈希存储

---

## 环境要求

| 工具 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | 24+ | 推荐 24 LTS |
| pnpm | 10.15.1+ | 包管理器（workspace monorepo） |
| Wrangler | 4+ | Cloudflare Workers CLI（随 devDependencies 安装） |
| Cloudflare 账户 | — | 需启用 Workers 与 D1 服务 |

---

## 前置条件

部署前请确保完成以下准备：

1. **注册 Cloudflare 账户**：[https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. **安装 Wrangler CLI 并登录**：

   ```bash
   pnpm add -g wrangler
   wrangler login
   ```

3. **获取 Cloudflare Account ID**：
   - 登录 Cloudflare Dashboard
   - 右侧边栏 → Workers & Pages → 复制 Account ID

4. **创建 Cloudflare API Token**：
   - 进入 [API Tokens 页面](https://dash.cloudflare.com/profile/api-tokens)
   - 创建令牌 → 使用「Edit Cloudflare Workers」模板
   - **重要**：权限中需额外添加 **D1 编辑权限**（`Account` → `D1` → `Edit`），否则 D1 初始化步骤将失败
   - 保存生成的 Token（只显示一次）

---

## 快速开始（本地开发）

```bash
# 克隆仓库
git clone <repo-url>
cd Cloudflare-Sun-Panel

# 安装依赖（根 + 前端，pnpm workspace）
pnpm install

# 创建 D1 数据库（首次）
wrangler d1 create sun-panel-db
# 将返回的 database_id 写入 wrangler.toml（替换 __D1_DATABASE_ID__）

# 初始化本地数据库
pnpm run db:init:local

# 配置 JWT_SECRET（本地开发）
echo "your-dev-secret" | wrangler secret put JWT_SECRET --local
# 或创建 .dev.vars 文件：JWT_SECRET=your-dev-secret

# 启动后端（端口 8787）
pnpm dev

# 另一个终端启动前端（端口 3000，代理 /api 到 8787）
pnpm --filter sun-panel-frontend run dev

# 访问 http://localhost:3000
# 默认管理员：admin / admin
```

前端 API 请求会通过 Vite 代理转发到本地 Worker（`localhost:8787`）。

---

## 部署到 Cloudflare

### 1. 创建 D1 数据库

```bash
wrangler d1 create sun-panel-db
```

执行后会输出类似：

```
✅ Successfully created DB 'sun-panel-db' in region APAC
[[d1_databases]]
binding = "DB"
database_name = "sun-panel-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

记下 `database_id`。

### 2. 配置 wrangler.toml

编辑项目根目录的 `wrangler.toml`，将 `__D1_DATABASE_ID__` 替换为上一步获取的 `database_id`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "sun-panel-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # 替换这里
```

> 若使用 GitHub Actions 自动部署，可保持 `__D1_DATABASE_ID__` 占位符不动，CI 会通过 Secret `CF_D1_DATABASE_ID` 自动 `sed` 注入。

### 3. 初始化数据库

```bash
pnpm run db:init
# 等价于 wrangler d1 execute sun-panel-db --remote --file=./schema.sql
```

这将在远程 D1 数据库中创建所有表、索引以及默认管理员账号（`admin` / `admin`）。

### 4. 构建前端

```bash
pnpm --filter sun-panel-frontend run build
```

构建产物位于 `frontend/dist/`，包含 `vue-tsc` 类型检查与 `vite build`。

### 5. 部署 Worker

```bash
pnpm run deploy
# 等价于 wrangler deploy
```

部署完成后，Worker 会提供一个 `*.workers.dev` 域名（或你自定义的域名），同时前端静态资源也由 Worker 一并托管（`[assets]` 绑定 + SPA 回退）。

### 6. 配置 JWT_SECRET

JWT 签名密钥必填，**未配置则 Worker 启动失败**（提示 `JWT_SECRET is required`）。通过 wrangler CLI 配置一次后即可在 Worker 上持久化：

```bash
# 生成随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 配置 Cloudflare Workers Secret
wrangler secret put JWT_SECRET
# 粘贴上一步生成的密钥
```

> 该 Secret 亦由 CI 在每次部署时自动同步（见 `.github/workflows/deploy-worker.yml` 的「Sync JWT_SECRET」步骤），亦可手动 `wrangler secret put JWT_SECRET` 配置一次。

### 7. 验证部署

```bash
# 健康检查
curl https://<your-worker>.workers.dev/api/health
# 预期：{ "code": 0, "msg": "ok", "data": { "status": "running", "time": "..." } }

# 使用默认账号 admin / admin 登录
```

详见 [验证部署成功](#验证部署成功) 章节。

---

## CI/CD 自动部署

项目通过 GitHub Actions 实现持续集成与自动部署（位于 `.github/workflows/`）。

### 工作流

| 工作流文件 | 触发条件 | 执行内容 |
|-----------|---------|---------|
| `deploy-worker.yml` | 推送到 `main` 分支（排除 `.md`）或手动触发 | typecheck（后端 + 前端） → 前端 build → 注入 D1 database_id → `wrangler deploy` → D1 初始化（`continue-on-error: true`） |
| `pr-check.yml` | 提交 PR 到 `main` 分支（排除 `.md`） | typecheck（后端 + 前端） → 前端 build → ESLint |

CI 环境固定使用 **pnpm 10.15.1 + Node.js 24**。

### 所需 GitHub Secrets

命名**不得**以 `GITHUB_` 开头（GitHub 保留前缀）：

| 名称 | 用途 |
|------|------|
| `CF_API_TOKEN` | Cloudflare API Token（Workers + D1 编辑权限） |
| `CF_ACCOUNT_ID` | Cloudflare Account ID |
| `CF_D1_DATABASE_ID` | D1 数据库 ID，CI 通过 `sed` 注入到 `wrangler.toml` 替换 `__D1_DATABASE_ID__` |
| `JWT_SECRET` | JWT 签名密钥，CI 部署时通过 `wrangler secret put` 同步到 Worker |

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中添加。

### 所需 Cloudflare Workers Secrets

通过 `wrangler secret put` 配置一次，在 Worker 上持久化，不通过 Actions 注入：

| 名称 | 必填 | 说明 |
|------|------|------|
| `JWT_SECRET` | ✅ | JWT 签名密钥，未配置则 Worker 启动失败 |

### 触发方式

- **自动触发**：推送到 `main` 分支时（排除 `.md` 文件）
- **手动触发**：GitHub 仓库 → Actions →「Deploy to Cloudflare」→「Run workflow」

---

## 环境变量说明

| 变量名 | 类型 | 必填 | 说明 | 配置方式 |
|--------|------|------|------|----------|
| `JWT_SECRET` | Cloudflare Workers Secret | 是 | JWT 签名密钥（HMAC-SHA256） | `wrangler secret put JWT_SECRET` |
| `CF_API_TOKEN` | GitHub Actions Secret | 是（CI） | Cloudflare API Token（Workers + D1 编辑权限） | GitHub 仓库 Settings → Secrets |
| `CF_ACCOUNT_ID` | GitHub Actions Secret | 是（CI） | Cloudflare Account ID | GitHub 仓库 Settings → Secrets |
| `CF_D1_DATABASE_ID` | GitHub Actions Secret | 是（CI） | D1 数据库 ID | GitHub 仓库 Settings → Secrets |

> **注意**：GitHub Secret 名称不得以 `GITHUB_` 开头（GitHub 保留前缀，会触发安全校验错误）。
>
> `wrangler.toml` 中的 `database_id = "__D1_DATABASE_ID__"` 为占位符，**不要**在仓库中硬编码真实 ID；CI 在部署时通过 `sed -i "s/__D1_DATABASE_ID__/${{ secrets.CF_D1_DATABASE_ID }}/g" wrangler.toml` 注入。

---

## 项目目录结构

```
Cloudflare-Sun-Panel/
├── .github/workflows/
│   ├── deploy-worker.yml               # 自动部署工作流（main 推送触发）
│   └── pr-check.yml                    # PR 检查工作流（typecheck + build + lint）
├── frontend/                           # Vue 3 前端（shadcn-vue + Tailwind 4）
│   ├── components.json                 # shadcn-vue 配置（style=new-york, baseColor=neutral）
│   ├── index.html
│   ├── vite.config.ts                  # Vite 6 配置（含 /api 代理到 8787）
│   ├── tsconfig.json
│   ├── package.json
│   └── src/
│       ├── main.ts、App.vue、env.d.ts
│       ├── components/
│       │   ├── ui/                     # shadcn-vue 生成组件（禁止修改源码）
│       │   │   └── button/input/card/dialog/form/select/table/dropdown-menu/switch/textarea/badge/sonner/label/slider
│       │   └── apps/Users/             # 用户管理组件（index.vue + EditUser/）
│       ├── modules/                    # 业务模块（每个含 api.ts + types.ts）
│       │   ├── auth/、panel/、users/、settings/
│       ├── views/                      # 页面
│       │   ├── home/                   # 主页（index.vue + components/ + composables/ + components/panels/）
│       │   ├── login/                  # 登录页（含 composables/useLoginPage.ts）
│       │   └── exception/404/
│       ├── hooks/                      # 组合式函数（useTheme）
│       ├── store/modules/              # Pinia store（app、auth、panel）
│       ├── locales/                    # i18n（zh-CN、en-US）
│       ├── router/                     # Vue Router（History 模式）
│       ├── lib/utils.ts                # cn helper（clsx + tailwind-merge）
│       ├── styles/                     # main.css（Tailwind 4 @theme 指令）、global.css
│       ├── utils/                      # 工具（request/axios、importExport、requestCache、storageKeys、faviconUtils）
│       └── typings/
├── src/                                # Cloudflare Worker 后端
│   ├── index.ts                        # Hono App 入口：全局中间件 + 模块注册表 + SPA 回退
│   └── modules/                        # 插件式模块化架构
    │   ├── types.ts                    # AppContext、AppBindings、ModuleDefinition 接口
    │   ├── registry.ts                 # ModuleRegistry 类（register/install/get/list）
    │   ├── shared/                     # 共享工具与中间件（模块间唯一通信通道）
    │   │   ├── jwt.ts                  # JWT 签名/验证（Web Crypto API）
    │   │   ├── env.ts                  # 环境变量校验（JWT_SECRET 必填）
    │   │   ├── db.ts、password.ts、validate.ts、origin.ts
    │   │   ├── response.ts、errors.ts、logger.ts
    │   │   └── middleware/             # cors、csrf、securityHeaders、bodyLimit、auth、rateLimiter
    │   ├── auth/                       # 登录模块（无注册）
    │   ├── init/                       # 初始化状态接口
    │   ├── panel/                      # 面板模块（item-icon、group 子模块 + getAllData 聚合）
    │   ├── user-config/                # 用户配置
    │   ├── users/                      # 用户管理（usersAdminModule + userSelfModule）
    │   └── settings/                   # 系统设置 + /about
    │   （每个模块自包含：index.ts / routes.ts / service.ts / validator.ts / types.ts）
├── schema.sql                          # D1 表结构 + 索引 + 默认管理员 admin/admin
├── wrangler.toml                       # Cloudflare Workers 配置（含密钥说明注释）
├── pnpm-workspace.yaml                 # pnpm workspace 定义
├── package.json                        # 根 workspace 配置
├── eslint.config.js                    # ESLint 配置
├── tsconfig.json
├── CLAUDE.md                           # 面向 Claude AI 助手的项目指引
├── AGENTS.md                           # 面向通用 AI Agent 的协作规范
└── README.md
```

---

## API 接口概览

所有 API 统一返回格式：

```json
{ "code": 0, "msg": "ok", "data": {} }
```

`code: 0` 表示成功，非 0 表示业务错误。

### 主要接口

| 路径 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/login` | POST | 无 | 用户登录，返回 JWT token |
| `/init` | POST | 公开模式 | 获取初始化状态与面板数据 |
| `/panel/getAllData` | POST | 公开模式 | 获取所有分组与图标 |
| `/panel/itemIcon/*` | POST | 公开模式 | 图标 CRUD（getListByGroupId / edit / deletes / saveSort / addMultiple 等） |
| `/panel/itemIconGroup/*` | POST | 公开模式 | 分组 CRUD（getList / edit / deletes / saveSort） |
| `/panel/userConfig/*` | POST | 公开模式 | 用户配置（get / set） |
| `/panel/users/*` | POST | 管理员 | 用户管理（getList / create / update / deletes / getPublicVisitUser / setPublicVisitUser） |
| `/user/*` | POST | 需登录 | 当前用户信息与密码（getAuthInfo / updateInfo / updatePassword） |
| `/system/*` | POST | 管理员 | 系统设置（setting/get、setting/set、settings/saveAll） |
| `/about` | POST | 无 | 获取站点信息（所有系统设置） |
| `/api/health` | GET | 无 | 健康检查 |

### 已移除接口

- **`/api/proxy-image`**（图片代理）—— 已移除，存在 SSRF 风险。如需外部图片，前端直连目标 URL 或公开 favicon 服务。
- **`/register`**（用户注册）—— 已移除，私有面板场景，用户由管理员后台通过 `/panel/users/create` 创建。

---

## 数据导入导出

项目支持 `.sun-panel.json` 文件的导入和导出，用于备份和迁移图标数据。**支持两种格式来源**的导入文件：

### 支持的文件来源

| 来源 | 文件命名示例 | `appName` | `type` 字段 | 附加字段 |
|------|-------------|-----------|------------|---------|
| **原始版本** — 作者原版 Sun-Panel v1.8.1 导出 | `SunPanel-Data202604121307.sun-panel.json` | `"Sun-Panel-Config"` | **无** | `appVersion`, `md5`, `cardStyle`, `lanUrl`, `cardType`, `backgroundColor`, `expandParam` |
| **Cloudflare Worker 版本** — 本项目导出 | `SunPanel-Data-202605280131.sun-panel.json` | `"Sun-Panel"` | `"sun-panel-export"` | —（精简格式） |

### 关键差异说明

- **原始版本**文件是 Sun-Panel 原作者发布的 v1.8.1 官方版本所导出的格式，包含较丰富的字段（如 `cardStyle`、`expandParam` 等），但缺少 `type` 标识字段。
- **Cloudflare Worker 版本**是本项目适配 Cloudflare Workers 平台后生成的精简格式，带有 `type: "sun-panel-export"` 字段便于识别。
- 导入功能已实现双路径校验逻辑：优先匹配 `type` 字段识别 Cloudflare Worker 版本，若无 `type` 字段则回退到 `appName` 匹配识别原始版本。两份文件均可正常导入。

### 使用方式

**导出数据：**

1. 登录管理面板
2. 点击右上角菜单 →「导出配置」
3. 系统将下载当前所有分组和图标的 `.sun-panel.json` 文件

**导入数据：**

1. 登录管理面板
2. 点击右上角菜单 →「导入配置」
3. 选择之前导出的 `.sun-panel.json` 文件
4. 系统将自动解析并创建对应的分组和图标（会保留现有数据，不会覆盖）

> **注意**：导入时原始版本文件中的部分字段（如 `lanUrl`、`cardStyle`、`expandParam` 等）因当前 Worker 版本不支持对应的 UI 特性，会被安全忽略，不影响图标 URL、标题等核心数据的导入。

---

## 默认账号

| 用户名 | 密码 | 角色 | 状态 |
|--------|------|------|------|
| `admin` | `admin` | 管理员（role=1） | 启用（status=1） |

- 密码哈希：SHA-256 `8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918`
- 该默认账号由 `schema.sql` 在 `users` 表为空时插入，仅用于首次登录。
- **首次登录后请立即修改密码**。
- 系统为私有面板，**不支持公开注册**，用户由管理员在后台通过 `/panel/users/create` 创建。

---

## 常见问题排查

### 1. 前端 API 请求 404

**现象**：登录或数据加载失败，浏览器控制台显示 404。

**排查步骤**：
- 检查 `frontend/.env.production` 中 `VITE_GLOB_API_URL` 是否为空（同域部署应为空）
- 验证 Worker 是否成功部署：访问 `https://<your-worker>.workers.dev/api/health`
- 本地开发时确保后端 `pnpm dev`（wrangler dev）正在运行
- 确认前端 Vite 代理（`vite.config.ts`）已将 `/api` 转发到 `localhost:8787`

### 2. 数据库查询失败

**现象**：API 返回 500，日志包含 D1 相关错误。

**排查步骤**：
- 确认 D1 数据库已创建且 `database_id` 在 `wrangler.toml` 中正确配置
- 执行 `pnpm run db:init` 初始化表结构
- 在 Cloudflare Dashboard → Workers & Pages → D1 中验证数据库是否存在
- 确认 `database_id` 占位符 `__D1_DATABASE_ID__` 已被替换为真实 ID

### 3. Worker 启动失败：JWT_SECRET is required

**现象**：Worker 部署后无法启动，日志提示 `JWT_SECRET is required`。

**原因**：`src/modules/shared/env.ts` 在启动时校验 `JWT_SECRET`，未配置则直接抛错。

**解决**：
```bash
wrangler secret put JWT_SECRET
# 粘贴一个长随机字符串（建议 32 字节以上）
```

### 4. CORS 错误

**现象**：浏览器控制台显示跨域错误。

**排查步骤**：
- 确认前端和后端在同一域名下（推荐方案）
- 如分域部署，需修改 `src/modules/shared/middleware/cors.ts` 中的 `Access-Control-Allow-Origin`

### 5. 登录后 token 失效

**现象**：登录成功后短时间内需要重新登录。

**排查步骤**：
- JWT 默认 7 天过期，检查系统时间是否正确
- 如果每次访问都需要重新登录，检查 localStorage 是否被清除
- 确认 `JWT_SECRET` 在 Worker 上已正确配置（未配置则启动失败，不会出现此问题）

### 6. 前端资源 404（直接访问子页面）

**现象**：直接访问 `/login` 等子页面返回 404。

**原因和解决**：前端使用 History 路由模式。`wrangler.toml` 中 `[assets]` 配置了 `not_found_handling = "single-page-application"`，所有非 API / 非静态资源请求会自动返回 `index.html`，由前端路由接管。

### 7. 构建失败

**现象**：`pnpm --filter sun-panel-frontend run build` 报错。

**排查步骤**：
```bash
# 清理后重新安装
pnpm install
pnpm --filter sun-panel-frontend run typecheck   # 先确认类型检查通过
pnpm --filter sun-panel-frontend run build
```

### 8. Wrangler 部署超时

**现象**：`pnpm run deploy` 长时间无响应。

**排查步骤**：
- 确认网络可访问 Cloudflare API
- 检查 `wrangler whoami` 是否已登录
- 尝试 `pnpm run deploy:dry`（`wrangler deploy --dry-run`）进行预检

---

## 回滚策略

### 方法 1：Git 版本回退

```bash
# 查看部署历史
git log --oneline -20

# 回退到指定提交
git revert <commit-hash>

# 推送后自动触发 CI 部署
git push origin main
```

### 方法 2：Wrangler 版本回滚

Cloudflare Workers 自动保留最近版本，可在 Dashboard 回滚：

1. 进入 Cloudflare Dashboard → Workers & Pages
2. 选择 `sun-panel` Worker
3. 点击「Deployments」标签
4. 找到目标版本，点击「rollback」

### 方法 3：手动重新部署指定版本

```bash
git checkout <tag-or-commit>
pnpm install
pnpm --filter sun-panel-frontend run build
pnpm run deploy
```

---

## 验证部署成功

部署完成后，按以下步骤验证：

### 1. 健康检查

```bash
curl https://<your-worker>.workers.dev/api/health
```

预期响应：
```json
{ "code": 0, "msg": "ok", "data": { "status": "running", "time": "2025-..." } }
```

### 2. 前端页面访问

浏览器打开 `https://<your-worker>.workers.dev`，应显示登录页面。

### 3. 登录验证

使用默认账号登录：
- 用户名：`admin`
- 密码：`admin`

登录成功后应跳转到主页（空白面板）。**首次登录后请立即修改密码**。

### 4. 功能验证清单

- [ ] 登录页正常显示，可登录
- [ ] 登录后显示主页，可正常退出
- [ ] 可添加、编辑、删除图标分组
- [ ] 可添加、编辑、删除图标
- [ ] 图标拖拽排序正常
- [ ] 风格设置可保存，刷新后不丢失
- [ ] 站点设置可保存（管理员）
- [ ] 用户管理功能正常（管理员）
- [ ] 访客模式功能正常
- [ ] 主题切换正常（浅色 / 深色 / 跟随系统）
- [ ] 语言切换正常（中文 / 英文）

### 5. 创建测试分组与图标

登录后在主页：
1. 点击「新增分组」，创建一个测试分组（如「常用工具」）
2. 在分组内点击「新增图标」，添加一个测试图标（如 GitHub → `https://github.com`）
3. 刷新页面，确认分组与图标已持久化

### 6. API 验证

```bash
# 验证登录
curl -X POST https://<your-worker>.workers.dev/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# 验证公开接口
curl -X POST https://<your-worker>.workers.dev/about \
  -H "Content-Type: application/json"
```

---

## 致谢

本项目基于以下优秀项目构建，特别感谢：

- **Sun-Panel** — [https://github.com/hslr-s/sun-panel](https://github.com/hslr-s/sun-panel) — 提供的优秀导航面板项目，本项目为其开源的 Cloudflare Workers 平台的适配版本。
- [Hono](https://hono.dev/) — 轻量级 Web 框架
- [Cloudflare Workers](https://workers.cloudflare.com/) + [D1](https://developers.cloudflare.com/d1/) — 边缘计算与 Serverless 数据库
- [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/) — 前端框架与构建工具
- [shadcn-vue](https://www.shadcn-vue.com/) + [Reka UI](https://reka-ui.com/) — 现代化 UI 组件方案
- [Tailwind CSS](https://tailwindcss.com/) — 原子化 CSS 框架

---

## 相关文档

- [CLAUDE.md](./CLAUDE.md) — 面向 Claude AI 助手的项目工作指引（架构约定、禁区清单、模块注册表说明）
- [AGENTS.md](./AGENTS.md) — 面向通用 AI Agent 的协作规范（模块边界、提交规范、PR 检查清单、安全实践）
- [`wrangler.toml`](./wrangler.toml) — Cloudflare Workers 配置（含密钥与路由说明注释）
- [`schema.sql`](./schema.sql) — D1 数据库表结构与默认数据
- [`.github/workflows/`](./.github/workflows/) — CI/CD 工作流
