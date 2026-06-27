<script setup lang="ts">
import { toRef } from 'vue'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
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
  <div class="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle>公告设置</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
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
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Logo 设置</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <div class="flex flex-col gap-2">
          <Label>Logo 文字</Label>
          <Input v-model="localConfig.logoText" placeholder="输入 Logo 文字" />
        </div>
        <div class="flex flex-col gap-2">
          <Label>Logo 图片 URL</Label>
          <Input v-model="localConfig.logoImageSrc" placeholder="输入图片URL" />
        </div>
        <div class="flex flex-col gap-2">
          <Label>Logo 图片高度 (px)</Label>
          <Input v-model="localConfig.logoSize" type="number" />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>毛玻璃效果</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <p class="text-sm text-muted-foreground">控制登录卡片、侧边栏、公告弹窗、Logo 的模糊和透明度效果</p>
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label>背景模糊度</Label>
            <span class="text-sm text-muted-foreground">{{ localConfig.announcementBlur ?? 12 }}</span>
          </div>
          <Slider
            :model-value="[localConfig.announcementBlur ?? 12]"
            @update:model-value="(v: number[] | undefined) => (localConfig.announcementBlur = v?.[0] ?? 12)"
            :min="0"
            :max="40"
          />
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label>遮罩不透明度</Label>
            <span class="text-sm text-muted-foreground">{{ localConfig.announcementMaskOpacity ?? 0.15 }}</span>
          </div>
          <Slider
            :model-value="[localConfig.announcementMaskOpacity ?? 0.15]"
            @update:model-value="(v: number[] | undefined) => (localConfig.announcementMaskOpacity = v?.[0] ?? 0.15)"
            :min="0"
            :max="1"
            :step="0.05"
          />
        </div>
      </CardContent>
    </Card>

    <div class="flex justify-end gap-2">
      <Button @click="handleSave">保存</Button>
    </div>
  </div>
</template>
