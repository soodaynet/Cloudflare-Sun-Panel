# Sun-Panel

一个基于 Cloudflare Workers + D1 + Vue 3 的轻量级个人导航面板，支持多用户、图标分组管理、访客模式、主题切换等功能。

## 目录

- [项目架构](#项目架构)
- [环境要求](#环境要求)
- [前置条件](#前置条件)
- [快速开始（本地开发）](#快速开始本地开发)
- [部署到 Cloudflare](#部署到-cloudflare)
  - [1. 创建 D1 数据库](#1-创建-d1-数据库)
  - [2. 配置 wrangler.toml](#2-配置-wranglertoml)
  - [3. 初始化数据库表](#3-初始化数据库表)
  - [4. 构建前端](#4-构建前端)
  - [5. 部署 Worker](#5-部署-worker)
  - [6. 设置 JWT 密钥（推荐）](#6-设置-jwt-密钥推荐)
- [CI/CD 自动部署](#cicd-自动部署)
- [环境变量说明](#环境变量说明)
- [项目目录结构](#项目目录结构)
- [API 接口概览](#api-接口概览)
- [常见问题排查](#常见问题排查)
- [回滚策略](#回滚策略)
- [验证部署成功](#验证部署成功)
- [默认账号](#默认账号)

---

## 项目架构

```
浏览器 ──→ Cloudflare Worker (Hono)
               │
               ├── API 路由 (/login, /panel/*, /user/*, /system/*)
               │      └── D1 数据库 (SQLite)
               │
               └── 静态资源 (Vue 3 SPA) ── 由 Worker Assets 直接返回
```

- **后端**: TypeScript + [Hono](https://hono.dev/) 运行在 Cloudflare Workers
- **数据库**: Cloudflare D1 (SQLite)
- **前端**: Vue 3 + Vite + Naive UI + Tailwind CSS
- **认证**: 自签名 JWT（HMAC-SHA256），7 天过期

---

## 环境要求

| 工具 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | ≥ 18 | 推荐 22+ |
| npm | ≥ 9 | 随 Node.js 附带 |
| Wrangler | ≥ 4.0 | Cloudflare Workers CLI (`npm install -g wrangler`) |
| Cloudflare 账号 | — | 需要开通 Workers 和 D1 服务 |

---

## 前置条件

部署前请确保完成以下准备：

1. **注册 Cloudflare 账号**：[https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. **安装 Wrangler CLI 并登录**：

   ```bash
   npm install -g wrangler
   wrangler login
   ```

3. **获取 Cloudflare Account ID**：
   - 登录 Cloudflare Dashboard
   - 右侧边栏 → Workers & Pages → 复制 Account ID

4. **创建 Cloudflare API Token**：
   - 进入 [API Tokens 页面](https://dash.cloudflare.com/profile/api-tokens)
   - 创建令牌 → 使用「Edit Cloudflare Workers」模板
   - 保存生成的 Token（只显示一次）

---

## 快速开始（本地开发）

```bash
# 1. 克隆项目
git clone <repository-url>
cd 1

# 2. 安装后端依赖
npm install

# 3. 安装前端依赖
cd frontend
npm install
cd ..

# 4. 初始化本地 D1 数据库
npm run db:init:local

# 5. 启动后端 (端口 8787)
npm run dev

# 6. 另开终端，启动前端 (端口 3000)
cd frontend
npm run dev
```

打开浏览器访问 `http://localhost:3000`，前端 API 请求会自动代理到 `localhost:8787`。

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

编辑项目根目录的 `wrangler.toml`，将 `__D1_DATABASE_ID__` 替换为上一步获取的 database_id：

```toml
[[d1_databases]]
binding = "DB"
database_name = "sun-panel-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # 替换这里
```

### 3. 初始化数据库表

```bash
npm run db:init
```

这将在远程 D1 数据库中创建所有表、索引和默认管理员账号。

### 4. 构建前端

```bash
cd frontend
npm install
npm run build
cd ..
```

构建产物位于 `frontend/dist/`。

### 5. 部署 Worker

```bash
npx wrangler deploy
```

部署完成后，Worker 会提供一个 `*.workers.dev` 域名（或你自定义的域名），同时前端静态资源也由 Worker 一起托管。

### 6. 设置 JWT 密钥（推荐）

为了安全，建议使用自定义 JWT 签名密钥：

```bash
# 生成随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 设置为环境变量
npx wrangler secret put JWT_SECRET
# 粘贴上一步生成的密钥

# 设置后重新部署
npx wrangler deploy
```

> 不设置 JWT_SECRET 将使用代码中的默认密钥，**生产环境强烈建议更换**。

---

## CI/CD 自动部署

项目已配置 GitHub Actions 工作流（`.github/workflows/deploy-worker.yml`），推送代码到 `main` 分支即可自动部署。

### 配置 GitHub Secrets

在 GitHub 仓库 → Settings → Secrets and variables → Actions 中添加以下 Secrets：

| Secret 名称 | 说明 |
|-------------|------|
| `CF_API_TOKEN` | Cloudflare API Token（需要 Workers 编辑权限） |
| `CF_ACCOUNT_ID` | Cloudflare Account ID |
| `CF_D1_DATABASE_ID` | D1 数据库 ID |

### 触发方式

- **自动触发**：推送到 `main` 分支时（排除 `.md` 文件）
- **手动触发**：在 GitHub Actions 页面点击「Run workflow」

### 工作流步骤

1. Checkout 代码
2. 安装后端和前端依赖
3. 构建前端（`vite build`）
4. 注入 D1 database_id 到 wrangler.toml
5. 部署 Worker + 静态资源
6. 初始化/同步数据库 Schema

---

## 环境变量说明

| 变量名 | 作用域 | 必填 | 说明 |
|--------|--------|------|------|
| `JWT_SECRET` | Worker Secret | 推荐 | JWT 签名密钥，长随机字符串 |
| `CF_API_TOKEN` | GitHub Actions | 是 (CI) | Cloudflare API 令牌 |
| `CF_ACCOUNT_ID` | GitHub Actions | 是 (CI) | Cloudflare 账户 ID |
| `CF_D1_DATABASE_ID` | GitHub Actions | 是 (CI) | D1 数据库 ID |

前端构建环境变量（`frontend/.env.production`）：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `VITE_GLOB_API_URL` | 否 | API 基础 URL，留空则与前端同域 |

---

## 项目目录结构

```
sun-panel/
├── .github/workflows/
│   └── deploy-worker.yml     # GitHub Actions 自动部署配置
├── frontend/                  # Vue 3 前端
│   ├── src/
│   │   ├── api/               # API 请求封装
│   │   ├── components/        # 公用组件
│   │   ├── hooks/             # 组合式函数 (useTheme, useLanguage)
│   │   ├── locales/           # 国际化 (zh-CN, en-US)
│   │   ├── router/            # Vue Router 配置
│   │   ├── store/             # Pinia 状态管理
│   │   ├── styles/            # 全局样式
│   │   ├── typings/           # TypeScript 类型声明
│   │   ├── utils/             # 工具函数 (axios, importExport)
│   │   ├── views/             # 页面组件
│   │   ├── App.vue
│   │   └── main.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
├── src/                       # Cloudflare Worker 后端
│   ├── middleware/             # 中间件 (auth, cors)
│   ├── models/                # 类型定义
│   ├── routes/                # 路由处理 (auth, panel, groups, users, settings)
│   ├── utils/                 # 工具函数 (jwt, password)
│   └── index.ts               # 入口文件
├── schema.sql                 # D1 数据库 DDL + 默认数据
├── wrangler.toml              # Cloudflare Workers 配置
├── package.json               # 根 workspace 配置
└── tsconfig.json
```

---

## API 接口概览

所有 API 统一返回格式：

```json
{ "code": 0, "msg": "ok", "data": {} }
```

| 路径 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/login` | POST | 无 | 用户登录，返回 JWT token |
| `/register` | POST | 无 | 用户注册 |
| `/user/getAuthInfo` | POST | 公开模式 | 获取当前认证信息和访客模式状态 |
| `/user/updateInfo` | POST | 需登录 | 更新昵称 |
| `/user/updatePassword` | POST | 需登录 | 修改密码 |
| `/panel/itemIconGroup/getList` | POST | 公开模式 | 获取分组列表 |
| `/panel/itemIconGroup/edit` | POST | 公开模式 | 新增/编辑分组（访客只读） |
| `/panel/itemIconGroup/deletes` | POST | 公开模式 | 删除分组及图标 |
| `/panel/itemIconGroup/saveSort` | POST | 公开模式 | 保存分组排序 |
| `/panel/itemIcon/getListByGroupId` | POST | 公开模式 | 获取分组下图标列表 |
| `/panel/itemIcon/addMultiple` | POST | 公开模式 | 批量添加图标 |
| `/panel/itemIcon/edit` | POST | 公开模式 | 新增/编辑图标 |
| `/panel/itemIcon/deletes` | POST | 公开模式 | 批量删除图标 |
| `/panel/itemIcon/saveSort` | POST | 公开模式 | 保存图标排序 |
| `/panel/userConfig/get` | POST | 公开模式 | 获取用户配置 |
| `/panel/userConfig/set` | POST | 公开模式 | 保存用户配置（访客只读） |
| `/panel/users/getList` | POST | 管理员 | 获取用户列表 |
| `/panel/users/create` | POST | 管理员 | 创建用户 |
| `/panel/users/update` | POST | 管理员 | 编辑用户 |
| `/panel/users/deletes` | POST | 管理员 | 删除用户 |
| `/panel/users/getPublicVisitUser` | POST | 管理员 | 获取公开访问用户 |
| `/panel/users/setPublicVisitUser` | POST | 管理员 | 设置/取消公开访问用户 |
| `/system/setting/get` | POST | 无 | 获取单个系统设置 |
| `/system/setting/set` | POST | 管理员 | 保存单个系统设置 |
| `/system/settings/saveAll` | POST | 管理员 | 批量保存系统设置 |
| `/about` | POST | 无 | 获取所有系统设置 |
| `/api/health` | GET | 无 | 健康检查 |

---

## 常见问题排查

### 1. 前端 API 请求 404

**现象**：登录或数据加载失败，浏览器控制台显示 404。

**排查步骤**：
- 检查 `frontend/.env.production` 中 `VITE_GLOB_API_URL` 是否为空（同域部署应为空）
- 验证 Worker 是否成功部署：访问 `https://<your-worker>.workers.dev/api/health`
- 本地开发时确保后端 `wrangler dev` 正在运行

### 2. 数据库查询失败

**现象**：API 返回 500，日志包含 D1 相关错误。

**排查步骤**：
- 确认 D1 数据库已创建且 `database_id` 在 `wrangler.toml` 中正确配置
- 执行 `npm run db:init` 初始化表结构
- 在 Cloudflare Dashboard → Workers & Pages → D1 中验证数据库是否存在

### 3. CORS 错误

**现象**：浏览器控制台显示跨域错误。

**排查步骤**：
- 确认前端和后端在同一域名下
- 如果分域部署，需修改 `src/middleware/cors.ts` 中的 `Access-Control-Allow-Origin`

### 4. 登录后 token 失效

**现象**：登录成功后短时间内需要重新登录。

**排查步骤**：
- JWT 默认 7 天过期，检查系统时间是否正确
- 如果每次访问都需要重新登录，检查 localStorage 是否被清除
- 确认 JWT_SECRET 在所有 Worker 实例中一致

### 5. 前端资源 404（直接访问子页面）

**现象**：刷新 `/login` 以外的页面返回 404。

**原因**和**解决**：前端使用 Hash 路由模式（`createWebHashHistory`），所有页面通过 `/#/path` 访问。Worker 已配置 SPA 回退逻辑，应返回 `index.html`。

### 6. 构建失败

**现象**：`npm run build` 报错。

**排查步骤**：
```bash
# 清理后重新安装
rm -rf node_modules frontend/node_modules frontend/dist
npm install
cd frontend && npm install && npm run build
```

### 7. Wrangler 部署超时

**现象**：`wrangler deploy` 长时间无响应。

**排查步骤**：
- 确认网络可访问 Cloudflare API
- 检查 `wrangler whoami` 是否已登录
- 尝试 `wrangler deploy --dry-run` 进行预检

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
npm install
cd frontend && npm install && npm run build && cd ..
npx wrangler deploy
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
- 用户名：`admin@sun.com`
- 密码：`admin123`

登录成功后应跳转到主页（空白面板）。

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
- [ ] 主题切换正常（浅色/深色/跟随系统）
- [ ] 语言切换正常（中文/英文）

### 5. API 验证

```bash
# 验证登录
curl -X POST https://<your-worker>.workers.dev/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@sun.com","password":"admin123"}'

# 验证公开接口
curl -X POST https://<your-worker>.workers.dev/about \
  -H "Content-Type: application/json"
```

---

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin@sun.com` | `admin123` | 管理员 |

> **安全提醒**：部署后请立即修改默认管理员密码。

---

## 技术栈

- **运行时**：Cloudflare Workers
- **框架**：Hono ^4.7
- **数据库**：Cloudflare D1 (SQLite)
- **前端框架**：Vue 3.5 + TypeScript
- **构建工具**：Vite 6
- **UI 组件**：Naive UI 2.43
- **CSS 框架**：Tailwind CSS 3.4
- **状态管理**：Pinia 2.3
- **国际化**：vue-i18n 9.14