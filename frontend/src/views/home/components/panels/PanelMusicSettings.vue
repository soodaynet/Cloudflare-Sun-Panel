<script setup lang="ts">
import { toRef } from 'vue'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
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
    <!-- 音乐播放器设置 -->
    <Card>
      <CardHeader>
        <CardTitle>音乐播放器设置</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <Label>启用音乐播放器</Label>
          <Switch
            :model-value="localConfig.musicShow ?? false"
            @update:model-value="(v: boolean) => (localConfig.musicShow = v)"
          />
        </div>

        <div class="flex flex-col gap-2">
          <Label>音乐数据源</Label>
          <Select
            :model-value="localConfig.musicServer"
            @update:model-value="
              (v) => (localConfig.musicServer = v as Panel.panelConfig['musicServer'])
            "
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择数据源" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="netease">网易云</SelectItem>
              <SelectItem value="tencent">QQ 音乐</SelectItem>
              <SelectItem value="kugou">酷狗</SelectItem>
              <SelectItem value="baidu">百度</SelectItem>
              <SelectItem value="kuwo">酷我</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-2">
          <Label>资源类型</Label>
          <Select
            :model-value="localConfig.musicType"
            @update:model-value="
              (v) => (localConfig.musicType = v as Panel.panelConfig['musicType'])
            "
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择资源类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="song">单曲</SelectItem>
              <SelectItem value="playlist">歌单</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-2">
          <Label>单曲/歌单 ID</Label>
          <Input v-model="localConfig.musicId" placeholder="输入单曲或歌单 ID" />
        </div>

        <div class="flex flex-col gap-2">
          <Label>Meting API 地址</Label>
          <Input
            v-model="localConfig.musicApiUrl"
            placeholder="https://api.moeyao.cn/meting/"
          />
          <p class="text-sm text-muted-foreground">
            默认 <code>https://api.moeyao.cn/meting/</code>，可自建部署（参考 metowolf/Meting）
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label>自动播放</Label>
            <Switch
              :model-value="localConfig.musicAutoplay ?? false"
              @update:model-value="(v: boolean) => (localConfig.musicAutoplay = v)"
            />
          </div>
          <p class="text-sm text-muted-foreground">受浏览器策略限制可能无效</p>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label>默认音量</Label>
            <span class="text-sm text-muted-foreground">
              {{ localConfig.musicVolume ?? 0.7 }}
            </span>
          </div>
          <Slider
            :model-value="[localConfig.musicVolume ?? 0.7]"
            @update:model-value="
              (v: number[] | undefined) => (localConfig.musicVolume = v?.[0] ?? 0.7)
            "
            :min="0"
            :max="1"
            :step="0.1"
          />
        </div>

        <div class="flex flex-col gap-2">
          <Label>循环模式</Label>
          <Select
            :model-value="localConfig.musicLoop"
            @update:model-value="
              (v) => (localConfig.musicLoop = v as Panel.panelConfig['musicLoop'])
            "
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择循环模式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">列表循环</SelectItem>
              <SelectItem value="one">单曲循环</SelectItem>
              <SelectItem value="none">不循环</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-2">
          <Label>播放顺序</Label>
          <Select
            :model-value="localConfig.musicOrder"
            @update:model-value="
              (v) => (localConfig.musicOrder = v as Panel.panelConfig['musicOrder'])
            "
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择播放顺序" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list">顺序播放</SelectItem>
              <SelectItem value="random">随机播放</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>

    <div class="flex justify-end gap-2">
      <Button variant="outline" @click="handleReset">重置</Button>
      <Button @click="handleSave">保存</Button>
    </div>
  </div>
</template>
