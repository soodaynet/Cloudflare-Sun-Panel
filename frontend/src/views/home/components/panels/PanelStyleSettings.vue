<script setup lang="ts">
import { toRef } from 'vue'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useConfigEditor } from '../../composables/useConfigEditor'

const props = defineProps<{
  panelConfig: Panel.panelConfig
  onSaved: () => void
}>()

const emit = defineEmits<{
  (e: 'save', config: Panel.panelConfig): void
  (e: 'reset'): void
}>()

const { localConfig, handleSave, panelState } = useConfigEditor({
  config: toRef(props, 'panelConfig'),
  onSaved: props.onSaved,
  onSave: (config) => emit('save', config),
})

function handleReset() {
  panelState.setPanelConfig({})
  toast.success('已重置')
  emit('reset')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle>壁纸设置</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <div class="flex flex-col gap-2">
          <Label>壁纸地址</Label>
          <Input v-model="localConfig.backgroundImageSrc" placeholder="输入图片URL" />
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label>模糊度</Label>
            <span class="text-sm text-muted-foreground">{{ localConfig.backgroundBlur || 0 }}</span>
          </div>
          <Slider
            :model-value="[localConfig.backgroundBlur || 0]"
            @update:model-value="(v: number[] | undefined) => (localConfig.backgroundBlur = v?.[0] ?? 0)"
            :min="0"
            :max="50"
          />
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label>遮罩不透明度</Label>
            <span class="text-sm text-muted-foreground">{{ localConfig.backgroundMaskNumber ?? 0.3 }}</span>
          </div>
          <Slider
            :model-value="[localConfig.backgroundMaskNumber ?? 0.3]"
            @update:model-value="(v: number[] | undefined) => (localConfig.backgroundMaskNumber = v?.[0] ?? 0.3)"
            :min="0"
            :max="1"
            :step="0.1"
          />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>布局设置</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <div class="flex flex-col gap-2">
          <Label>最大宽度</Label>
          <Input v-model="localConfig.maxWidth" type="number" />
        </div>
        <div class="flex flex-col gap-2">
          <Label>上边距</Label>
          <Input v-model="localConfig.marginTop" type="number" />
        </div>
        <div class="flex flex-col gap-2">
          <Label>下边距</Label>
          <Input v-model="localConfig.marginBottom" type="number" />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>页脚设置</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <p class="text-sm text-muted-foreground">支持 HTML 标签</p>
        <div class="flex flex-col gap-2">
          <Label>自定义页脚</Label>
          <Textarea v-model="localConfig.footerHtml" rows="3" placeholder="<p>&copy; 2024 Sun-Panel</p>" />
        </div>
      </CardContent>
    </Card>

    <div class="flex justify-end gap-2">
      <Button variant="outline" @click="handleReset">重置</Button>
      <Button @click="handleSave">保存</Button>
    </div>
  </div>
</template>
