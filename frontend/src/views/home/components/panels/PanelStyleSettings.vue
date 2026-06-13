<script setup lang="ts">
import { toRef } from 'vue'
import { NButton } from 'naive-ui'
import { useMessage } from 'naive-ui'
import { useConfigEditor } from '../../composables/useConfigEditor'

const props = defineProps<{
  panelConfig: Panel.panelConfig
  onSaved: () => void
}>()

const emit = defineEmits<{
  (e: 'save', config: Panel.panelConfig): void
  (e: 'reset'): void
}>()

const message = useMessage()

const { localConfig, handleSave, panelState } = useConfigEditor({
  config: toRef(props, 'panelConfig'),
  onSaved: props.onSaved,
  onSave: (config) => emit('save', config),
})

function handleReset() {
  panelState.setPanelConfig({})
  message.success('已重置')
  emit('reset')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <label class="block text-sm mb-1 font-medium">壁纸地址</label>
      <input
        :value="localConfig.backgroundImageSrc"
        @input="(e: Event) => (localConfig.backgroundImageSrc = (e.target as HTMLInputElement).value)"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base mb-2"
        placeholder="输入图片URL"
      />
      
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">模糊度: {{ localConfig.backgroundBlur || 0 }}</label>
      <input
        :value="localConfig.backgroundBlur"
        @input="(e: Event) => (localConfig.backgroundBlur = Number((e.target as HTMLInputElement).value))"
        type="range"
        min="0"
        max="50"
        class="w-full"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">遮罩不透明度: {{ localConfig.backgroundMaskNumber ?? 0.3 }}</label>
      <input
        :value="localConfig.backgroundMaskNumber"
        @input="(e: Event) => (localConfig.backgroundMaskNumber = Number((e.target as HTMLInputElement).value))"
        type="range"
        min="0"
        max="1"
        step="0.1"
        class="w-full"
      />
    </div>
    <div class="border-t pt-3">
      <label class="block text-sm mb-1 font-medium">自定义页脚 (支持 HTML)</label>
      <textarea
        :value="localConfig.footerHtml"
        @input="(e: Event) => (localConfig.footerHtml = (e.target as HTMLInputElement).value)"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
        rows="3"
        placeholder="<p>&copy; 2024 Sun-Panel</p>"
      />
    </div>
    <div class="border-t pt-2">
      <label class="block text-sm mb-1 font-medium">最大宽度</label>
      <input
        :value="localConfig.maxWidth"
        @input="(e: Event) => (localConfig.maxWidth = Number((e.target as HTMLInputElement).value))"
        type="number"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">上边距</label>
      <input
        :value="localConfig.marginTop"
        @input="(e: Event) => (localConfig.marginTop = Number((e.target as HTMLInputElement).value))"
        type="number"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">下边距</label>
      <input
        :value="localConfig.marginBottom"
        @input="(e: Event) => (localConfig.marginBottom = Number((e.target as HTMLInputElement).value))"
        type="number"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
      />
    </div>
    <div class="flex justify-end gap-2 pt-2 border-t">
      <NButton @click="handleReset">重置</NButton>
      <NButton type="primary" @click="handleSave">保存</NButton>
    </div>
  </div>
</template>