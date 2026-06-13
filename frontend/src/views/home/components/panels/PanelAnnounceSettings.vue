<script setup lang="ts">
import { toRef } from 'vue'
import { NButton } from 'naive-ui'
import { useConfigEditor } from '../../composables/useConfigEditor'

const props = defineProps<{
  panelConfig: Panel.panelConfig
  onSaved: () => void
}>()

const emit = defineEmits<{
  (e: 'save', config: Panel.panelConfig): void
}>()

const { localConfig, handleSave } = useConfigEditor({
  config: toRef(props, 'panelConfig'),
  onSaved: props.onSaved,
  onSave: (config) => emit('save', config),
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <label class="block text-sm mb-1 font-medium">公告内容</label>
      <textarea
        :value="localConfig.announcement"
        @input="(e: Event) => (localConfig.announcement = (e.target as HTMLInputElement).value)"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
        rows="3"
        placeholder="公告文字，留空不显示"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">公告停留时间 (秒，0为不自动消失)</label>
      <input
        :value="localConfig.announcementDuration"
        @input="(e: Event) => (localConfig.announcementDuration = Number((e.target as HTMLInputElement).value))"
        type="number"
        min="0"
        max="999"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
      />
    </div>
    <div class="border-t pt-3">
      <label class="block text-sm mb-1 font-medium">Logo 文字</label>
      <input
        :value="localConfig.logoText"
        @input="(e: Event) => (localConfig.logoText = (e.target as HTMLInputElement).value)"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
        placeholder="输入 Logo 文字"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">Logo 图片 URL</label>
      <input
        :value="localConfig.logoImageSrc"
        @input="(e: Event) => (localConfig.logoImageSrc = (e.target as HTMLInputElement).value)"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
        placeholder="输入图片URL"
      />
    </div>
    <div class="border-t pt-3">
      <label class="block text-sm mb-1 font-medium">Logo 距顶部 (px)</label>
      <input
        :value="localConfig.logoPositionTop"
        @input="(e: Event) => (localConfig.logoPositionTop = Number((e.target as HTMLInputElement).value))"
        type="number"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">Logo 距左侧 (px)</label>
      <input
        :value="localConfig.logoPositionLeft"
        @input="(e: Event) => (localConfig.logoPositionLeft = Number((e.target as HTMLInputElement).value))"
        type="number"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">Logo 图片高度 (px)</label>
      <input
        :value="localConfig.logoSize"
        @input="(e: Event) => (localConfig.logoSize = Number((e.target as HTMLInputElement).value))"
        type="number"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
      />
    </div>
    <div class="border-t pt-3">
      <label class="block text-sm mb-1 font-medium">背景模糊度: {{ localConfig.announcementBlur ?? 12 }}</label>
      <input
        :value="localConfig.announcementBlur"
        @input="(e: Event) => (localConfig.announcementBlur = Number((e.target as HTMLInputElement).value))"
        type="range"
        min="0"
        max="40"
        class="w-full"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium"
        >遮罩不透明度: {{ localConfig.announcementMaskOpacity ?? 0.15 }}</label
      >
      <input
        :value="localConfig.announcementMaskOpacity"
        @input="(e: Event) => (localConfig.announcementMaskOpacity = Number((e.target as HTMLInputElement).value))"
        type="range"
        min="0"
        max="1"
        step="0.05"
        class="w-full"
      />
    </div>
    <p class="text-xs text-gray-400">控制侧边栏、公告弹窗、Logo 的模糊和透明度效果</p>
    <div class="flex justify-end gap-2 pt-2 border-t">
      <NButton type="primary" @click="handleSave">保存</NButton>
    </div>
  </div>
</template>