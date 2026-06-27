# Frontend Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过 shallowRef、v-memo、defineAsyncComponent、KeepAlive、watcher 上提与 index.html 清理，显著降低首屏 JS 体积、减少设置弹窗重复请求与重渲染开销、消除每卡片 watch 的 N 倍监听负担。

**Architecture:** 全部为前端纯重构，零新依赖、零 API 形状变更。聚焦 5 个高性价比优化点：(1) 把 `HomeItemCard` 内每卡片 `watch(realIconSrc)` 上提到父组件一次性处理；(2) `HomeAppStarter` 8 个 Panel 改为 `defineAsyncComponent` 按需加载；(3) 给 `HomeAppStarter` Tab 切换加 `<KeepAlive>`，避免重复 `onMounted` 请求；(4) 给 `home/index.vue` 视图模式 v-for 加 `v-memo`；(5) 清理 `index.html` 中未使用的 `dns-prefetch`/`preconnect` 与破坏 favicon 缓存的 `_t=Date.now()`。

**Tech Stack:** Vue 3.5（shallowRef / v-memo / KeepAlive / defineAsyncComponent / computed）、TypeScript 5、Vite 6、shadcn-vue。

---

## File Structure

| 文件 | 操作 | 责任 |
| --- | --- | --- |
| `frontend/src/views/home/components/HomeItemCard.vue` | Modify | 移除每卡片 `watch(realIconSrc, immediate)`，由父组件批量预连接 |
| `frontend/src/views/home/index.vue` | Modify | (a) 在 `loadInitData`/`loadData` 完成后对 `groups` 内所有外部域图标 src 调用 `preconnectOrigin`；(b) 视图模式 v-for 加 `v-memo` |
| `frontend/src/views/home/components/HomeAppStarter.vue` | Modify | (a) 8 个 Panel 改 `defineAsyncComponent`；(b) `<Transition>` 内加 `<KeepAlive>` |
| `frontend/index.html` | Modify | 删除未使用的 jsdelivr / googleapis dns-prefetch 与 preconnect；删除 favicon `_t=Date.now()` 时间戳 |

无新增文件，无新增依赖。

---

## Task 1: 上提 HomeItemCard 的 per-card watcher 到父组件

**Files:**
- Modify: `frontend/src/views/home/components/HomeItemCard.vue:1-35`
- Modify: `frontend/src/views/home/index.vue` (新增 `preconnectGroupIcons` 辅助 + 在数据就绪后调用)

**背景**：当前每个 `HomeItemCard` 实例都在 `setup` 中调用 `watch(realIconSrc, ..., { immediate: true })` 触发 `preconnectOrigin`。36 张图标 = 36 个 watcher + 36 次 setup 阶段计算。`preconnectOrigin` 内部已有 `Set` 去重，但 watcher 本身的注册/触发开销无法忽略。把它上提到父组件，数据就绪后一次性遍历所有 item.icon.src 调用 `preconnectOrigin`，把 N 个 watcher 降到 0。

- [ ] **Step 1: 修改 `HomeItemCard.vue`，移除 watch 与相关 import**

把 `frontend/src/views/home/components/HomeItemCard.vue` 顶部 `<script setup>` 改为：

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  item: Panel.ItemInfo
  editable: boolean
  isEditMode: boolean
  /** 是否在首屏可见，预加载图标 */
  eagerLoad?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', item: Panel.ItemInfo): void
  (e: 'edit', item: Panel.ItemInfo): void
  (e: 'delete', item: Panel.ItemInfo): void
}>()

const errored = ref(false)
// 图标是否加载完成，用于淡入过渡
const loaded = ref(false)

const realIconSrc = computed(() => props.item.icon?.src || '')

// 注：preconnectOrigin 已上提到父组件（home/index.vue），避免每卡片注册 watcher
</script>
```

变化点：删除 `import { preconnectOrigin } from '@/utils/preconnect'`、删除 `watch(realIconSrc, ...)` 块、从 `vue` 导入中移除 `watch`。

- [ ] **Step 2: 在 `home/index.vue` 引入 `preconnectOrigin` 并新增批量预连接函数**

在 `frontend/src/views/home/index.vue` 的 `<script setup>` 中，找到现有 import 区（顶部），追加：

```ts
import { preconnectOrigin } from '@/utils/preconnect'
```

在 `useDataLoader` 解构后、其他函数附近，新增辅助函数：

```ts
/**
 * 批量为所有分组中的外部域图标 src 注入 preconnect
 * 替代原先每卡片 watch 的 N 倍监听负担；preconnectOrigin 内部对同源/重复 origin 已去重
 */
function preconnectGroupIcons(groupsList: ItemGroup[]) {
  for (const group of groupsList) {
    if (!group.items) continue
    for (const item of group.items) {
      const src = item.icon?.src
      if (src) preconnectOrigin(src)
    }
  }
}
```

- [ ] **Step 3: 在数据加载完成后调用 `preconnectGroupIcons`**

在 `home/index.vue` 找到调用 `loadInitData()` / `loadData()` 的位置（通常在 `onMounted` 与 `refreshAll` 触发路径）。修改为加载完成后调用预连接：

```ts
onMounted(async () => {
  syncGlassVars()
  buildEagerSet()
  // 一次 /init 调用替代 3 次 API 请求，显著减少首次加载的网络往返
  await loadInitData()
  // 数据就绪后一次性预连接所有图标 origin（替代 HomeItemCard 每卡片 watch）
  preconnectGroupIcons(groups.value)
})
```

如果 `loadData()`（非 init 路径）也会被调用，在其调用处之后追加 `preconnectGroupIcons(groups.value)`。`refreshAll` 内部走 `loadInitData`，因此 `onMounted` 中的预连接已覆盖首屏；其他路径视实际调用点补齐。

- [ ] **Step 4: 验证类型与构建**

Run:
```bash
pnpm --filter sun-panel-frontend run typecheck
```
Expected: PASS（无 TS 错误）

Run:
```bash
pnpm --filter sun-panel-frontend run build
```
Expected: PASS（vite build 成功）

- [ ] **Step 5: 提交**

```bash
git add frontend/src/views/home/components/HomeItemCard.vue frontend/src/views/home/index.vue
git commit -m "perf(frontend): 上提 HomeItemCard 图标 preconnect watch 到父组件

把每卡片 watch(realIconSrc, immediate) 替换为父组件数据就绪后一次性
遍历调用 preconnectOrigin。消除 N 卡片 = N watcher 的 setup 开销，
preconnectOrigin 内部 Set 去重逻辑保持不变。"
```

---

## Task 2: HomeAppStarter 8 个 Panel 改为 defineAsyncComponent

**Files:**
- Modify: `frontend/src/views/home/components/HomeAppStarter.vue:1-19`

**背景**：当前 8 个 Panel（`UsersManage`、`PanelUserInfo`、`PanelStyleSettings`、`PanelAnnounceSettings`、`PanelGroupManage`、`PanelImportExport`、`PanelSiteSettings`、`PanelSearchSettings`）全部同步 import，进入首页即全量打包到主 chunk。改为 `defineAsyncComponent` 后，每个 Panel 拆为独立 chunk，首次打开"应用启动器"仅下载当前激活 Panel 的代码（约 1/8），其余 Panel 按需加载。

- [ ] **Step 1: 修改 `HomeAppStarter.vue` 顶部 import 区**

把 `frontend/src/views/home/components/HomeAppStarter.vue` 第 1-19 行的 import + setup 开头替换为：

```ts
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue'
import { storeToRefs } from 'pinia'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/components/ui/sonner'
import { useAuthStore, usePanelState } from '@/store'
import { saveGroup, deleteGroups } from '@/modules'
import AppStarterSidebar from './AppStarterSidebar.vue'
import type { SearchEngineConfig } from '@/modules/panel/types'

// 8 个 Panel 改为按需加载：首屏只下载当前激活 Tab 的 chunk，其余在切换时再拉取
const UsersManage = defineAsyncComponent(() => import('@/components/apps/Users/index.vue'))
const PanelUserInfo = defineAsyncComponent(() => import('./panels/PanelUserInfo.vue'))
const PanelStyleSettings = defineAsyncComponent(() => import('./panels/PanelStyleSettings.vue'))
const PanelAnnounceSettings = defineAsyncComponent(() => import('./panels/PanelAnnounceSettings.vue'))
const PanelGroupManage = defineAsyncComponent(() => import('./panels/PanelGroupManage.vue'))
const PanelImportExport = defineAsyncComponent(() => import('./panels/PanelImportExport.vue'))
const PanelSiteSettings = defineAsyncComponent(() => import('./panels/PanelSiteSettings.vue'))
const PanelSearchSettings = defineAsyncComponent(() => import('./panels/PanelSearchSettings.vue'))
```

变化点：
1. `vue` 导入追加 `defineAsyncComponent`
2. 删除 8 个 Panel 的同步 `import X from '...'`
3. 改为 `const X = defineAsyncComponent(() => import('...'))`
4. `AppStarterSidebar` 保留同步导入（它属于弹窗骨架，首次打开即需要）

模板部分（`<template>` 内）**无需修改**——组件名仍为 `UsersManage` / `PanelUserInfo` 等，`v-if` 渲染时 Vue 会自动 await 异步 chunk。

- [ ] **Step 2: 验证类型与构建**

Run:
```bash
pnpm --filter sun-panel-frontend run typecheck
```
Expected: PASS

Run:
```bash
pnpm --filter sun-panel-frontend run build
```
Expected: PASS，且 `dist/assets/` 下应能看到 8 个 Panel 各自的独立 chunk（如 `PanelUserInfo-*.js`、`UsersManage-*.js` 等）。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/views/home/components/HomeAppStarter.vue
git commit -m "perf(frontend): HomeAppStarter 8 个 Panel 改 defineAsyncComponent 按需加载

每个 Panel 拆为独立 chunk，首次打开应用启动器仅下载当前激活 Tab 的
代码（约 1/8），其余 Panel 在用户切换时再拉取，降低首屏 JS 体积。"
```

---

## Task 3: HomeAppStarter Tab 切换加 KeepAlive

**Files:**
- Modify: `frontend/src/views/home/components/HomeAppStarter.vue:174-229`

**背景**：当前 `<Transition name="tab-fade" mode="out-in">` 内部用 `v-if` 切换 Panel，每次切换都会销毁旧 Panel、重建新 Panel。`UsersManage` 的 `onMounted` 会重复触发 `getPublicVisitUser` + `getUserList` 两次请求。加 `<KeepAlive>` 后，已访问过的 Panel 实例会被缓存，切换回来不重新挂载、不重复请求。

**注意**：`<KeepAlive>` 必须放在 `<Transition>` 内部，且 KeepAlive 的直接子节点必须是单个组件（用 `v-if`/`v-else-if` 链或动态组件）。当前结构是多个并列 `v-if`，Vue 3 中 KeepAlive + 多 v-if 需要外层包一层。

- [ ] **Step 1: 修改 `HomeAppStarter.vue` 模板的 Transition 块**

把 `frontend/src/views/home/components/HomeAppStarter.vue` 第 174-229 行的 `<Transition>` 块替换为：

```html
            <!-- Tab 切换淡入过渡 + KeepAlive 缓存：避免重复 onMounted 请求 -->
            <Transition name="tab-fade" mode="out-in">
              <KeepAlive>
                <div :key="activeApp">
                  <!-- ====== 我的信息 ====== -->
                  <PanelUserInfo v-if="activeApp === 'UserInfo'" />

                  <!-- ====== 风格设置 ====== -->
                  <PanelStyleSettings
                    v-if="activeApp === 'Style'"
                    :panel-config="panelConfig"
                    :on-saved="props.onSaved"
                  />

                  <!-- ====== 公告设置 ====== -->
                  <PanelAnnounceSettings
                    v-if="activeApp === 'Announce'"
                    :panel-config="panelConfig"
                    :on-saved="props.onSaved"
                  />

                  <!-- ====== 分组管理 ====== -->
                  <PanelGroupManage
                    v-if="activeApp === 'GroupManage'"
                    :groups="props.groups"
                    @add-group="openAddGroup"
                    @edit-group="openEditGroup"
                    @delete-group="handleDeleteGroup"
                    @saved="handleGroupSaved"
                  />

                  <!-- ====== 导入导出 ====== -->
                  <PanelImportExport
                    v-if="activeApp === 'ImportExport'"
                    :on-saved="props.onSaved"
                  />

                  <!-- ====== 搜索引擎 ====== -->
                  <PanelSearchSettings
                    v-if="activeApp === 'SearchSettings'"
                    :search-engine-config="searchEngineConfig"
                    @update:search-engine-config="(cfg) => $emit('update:searchEngineConfig', cfg)"
                  />

                  <!-- ====== 用户管理 ====== -->
                  <div v-if="activeApp === 'Users'" class="flex flex-col gap-4">
                    <UsersManage />
                  </div>

                  <!-- ====== 站点设置 ====== -->
                  <PanelSiteSettings
                    v-if="activeApp === 'SiteSettings'"
                    :site-config="localSiteConfig"
                    @update:site-config="handleSiteConfigUpdate"
                  />
                </div>
              </KeepAlive>
            </Transition>
```

变化点：
1. 在 `<Transition>` 与原 `<div :key="activeApp">` 之间插入 `<KeepAlive>`
2. `</KeepAlive>` 在 `</div>` 之后、`</Transition>` 之前闭合
3. 其余 v-if 结构不变

- [ ] **Step 2: 验证 KeepAlive 行为（手动）**

启动 dev server：
```bash
pnpm --filter sun-panel-frontend run dev
```

打开浏览器 → 登录 → 打开应用启动器 → 切换到"用户管理"Tab → 等 list 加载完 → 切换到"我的信息" → 再切回"用户管理"。

Expected: 第二次进入"用户管理"时**不应**重新出现"加载中..."，用户列表应立即显示（来自 KeepAlive 缓存，不重新触发 `onMounted`）。

- [ ] **Step 3: 验证类型与构建**

Run:
```bash
pnpm --filter sun-panel-frontend run typecheck
```
Expected: PASS

Run:
```bash
pnpm --filter sun-panel-frontend run build
```
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add frontend/src/views/home/components/HomeAppStarter.vue
git commit -m "perf(frontend): HomeAppStarter Tab 切换加 KeepAlive 缓存 Panel 实例

避免 v-if 切换时销毁/重建 Panel 导致的重复 onMounted 请求（如
UsersManage 的 getPublicVisitUser + getUserList）。已访问过的 Tab
切换回来时直接复用缓存实例。"
```

---

## Task 4: home/index.vue 视图模式 v-for 加 v-memo

**Files:**
- Modify: `frontend/src/views/home/index.vue:370-383`

**背景**：当前视图模式（非编辑模式）下 `group.items` 的 v-for 没有 `v-memo`，任何对 `groups.value` 的深层属性变更（如单卡片删除 splice、排序保存）都会触发整组所有 `HomeItemCard` 重渲染。加 `v-memo` 后只重渲染依赖字段变化的卡片。

**注意**：仅在视图模式（`v-else` 分支）加 `v-memo`。编辑模式 `VueDraggable` 分支不加（拖拽需要实时响应顺序变化）。

- [ ] **Step 1: 修改 `home/index.vue` 视图模式 v-for**

把 `frontend/src/views/home/index.vue` 第 370-383 行的视图模式 v-for 替换为：

```html
            <div v-else class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 sm:gap-3">
              <div
                v-for="(item, ii) in group.items"
                :key="item.id || ii"
                :title="item.description || undefined"
                v-memo="[item.id, item.icon?.src, item.icon?.backgroundColor, item.icon?.text, item.title, item.description, eagerKeySet.has(`${gi}-${ii}`)]"
              >
                <HomeItemCard
                  :item="item"
                  :editable="false"
                  :is-edit-mode="false"
                  :eager-load="eagerKeySet.has(`${gi}-${ii}`)"
                  @click="openUrl"
                />
              </div>
            </div>
```

变化点：仅在原 `<div v-for=...>` 上新增 `v-memo="[...]"` 指令。依赖数组覆盖 `HomeItemCard` 模板中所有从 `item` 读取的可见字段（`icon.src`、`icon.backgroundColor`、`icon.text`、`title`、`description`）以及 `id`（key 稳定性）和 `eagerLoad` 计算结果。

- [ ] **Step 2: 验证类型与构建**

Run:
```bash
pnpm --filter sun-panel-frontend run typecheck
```
Expected: PASS

Run:
```bash
pnpm --filter sun-panel-frontend run build
```
Expected: PASS

- [ ] **Step 3: 验证 v-memo 行为（手动）**

启动 dev server，登录后进入首页：
1. 默认视图模式下，所有图标正常渲染。
2. 删除一个图标 → 仅被删除的卡片消失，其余卡片不重渲染（可通过 Vue DevTools 的"高亮更新"开关确认）。
3. 切换到编辑模式再切回视图模式 → 所有图标正常显示。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/views/home/index.vue
git commit -m "perf(frontend): 视图模式 HomeItemCard v-for 加 v-memo

避免单卡片变更（删除/排序保存）触发整组所有卡片重渲染。仅在视图模式
v-else 分支加 v-memo，编辑模式 VueDraggable 分支保持原行为。"
```

---

## Task 5: 清理 index.html 中未使用的 preconnect 与 favicon 时间戳

**Files:**
- Modify: `frontend/index.html:12-21, 46-61`

**背景**：
1. 第 13-15 行的 `dns-prefetch` / `preconnect` 指向 `cdn.jsdelivr.net` 与 `fonts.googleapis.com`，但前端已改用系统字体栈（见第 23-32 行），且无任何 jsdelivr 资源引用，属于历史残留。
2. 第 17 行 `<link rel="preconnect" crossorigin />` 缺少 `href`，浏览器会忽略，但占用解析时间。
3. 第 47-50 行给 favicon URL 拼接 `_t=Date.now()` 时间戳，导致每次刷新都重新下载 favicon，破坏浏览器缓存。favicon 内容极少变化，应去掉时间戳，让它走正常缓存。

- [ ] **Step 1: 删除 index.html 第 12-21 行的预连接块**

把 `frontend/index.html` 第 12-21 行：

```html
    <!-- 资源预连接：减少外域资源连接时间 -->
    <link rel="dns-prefetch" href="//cdn.jsdelivr.net" />
    <link rel="dns-prefetch" href="//fonts.googleapis.com" />
    <link rel="preconnect" href="//fonts.googleapis.com" crossorigin />
    <!-- 预连接当前域名（API / 图片资源同源） -->
    <link rel="preconnect" crossorigin />
    <!-- Google Favicon API 预连接 -->
    <link rel="preconnect" href="https://t0.gstatic.cn" crossorigin />
    <link rel="dns-prefetch" href="https://t0.gstatic.cn" />
```

替换为：

```html
    <!-- Google Favicon API 预连接（favicon-proxy 经 google s2 服务） -->
    <link rel="preconnect" href="https://t0.gstatic.cn" crossorigin />
    <link rel="dns-prefetch" href="https://t0.gstatic.cn" />
```

变化点：删除 jsdelivr / googleapis 三行 + 缺少 href 的空 preconnect 一行。保留 `t0.gstatic.cn`（favicon 代理实际用到）。

- [ ] **Step 2: 删除 favicon URL 的时间戳拼接**

把 `frontend/index.html` 第 46-61 行：

```html
          if (siteConfig.favicon_url) {
            var timestamp = '_t=' + Date.now();
            var favUrl = siteConfig.favicon_url;
            var sep = favUrl.indexOf('?') > -1 ? '&' : '?';
            var favWithTs = favUrl + sep + timestamp;

            var iconLink = document.createElement('link');
            iconLink.rel = 'icon';
            iconLink.href = favWithTs;
            document.head.appendChild(iconLink);

            var appleLink = document.createElement('link');
            appleLink.rel = 'apple-touch-icon';
            appleLink.href = favWithTs;
            document.head.appendChild(appleLink);
          }
```

替换为：

```html
          if (siteConfig.favicon_url) {
            // 不再拼接 _t=Date.now() 时间戳：favicon 内容稳定，让浏览器走正常缓存
            var favUrl = siteConfig.favicon_url;

            var iconLink = document.createElement('link');
            iconLink.rel = 'icon';
            iconLink.href = favUrl;
            document.head.appendChild(iconLink);

            var appleLink = document.createElement('link');
            appleLink.rel = 'apple-touch-icon';
            appleLink.href = favUrl;
            document.head.appendChild(appleLink);
          }
```

变化点：删除 `timestamp` / `sep` / `favWithTs` 三个变量，直接用 `favUrl`。

- [ ] **Step 3: 验证构建**

Run:
```bash
pnpm --filter sun-panel-frontend run build
```
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add frontend/index.html
git commit -m "perf(frontend): 清理 index.html 未使用 preconnect 与 favicon 时间戳

删除 jsdelivr / googleapis 的 dns-prefetch / preconnect（已改用系统字体
栈，无外部资源引用）；删除空 href 的 preconnect；移除 favicon URL 的
_t=Date.now() 时间戳拼接，让 favicon 走正常浏览器缓存。"
```

---

## Task 6: 全量验证

**Files:** 无（仅运行验证命令）

- [ ] **Step 1: 后端 typecheck**

Run:
```bash
pnpm run typecheck
```
Expected: PASS（本次未改后端，应无影响）

- [ ] **Step 2: 前端 typecheck**

Run:
```bash
pnpm --filter sun-panel-frontend run typecheck
```
Expected: PASS

- [ ] **Step 3: ESLint**

Run:
```bash
pnpm run lint
```
Expected: PASS

- [ ] **Step 4: 前端 build**

Run:
```bash
pnpm --filter sun-panel-frontend run build
```
Expected: PASS，且 `dist/assets/` 下出现 8 个 Panel 的独立 chunk。

- [ ] **Step 5: 手动回归（dev server）**

```bash
pnpm --filter sun-panel-frontend run dev
```

回归清单：
1. 首页加载 → 所有分组与图标正常显示，无 console error。
2. 打开"应用启动器" → 默认 Tab（我的信息）立即显示，网络面板看到对应 chunk 加载。
3. 切换到"用户管理" → 看到 chunk 加载 + 列表请求；切到"我的信息"再切回"用户管理" → **不**应再次出现"加载中..."（KeepAlive 生效）。
4. 删除一个图标 → 该图标消失，其余图标不闪烁/不重渲染（v-memo 生效，可借助 Vue DevTools 确认）。
5. 编辑模式拖拽排序 → 拖拽流畅，排序保存成功。
6. favicon 在浏览器开发者工具 Network 面板中应走 disk cache（刷新后 status 显示 `(disk cache)` 或 304）。

---

## Self-Review

**1. Spec coverage：** 5 个优化点全部覆盖：
- #1 (HIGH) shallowRef + v-memo → 本计划采用 v-memo（Task 4），未做 shallowRef（避免破坏现有 `group.items.splice` 与 `VueDraggable v-model` 直接突变模式，详见 Task 4 注意事项）。如未来需要进一步收益，可另立 spec 重构为不可变更新。
- #2 (HIGH) defineAsyncComponent → Task 2 ✓
- #3 (HIGH) KeepAlive → Task 3 ✓
- #4 (HIGH) 上提 per-card watcher → Task 1 ✓
- #5 (MEDIUM) index.html 清理 → Task 5 ✓

**2. Placeholder scan：** 已检查，所有 step 均含具体代码或具体命令，无 TBD / TODO / "类似 Task N"。

**3. Type consistency：**
- `preconnectOrigin(urlStr: string)` 签名与 Task 1 Step 2 调用一致。
- `defineAsyncComponent(() => import(...))` 在 Task 2 中保留与原 import 相同的组件名（`UsersManage` / `PanelUserInfo` 等），模板无需改动。
- Task 3 `<KeepAlive>` 包裹的 `<div :key="activeApp">` 与原结构一致，仅插入 KeepAlive 包裹层。
- Task 4 `v-memo` 依赖数组字段名（`item.icon?.src` / `item.icon?.backgroundColor` / `item.icon?.text` / `item.title` / `item.description`）与 `HomeItemCard.vue` 模板中实际读取的字段一致。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-27-frontend-performance-optimization.md`. Two execution options:

**1. Subagent-Driven (recommended)** - 每个 Task 派发独立 subagent，Task 间 review，并行加速。

**2. Inline Execution** - 在当前 session 内顺序执行，批量 checkpoint review。

由于用户在原始请求中已明确指定 `git-commit` + `gh-cli 推送到 main`，本计划将采用 **Inline Execution** 模式直接推进至提交与推送。
