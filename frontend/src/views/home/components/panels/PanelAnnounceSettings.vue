<script setup lang="ts">
import { toRef } from 'vue'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { saveSiteSettings } from '@/modules'
import { useConfigEditor } from '../../composables/useConfigEditor'

const props = defineProps<{
  panelConfig: Panel.panelConfig
  onSaved: () => void
}>()

const emit = defineEmits<{
  (e: 'save', config: Panel.panelConfig): void
}>()

const { localConfig, handleSave: saveConfig } = useConfigEditor({
  config: toRef(props, 'panelConfig'),
  onSaved: props.onSaved,
  onSave: (config) => emit('save', config),
})

// 用户配置保存成功后，同步将毛玻璃效果写入系统设置（login_blur / login_mask_opacity），
// 使登录卡片与公告/侧边栏共用同一组模糊和透明度配置
async function handleSave() {
  const ok = await saveConfig()
  if (!ok) return
  try {
    await saveSiteSettings({
      login_blur: String(localConfig.value.announcementBlur ?? 12),
      login_mask_opacity: String(localConfig.value.announcementMaskOpacity ?? 0.15),
    })
  } catch {
    toast.error('毛玻璃效果同步失败')
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div>
      <h3 class="text-sm font-medium text-foreground mb-2">公告设置</h3>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-2">
          <Label>公告内容</Label>
          <Textarea
            v-model="localConfig.announcement"
            rows="3"
            placeholder="公告文字，留空不显示"
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label>公告停留时间 (秒，0为不自动消失)</Label>
          <Input
            v-model="localConfig.announcementDuration"
            type="number"
            min="0"
            max="999"
          />
        </div>
      </div>
    </div>
    <div>
      <h3 class="text-sm font-medium text-foreground mb-2">Logo 设置</h3>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-2">
          <Label>Logo 文字</Label>
          <Input v-model="localConfig.logoText" placeholder="输入 Logo 文字" />
        </div>
        <div class="flex flex-col gap-2">
          <Label>Logo 图片 URL</Label>
          <Input v-model="localConfig.logoImageSrc" placeholder="输入图片URL" />
        </div>
        <div class="flex flex-col gap-2">
          <Label>Logo 距顶部 (px)</Label>
          <Input v-model="localConfig.logoPositionTop" type="number" />
        </div>
        <div class="flex flex-col gap-2">
          <Label>Logo 距左侧 (px)</Label>
          <Input v-model="localConfig.logoPositionLeft" type="number" />
        </div>
        <div class="flex flex-col gap-2">
          <Label>Logo 图片高度 (px)</Label>
          <Input v-model="localConfig.logoSize" type="number" />
        </div>
      </div>
    </div>
    <div>
      <h3 class="text-sm font-medium text-foreground mb-2">毛玻璃效果</h3>
      <p class="text-sm text-muted-foreground mb-2">控制登录卡片、侧边栏、公告弹窗、Logo 的模糊和透明度效果</p>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-2">
          <Label>背景模糊度: {{ localConfig.announcementBlur ?? 12 }}</Label>
          <Slider
            :model-value="[localConfig.announcementBlur ?? 12]"
            @update:model-value="(v: number[] | undefined) => (localConfig.announcementBlur = v?.[0] ?? 12)"
            :min="0"
            :max="40"
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label>遮罩不透明度: {{ localConfig.announcementMaskOpacity ?? 0.15 }}</Label>
          <Slider
            :model-value="[localConfig.announcementMaskOpacity ?? 0.15]"
            @update:model-value="(v: number[] | undefined) => (localConfig.announcementMaskOpacity = v?.[0] ?? 0.15)"
            :min="0"
            :max="1"
            :step="0.05"
          />
        </div>
      </div>
    </div>
    <div class="flex justify-end gap-2">
      <Button @click="handleSave">保存</Button>
    </div>
  </div>
</template>
