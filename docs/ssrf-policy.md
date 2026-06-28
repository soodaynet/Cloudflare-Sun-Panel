# SSRF 安全使用规范

> 本文档定义本项目（Cloudflare-Sun-Panel）所有服务端发起外部请求接口的 SSRF（Server-Side Request Forgery）安全使用规范。任何新增服务端外部请求（fetch 外部 URL、代理、抓取等）**必须**遵循本文档。

---

## 1. 概述

SSRF 是一类安全漏洞：服务端代替用户发起外部 HTTP 请求，攻击者可借此让服务端访问内网资源、云元数据端点（如 `169.254.169.254`）、本机回环服务等本不可达的目标，从而造成信息泄露、内网探测或权限提升。

本项目运行在 Cloudflare Workers 上，虽然 Workers 沙箱对部分内网访问有天然限制，但仍需在应用层通过 URL 校验、超时、缓存等约束防止滥用与误用。本文档列出**允许的 SSRF 场景**、**强制安全约束**与**禁止场景**。

---

## 2. 定义

**SSRF（服务端请求伪造）**：指由服务端代码（Worker 内的 `fetch`、外部 HTTP 客户端调用等）代替用户向**用户可控的 URL**发起网络请求的行为。典型表现：

- 用户传入一个 URL，服务端 `fetch` 该 URL 抓取内容
- 用户传入 domain，服务端拼接到第三方服务（如 google favicon）后 `fetch`
- 服务端代理/转发用户指定的资源

**非 SSRF**（不受本文档约束）：服务端向**固定、非用户可控**的内部端点请求（如 D1 绑定、Cloudflare 自有服务调用）。

---

## 3. 允许场景

仅以下场景允许服务端发起外部请求：

1. **Favicon 获取**：代理公开 favicon 服务（如 `https://www.google.com/s2/favicons`），或抓取目标站点 HTML 解析 `<link rel="icon">` 等 favicon 声明。
2. **站点元数据抓取**：抓取目标站点 HTML，解析 `<title>`、`<meta name="description">`、Open Graph（`og:title` / `og:description` / `og:site_name` / `og:image`）等标签，用于链接预览展示。
3. **其他场景**：必须在 PR 说明中给出明确理由，说明为何必须由服务端发起、目标场景与安全约束，并补充到本文档「现有合规端点清单」。

> 优先原则：如能由前端直连目标 URL 或公开 favicon 服务完成，**不应**在服务端实现。

---

## 4. 强制安全约束

每个新增 SSRF 端点**必须全部满足**以下约束：

### 4.1 URL 校验（必须）

用户输入的 URL **必须**通过 `isValidUrl`（位于 `src/modules/shared/favicon.ts`）校验。该函数屏蔽以下目标：

- **协议**：仅允许 `http`、`https`；其他协议（`file://`、`ftp://`、`data:`、`gopher://` 等）一律拒绝。
- **主机名**：屏蔽 `localhost`、`127.0.0.1`、`[::1]`（IPv6 回环）。
- **IPv4 段**（按点分十进制首/二字节匹配）：
  - `10.0.0.0/8`（A 类私网）—— 首字节为 `10` 即拒绝
  - `172.16.0.0/12`（B 类私网）—— 首字节 `172` 且第二字节 `16–31` 即拒绝
  - `192.168.0.0/16`（C 类私网）—— 首字节 `192` 且第二字节 `168` 即拒绝
  - `127.0.0.0/8`（回环）—— 首字节 `127` 即拒绝
  - `169.254.0.0/16`（链路本地，含云元数据 `169.254.169.254`）—— 首字节 `169` 且第二字节 `254` 即拒绝
  - `0.0.0.0/8`（本网络）—— 首字节 `0` 即拒绝
- 任何无法被 `new URL()` 解析的畸形输入一律拒绝（返回 `false`）。

> 注意：`isValidUrl` 当前**不**校验 IPv6 私网段（如 `fc00::/7`、`fe80::/10`）与十进制/八进制 IP 编码绕过；新增端点如需更强防护，应在 `isValidUrl` 之上叠加额外校验，而非绕过它。

### 4.2 协议限制（必须）

仅允许 `http`、`https` 协议。`isValidUrl` 已强制此约束，不得在调用前自行放宽。

### 4.3 超时（必须）

必须设置请求超时，建议 **3–5 秒**。使用 `AbortController` + `setTimeout`，并在 `finally` 中 `clearTimeout` 防止泄漏。

```ts
const abort = new AbortController()
const timeout = setTimeout(() => abort.abort(), 3000)
try {
  const res = await fetch(url, { signal: abort.signal, ... })
} finally {
  clearTimeout(timeout)
}
```

### 4.4 缓存（必须）

必须设置 `cf: { cacheTtl }` 利用 Cloudflare 边缘缓存，减少对同一目标的重复请求。

- favicon / 站点元数据类：建议 `cacheTtl: 3600`（1 小时）
- 代理公开 favicon 服务类：建议响应头 `Cache-Control: public, max-age=2592000, immutable`（30 天）

### 4.5 方法（必须）

仅允许 `GET`（HTML 抓取可用默认 GET，favicon 探测可用 `HEAD`）。**禁止** `POST` / `PUT` / `DELETE` 等可能产生副作用的请求方法。

### 4.6 响应大小限制（必须）

必须限制最大响应体大小，防止内存耗尽。

- HTML 类：建议 **≤ 1MB**
- 图片类：建议 **≤ 256KB**

可通过读取 `Content-Length` 预判，或在流式读取时累计字节数并提前中断。

### 4.7 错误处理（必须）

上游失败时返回友好错误（如 HTTP 502 + `{ code: 502, msg: '上游服务不可用', data: null }`），**不泄露**内部堆栈、目标地址细节或原始上游响应体。`catch` 所有异常（含 `AbortError`、网络错误），统一返回固定错误信息。

### 4.8 重定向限制

`fetch` 默认 `redirect: 'follow'` 会跟随重定向。需注意：

- 重定向后的最终 URL 可能落入被屏蔽的私网段（`isValidUrl` 仅校验初始 URL）；
- 建议重定向次数 **≤ 3**，或在 fetch 后对 `res.url`（最终 URL）再次调用 `isValidUrl` 校验。

现有合规端点均使用 `redirect: 'follow'`，未做最终 URL 复检，新增端点应考虑加固。

---

## 5. 现有合规端点清单

| 端点 | 方法 | 实现位置 | 说明 |
| --- | --- | --- | --- |
| `/panel/itemIcon/getSiteFavicon` | POST | `src/modules/panel/item-icon/routes.ts` + `src/modules/panel/service.ts` `getSiteFavicon()` | 抓取目标站点 HTML，解析 favicon `<link>` 标签与站点元数据（title/description/OG 标签）。受 `isValidUrl` 约束（屏蔽 localhost/回环/私网段），HTML 抓取 **3s 超时**（`AbortController`），favicon.ico HEAD 探测 2s 超时，`cf: { cacheTtl: 3600 }`（1 小时），路由层 `Cache-Control: private, max-age=600`。 |

> 一言与音乐功能已改为前端直连上游 API（hitokoto.cn / Meting），不走后端代理，故无对应 SSRF 端点。

> 新增 SSRF 端点**必须**在 PR 合并前补充到本清单。

---

## 6. 新增 SSRF 端点流程

1. **PR 说明**：说明为何需要 SSRF、目标场景、符合哪些安全约束（逐条对应 §4）。
2. **代码**：
   - 调用 `isValidUrl` 校验用户输入的 URL（含用户传入 domain 时拼成完整 URL 后校验）；
   - 设置超时（`AbortController`，3–5s）；
   - 设置缓存（`cf: { cacheTtl }` 或响应 `Cache-Control`）；
   - 仅用 GET/HEAD；
   - 限制响应大小；
   - `catch` 所有异常，返回 502 友好错误。
3. **文档**：在本文档 §5「现有合规端点清单」补充新端点（端点、方法、实现位置、安全约束摘要）。
4. **审查**：PR 审查者按 §4 清单逐项核对。

---

## 7. 禁止场景

- ❌ 用户可任意指定 URL 的服务端抓取，且无严格白名单或 `isValidUrl` 校验。
- ❌ 利用 SSRF 做内网探测、端口扫描、访问云元数据端点（`169.254.169.254`）。
- ❌ 服务端携带用户凭证（Cookie、Authorization）向第三方站点发起请求。
- ❌ 无超时、无响应大小限制的抓取（易被慢速攻击或大响应体耗尽内存）。
- ❌ 绕过 `isValidUrl` 自行放宽协议或私网校验。
- ❌ 在服务端实现可通过前端直连完成的外部图片/资源加载。

---

## 8. 参考

- `isValidUrl` 实现：`src/modules/shared/favicon.ts`
- `getSiteFavicon` 实现：`src/modules/panel/item-icon/routes.ts`、`src/modules/panel/service.ts`
- 项目安全总则：`AGENTS.md` §6、`CLAUDE.md` §10
