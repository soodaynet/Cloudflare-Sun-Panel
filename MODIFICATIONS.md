# 生成组件修改与新 UI 库引入登记表

本文件用于集中登记对 `frontend/src/components/ui/**` 生成组件的本地修改，以及新引入的 UI 库，便于追溯与审计。每次修改生成组件或引入新 UI 库时，除在代码处加注释 `// shadcn-vue 生成，本地修改：<说明>` 外，还需在本文件对应表格追加一行。

## 填写规范

- 修改生成组件：仅限视觉样式（颜色/尺寸/间距/圆角/阴影/透明度/边框/过渡动画等），不得改逻辑/props API/事件/插槽/a11y 语义
- 代码处须加中文注释：`// shadcn-vue 生成，本地修改：<说明>`
- 引入新 UI 库：需在 PR 说明中给出明确理由
- 日期格式：YYYY-MM-DD

## 生成组件修改登记表

| 序号 | 文件路径 | 修改类型 | 说明 | 日期 |
| - | - | - | - | - |
| 1 | frontend/src/components/ui/card/Card.vue | 视觉样式 | 圆角由 `rounded-xl` 调整为 `rounded-lg`，与 DialogContent 圆角统一，符合 spec「dialog/card 用 rounded-lg」要求；阴影 `shadow-sm` 保持不变 | 2026-06-26 |

## 新 UI 库引入登记表

| 序号 | 库名 | 版本 | 引入理由 | 日期 |
| - | - | - | - | - |

_暂无引入_
