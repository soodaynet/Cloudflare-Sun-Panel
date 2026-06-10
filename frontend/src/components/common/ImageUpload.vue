<script setup lang="ts">
import { ref } from 'vue'
import { NButton, useMessage } from 'naive-ui'
import { uploadImage } from '@/api/upload'

const props = defineProps<{
  /** 当前图片 URL，用于回显 */
  modelValue?: string
  /** 按钮文字 */
  label?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', url: string): void
}>()

const message = useMessage()
const uploading = ref(false)

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // 客户端预检
  const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/bmp']
  if (!allowed.includes(file.type)) {
    message.error('不支持的文件格式，仅支持 PNG/JPEG/GIF/WebP/SVG/ICO/BMP')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    message.error('文件不能超过 10MB')
    return
  }

  uploading.value = true
  try {
    const res = await uploadImage(file)
    if (res.code === 0) {
      emit('update:modelValue', res.data.url)
      message.success('上传成功')
    } else {
      message.error(res.msg || '上传失败')
    }
  } catch {
    message.error('上传失败，请确认已配置 R2 存储')
  } finally {
    uploading.value = false
    input.value = '' // 清除 input，允许重复上传同一文件
  }
}
</script>

<template>
  <div class="inline-flex items-center gap-2">
    <NButton size="small" :loading="uploading" @click="($refs.fileInput as HTMLInputElement).click()">
      {{ uploading ? '上传中...' : (label || '上传图片') }}
    </NButton>
    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/x-icon,image/bmp"
      class="hidden"
      @change="handleFileChange"
    />
    <span v-if="modelValue" class="text-xs text-gray-400 truncate max-w-[120px]" :title="modelValue">
      {{ modelValue.split('/').pop() }}
    </span>
  </div>
</template>