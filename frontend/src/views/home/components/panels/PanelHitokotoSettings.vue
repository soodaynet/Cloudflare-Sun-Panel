<script setup lang="ts">
import { computed, toRef, type Ref } from 'vue'
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

const { localConfig: rawLocalConfig, handleSave, panelState } = useConfigEditor({
  config: toRef(props, 'panelConfig'),
  onSaved: props.onSaved,
  onSave: (config) => emit('save', config),
})

// 一言高级字段类型：以交集形式补充 Panel.panelConfig 中可能尚未声明的字段，
// 保证本组件类型自包含，不依赖全局类型定义的完整度。
type HitokotoPanelConfig = Panel.panelConfig & {
  hitokotoCategories?: string[]
  hitokotoAlign?: 'left' | 'center'
  hitokotoTypewriter?: boolean
  hitokotoTypewriterDuration?: number
  hitokotoTypewriterCursor?: 'none' | 'block' | 'blink'
  hitokotoTypewriterAnimation?: 'type' | 'fade' | 'slide'
  hitokotoShowFrom?: boolean
  hitokotoShowFromWho?: boolean
  hitokotoAutoSwitch?: boolean
  hitokotoAutoSwitchInterval?: number
  hitokotoTransitionDuration?: number
}

// 视图别名：将 localConfig 视为含一言高级字段的配置，模板内以 localConfig.xxx 访问
const localConfig = rawLocalConfig as Ref<HitokotoPanelConfig>

// 一言分类常量（hitokoto.cn 官方 a-l 共 12 个分类）
const HITOKOTO_CATEGORIES: { key: string; label: string }[] = [
  { key: 'a', label: '动画' },
  { key: 'b', label: '漫画' },
  { key: 'c', label: '游戏' },
  { key: 'd', label: '文学' },
  { key: 'e', label: '原创' },
  { key: 'f', label: '来自网络' },
  { key: 'g', label: '其他' },
  { key: 'h', label: '影视' },
  { key: 'i', label: '诗词' },
  { key: 'j', label: '网易云' },
  { key: 'k', label: '哲学' },
  { key: 'l', label: '抖机灵' },
]

// 全选状态：已选数量等于 12 时为全选
const isAllCategories = computed(
  () =>
    (localConfig.value.hitokotoCategories?.length ?? 0) ===
    HITOKOTO_CATEGORIES.length,
)

// 全选切换
function toggleAllCategories(v: boolean) {
  localConfig.value.hitokotoCategories = v
    ? HITOKOTO_CATEGORIES.map((c) => c.key)
    : []
}

// 单个分类切换
function toggleCategory(key: string, v: boolean) {
  const list = localConfig.value.hitokotoCategories ?? []
  if (v) {
    if (!list.includes(key)) {
      localConfig.value.hitokotoCategories = [...list, key]
    }
  } else {
    localConfig.value.hitokotoCategories = list.filter((k) => k !== key)
  }
}

// 判断某分类是否已选
function isCategorySelected(key: string): boolean {
  return (localConfig.value.hitokotoCategories ?? []).includes(key)
}

function handleReset() {
  panelState.setPanelConfig({})
  toast.success('已重置')
  emit('reset')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 一言设置 -->
    <Card>
      <CardHeader>
        <CardTitle>一言设置</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <!-- 启用一言 -->
        <div class="flex items-center justify-between">
          <Label>启用一言</Label>
          <Switch
            :model-value="localConfig.hitokotoShow ?? false"
            @update:model-value="(v: boolean) => (localConfig.hitokotoShow = v)"
          />
        </div>

        <!-- 一言 API 地址 -->
        <div class="flex flex-col gap-2">
          <Label>一言 API 地址</Label>
          <Input
            v-model="localConfig.hitokotoApiUrl"
            placeholder="https://v1.hitokoto.cn/"
          />
          <p class="text-sm text-muted-foreground">
            默认 <code>https://v1.hitokoto.cn/</code>，可自建部署
          </p>
        </div>

        <!-- 一言分类（多选，Switch 开关网格） -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label>一言分类</Label>
            <div class="flex items-center gap-2">
              <Label class="text-sm text-muted-foreground">全选</Label>
              <Switch
                :model-value="isAllCategories"
                @update:model-value="(v: boolean) => toggleAllCategories(v)"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div
              v-for="cat in HITOKOTO_CATEGORIES"
              :key="cat.key"
              class="flex items-center justify-between gap-2 rounded-md border p-2"
            >
              <Label class="text-sm cursor-pointer">{{ cat.label }}</Label>
              <Switch
                :model-value="isCategorySelected(cat.key)"
                @update:model-value="(v: boolean) => toggleCategory(cat.key, v)"
              />
            </div>
          </div>
          <p class="text-sm text-muted-foreground">对应 hitokoto.cn 的 c 参数，空选表示全部</p>
        </div>

        <!-- 文字对齐 -->
        <div class="flex flex-col gap-2">
          <Label>文字对齐</Label>
          <Select
            :model-value="localConfig.hitokotoAlign ?? 'center'"
            @update:model-value="
              (v) => (localConfig.hitokotoAlign = v as 'left' | 'center')
            "
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择对齐方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="center">居中</SelectItem>
              <SelectItem value="left">左对齐</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- 打字机效果 -->
        <div class="flex items-center justify-between">
          <Label>打字机效果</Label>
          <Switch
            :model-value="localConfig.hitokotoTypewriter ?? false"
            @update:model-value="(v: boolean) => (localConfig.hitokotoTypewriter = v)"
          />
        </div>

        <!-- 完整出现时长 -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label>完整出现时长</Label>
            <span class="text-sm text-muted-foreground">
              {{ localConfig.hitokotoTypewriterDuration ?? 3 }} 秒
            </span>
          </div>
          <Slider
            :model-value="[localConfig.hitokotoTypewriterDuration ?? 3]"
            @update:model-value="
              (v: number[] | undefined) =>
                (localConfig.hitokotoTypewriterDuration = v?.[0] ?? 3)
            "
            :min="1"
            :max="20"
            :step="1"
          />
        </div>

        <!-- 光标样式 -->
        <div class="flex flex-col gap-2">
          <Label>光标样式</Label>
          <Select
            :model-value="localConfig.hitokotoTypewriterCursor ?? 'blink'"
            @update:model-value="
              (v) =>
                (localConfig.hitokotoTypewriterCursor = v as 'none' | 'block' | 'blink')
            "
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择光标样式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">无</SelectItem>
              <SelectItem value="block">块状</SelectItem>
              <SelectItem value="blink">闪烁</SelectItem>
            </SelectContent>
          </Select>
          <p class="text-sm text-muted-foreground">仅逐字动画下生效</p>
        </div>

        <!-- 动画方式 -->
        <div class="flex flex-col gap-2">
          <Label>动画方式</Label>
          <Select
            :model-value="localConfig.hitokotoTypewriterAnimation ?? 'type'"
            @update:model-value="
              (v) =>
                (localConfig.hitokotoTypewriterAnimation = v as 'type' | 'fade' | 'slide')
            "
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择动画方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="type">逐字</SelectItem>
              <SelectItem value="fade">淡入</SelectItem>
              <SelectItem value="slide">滑入</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- 显示出处 -->
        <div class="flex items-center justify-between">
          <Label>显示出处</Label>
          <Switch
            :model-value="localConfig.hitokotoShowFrom ?? true"
            @update:model-value="(v: boolean) => (localConfig.hitokotoShowFrom = v)"
          />
        </div>

        <!-- 显示作者 -->
        <div class="flex items-center justify-between">
          <Label>显示作者</Label>
          <Switch
            :model-value="localConfig.hitokotoShowFromWho ?? true"
            @update:model-value="(v: boolean) => (localConfig.hitokotoShowFromWho = v)"
          />
        </div>

        <!-- 自动轮播 -->
        <div class="flex items-center justify-between">
          <Label>自动轮播</Label>
          <Switch
            :model-value="localConfig.hitokotoAutoSwitch ?? false"
            @update:model-value="(v: boolean) => (localConfig.hitokotoAutoSwitch = v)"
          />
        </div>

        <!-- 轮播间隔 -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label>轮播间隔</Label>
            <span class="text-sm text-muted-foreground">
              {{ localConfig.hitokotoAutoSwitchInterval ?? 30 }} 秒
            </span>
          </div>
          <Slider
            :model-value="[localConfig.hitokotoAutoSwitchInterval ?? 30]"
            @update:model-value="
              (v: number[] | undefined) =>
                (localConfig.hitokotoAutoSwitchInterval = v?.[0] ?? 30)
            "
            :min="5"
            :max="300"
            :step="5"
          />
        </div>

        <!-- 切换过渡时长 -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label>切换过渡时长</Label>
            <span class="text-sm text-muted-foreground">
              {{ localConfig.hitokotoTransitionDuration ?? 0.3 }} 秒
            </span>
          </div>
          <Slider
            :model-value="[localConfig.hitokotoTransitionDuration ?? 0.3]"
            @update:model-value="
              (v: number[] | undefined) =>
                (localConfig.hitokotoTransitionDuration = v?.[0] ?? 0.3)
            "
            :min="0"
            :max="2"
            :step="0.1"
          />
        </div>
      </CardContent>
    </Card>

    <div class="flex justify-end gap-2">
      <Button variant="outline" @click="handleReset">重置</Button>
      <Button @click="handleSave">保存</Button>
    </div>
  </div>
</template>
