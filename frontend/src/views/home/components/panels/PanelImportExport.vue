<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/sonner'
import { getAllData, saveGroup, addItems } from '@/modules'
import { cachedRequest } from '@/utils/requestCache'
import {
  createExportData,
  downloadJSON,
  validateImportData,
  readFileAsText,
  type ExportGroup,
  type ExportData,
} from '@/utils/importExport'

const importExportLoading = ref(false)
const fileInputRef = ref<HTMLInputElement>()

async function handleExport() {
  importExportLoading.value = true
  try {
    const res = await cachedRequest('panel:allData', () =>
      getAllData<{
        groups: Panel.ItemIconGroup[]
        itemsMap: Record<number, Panel.ItemInfo[]>
      }>(),
    )
    if (res.code === 0 && res.data) {
      const groupList = res.data.groups || []
      const itemsMap = res.data.itemsMap || {}
      const groups: ExportGroup[] = groupList.map((g) => ({
        title: g.title || '',
        sort: g.sort || 0,
        publicVisible: g.publicVisible ?? 1,
        children:
          g.id && itemsMap[g.id]
            ? itemsMap[g.id].map((item) => ({
                title: item.title,
                sort: item.sort || 0,
                icon: item.icon,
                url: item.url,
                description: item.description || '',
                openMethod: item.openMethod || 1,
              }))
            : [],
      }))
      const data = createExportData(groups)
      downloadJSON(data)
      toast.success('导出成功')
    }
  } catch {
    toast.error('导出失败')
  } finally {
    importExportLoading.value = false
  }
}

async function handleImportFile(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  importExportLoading.value = true
  try {
    const text = await readFileAsText(file)
    const result = validateImportData(text)
    if (!result.valid || !result.data) {
      toast.error(result.error || '导入失败')
      return
    }
    await importData(result.data)
    toast.success('导入成功，正在刷新…')
    window.location.reload()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '导入失败')
  } finally {
    importExportLoading.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}

/**
 * 规范化导入图标的 icon 字段
 * 容忍历史导出数据中的 null/空对象/缺 itemType 形态：
 * - null/undefined/非对象 → null（后端 .nullish() 接受）
 * - 对象缺 itemType → 补默认值 0（图像类型，前端渲染只看 src/text/backgroundColor，itemType 不参与渲染）
 */
function normalizeIcon(icon: unknown): Panel.ItemIcon | null {
  if (!icon || typeof icon !== 'object') return null
  const obj = icon as Record<string, unknown>
  return {
    itemType: typeof obj.itemType === 'number' ? obj.itemType : 0,
    src: typeof obj.src === 'string' ? obj.src : undefined,
    text: typeof obj.text === 'string' ? obj.text : undefined,
    backgroundColor: typeof obj.backgroundColor === 'string' ? obj.backgroundColor : undefined,
  }
}

// 导入仅写入分组与图标（saveGroup/addItems），不触碰背景/panelConfig/siteConfig 等任何其他配置
async function importData(data: ExportData) {
  const batchSize = 50
  for (const g of data.icons) {
    // 创建分组，失败立即抛错（触发外层 catch 显示错误 toast）
    const groupRes = await saveGroup<Panel.ItemIconGroup>({ title: g.title, sort: g.sort, publicVisible: g.publicVisible ?? 1 })
    if (groupRes.code !== 0 || !groupRes.data?.id) {
      throw new Error(groupRes.msg || `分组「${g.title}」创建失败`)
    }
    const groupId = groupRes.data.id
    const items: Panel.ItemInfo[] = g.children.map((item) => ({
      ...item,
      icon: normalizeIcon(item.icon),
      itemIconGroupId: groupId,
      openMethod: item.openMethod || 2,
    }))
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const itemsRes = await addItems(batch)
      // 批量添加失败立即抛错，避免静默丢失数据
      if (itemsRes.code !== 0) {
        throw new Error(itemsRes.msg || `分组「${g.title}」图标导入失败`)
      }
    }
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 导出区 -->
    <Card>
      <CardHeader>
        <CardTitle>导出数据</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <p class="text-sm text-muted-foreground">导出格式为 .sun-panel.json，可跨设备备份和恢复</p>
        <Button :disabled="importExportLoading" @click="handleExport">导出数据</Button>
      </CardContent>
    </Card>

    <!-- 导入区 -->
    <Card>
      <CardHeader>
        <CardTitle>导入数据</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <p class="text-sm text-muted-foreground">选择 .sun-panel.json 文件恢复数据</p>
        <input ref="fileInputRef" type="file" accept=".sun-panel.json,.json" class="hidden" @change="handleImportFile" />
        <Button variant="outline" :disabled="importExportLoading" @click="fileInputRef?.click()">导入数据</Button>
      </CardContent>
    </Card>
  </div>
</template>
