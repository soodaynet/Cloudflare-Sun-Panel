<script setup lang="ts">
import { ref, watch } from 'vue'
import { NButton } from 'naive-ui'
import { useMessage } from 'naive-ui'
import { saveSiteSettings } from '@/api/index'
import ImageUpload from '@/components/common/ImageUpload.vue'

const props = defineProps<{
  siteConfig: Panel.SiteConfig
}>()

const emit = defineEmits<{
  (e: 'update:siteConfig', config: Panel.SiteConfig): void
}>()

const message = useMessage()

const localSiteConfig = ref<Panel.SiteConfig>({})

function syncSiteConfig() {
  localSiteConfig.value = { ...props.siteConfig }
}

watch(
  () => props.siteConfig,
  () => syncSiteConfig(),
  { immediate: true, deep: true },
)

async function handleSave() {
  try {
    const res = await saveSiteSettings({
      site_title: localSiteConfig.value.site_title || '',
      login_bg_image: localSiteConfig.value.login_bg_image || '',
      login_blur: String(localSiteConfig.value.login_blur ?? 12),
      login_mask_opacity: String(localSiteConfig.value.login_mask_opacity ?? 0.15),
      favicon_url: localSiteConfig.value.favicon_url || '',
    })
    if (res.code === 0) {
      emit('update:siteConfig', { ...localSiteConfig.value })
      message.success('站点设置已保存')
    } else message.error(res.msg || '保存失败')
  } catch {
    message.error('保存失败')
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <label class="block text-sm mb-1 font-medium">站点标题 (浏览器标签页)</label>
      <input
        :value="localSiteConfig.site_title"
        @input="(e: Event) => (localSiteConfig.site_title = (e.target as HTMLInputElement).value)"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base"
        placeholder="站点标题"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">网站图标 URL (favicon)</label>
      <input
        :value="localSiteConfig.favicon_url"
        @input="(e: Event) => (localSiteConfig.favicon_url = (e.target as HTMLInputElement).value)"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base mb-2"
        placeholder="输入图标URL，显示在浏览器标签页上"
      />
      <ImageUpload
        :model-value="localSiteConfig.favicon_url"
        label="上传 Favicon"
        @update:model-value="(url: string) => (localSiteConfig.favicon_url = url)"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium">登录页背景图片</label>
      <input
        :value="localSiteConfig.login_bg_image"
        @input="(e: Event) => (localSiteConfig.login_bg_image = (e.target as HTMLInputElement).value)"
        class="w-full border rounded px-3 py-2 sm:text-sm text-base mb-2"
        placeholder="输入图片URL"
      />
      <ImageUpload
        :model-value="localSiteConfig.login_bg_image"
        label="上传背景图"
        @update:model-value="(url: string) => (localSiteConfig.login_bg_image = url)"
      />
    </div>
    <div class="border-t pt-3">
      <label class="block text-sm mb-1 font-medium">登录卡片背景模糊度: {{ localSiteConfig.login_blur ?? 12 }}</label>
      <input
        :value="localSiteConfig.login_blur"
        @input="(e: Event) => (localSiteConfig.login_blur = Number((e.target as HTMLInputElement).value))"
        type="range"
        min="0"
        max="40"
        class="w-full"
      />
    </div>
    <div>
      <label class="block text-sm mb-1 font-medium"
        >登录卡片遮罩不透明度: {{ localSiteConfig.login_mask_opacity ?? 0.15 }}</label
      >
      <input
        :value="localSiteConfig.login_mask_opacity"
        @input="(e: Event) => (localSiteConfig.login_mask_opacity = Number((e.target as HTMLInputElement).value))"
        type="range"
        min="0"
        max="1"
        step="0.05"
        class="w-full"
      />
    </div>
    <p class="text-xs text-gray-400">控制登录页卡片背景的模糊和透明度效果</p>
    <div class="flex justify-end gap-2 pt-2 border-t">
      <NButton type="primary" @click="handleSave">保存</NButton>
    </div>
  </div>
</template>
