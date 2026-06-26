<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'


const props = defineProps<{
  visible: boolean
  editingItem: Panel.ItemInfo | null
  getIconLoading: boolean
  iconCandidates: string[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'save'): void
  (e: 'getFavicon'): void
  (e: 'selectIcon', url: string): void
}>()

const show = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})
</script>

<template>
  <!-- eslint-disable vue/no-mutating-props -->
  <Dialog v-model:open="show">
    <DialogContent class="w-[95vw] sm:w-[500px] max-w-[500px]">
      <DialogHeader>
        <DialogTitle>编辑图标</DialogTitle>
      </DialogHeader>
      <div v-if="editingItem" class="flex flex-col gap-4">
        <div>
          <Label class="block mb-1.5">标题 *</Label>
          <Input v-model="editingItem.title" placeholder="请输入标题" />
        </div>
        <div>
          <Label class="block mb-1.5">网址 *</Label>
          <div class="flex gap-2">
            <Input v-model="editingItem.url" class="flex-1" placeholder="https://" />
            <!-- 获取按钮：loading 时显示 spinner + 「获取中」 -->
            <Button :disabled="!editingItem.url || getIconLoading" @click="emit('getFavicon')">
              <span
                v-if="getIconLoading"
                class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
              {{ getIconLoading ? '获取中' : '获取' }}
            </Button>
          </div>
          <!-- 图标候选列表：Card 包裹 + 网格布局 -->
          <Card v-if="iconCandidates.length > 0" class="mt-2">
            <CardContent class="p-3">
              <div class="text-xs text-muted-foreground mb-2">点击选择图标：</div>
              <div class="grid grid-cols-8 gap-2">
                <div
                  v-for="(iconUrl, idx) in iconCandidates"
                  :key="idx"
                  class="w-8 h-8 rounded-md cursor-pointer border-2 hover:border-primary transition-colors flex items-center justify-center bg-background"
                  :class="editingItem.icon?.src === iconUrl ? 'border-primary' : 'border-border'"
                  :title="iconUrl"
                  @click="emit('selectIcon', iconUrl)"
                >
                  <img
                    :src="iconUrl"
                    class="w-full h-full object-cover rounded-md"
                    alt=""
                    width="32"
                    height="32"
                    loading="eager"
                    decoding="async"
                    referrerpolicy="no-referrer"
                    @error="($event.target as HTMLImageElement).style.display = 'none'"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <Label class="block mb-1.5">描述</Label>
          <Input v-model="editingItem.description" placeholder="描述信息" />
        </div>
        <div>
          <Label class="block mb-1.5">图标文字</Label>
          <Input v-model="editingItem.icon!.text" placeholder="图标显示文字" />
        </div>
        <div>
          <Label class="block mb-1.5">图标图片 URL</Label>
          <Input v-model="editingItem.icon!.src" placeholder="输入图标图片URL，留空使用文字图标" />
        </div>
        <div>
          <Label class="block mb-1.5">图标背景色</Label>
          <Input v-model="editingItem.icon!.backgroundColor" placeholder="#4a90d9" />
        </div>
        <div>
          <Label class="block mb-1.5">打开方式</Label>
          <!-- openMethod 为 number，Select value 统一用 string，双向转换 -->
          <Select
            :model-value="String(editingItem.openMethod)"
            @update:model-value="(v) => (editingItem!.openMethod = Number(v))"
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择打开方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">当前页面打开</SelectItem>
              <SelectItem value="2">新窗口打开</SelectItem>
              <SelectItem value="3">弹窗打开</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:visible', false)">取消</Button>
        <Button @click="emit('save')">保存</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  <!-- eslint-enable vue/no-mutating-props -->
</template>
