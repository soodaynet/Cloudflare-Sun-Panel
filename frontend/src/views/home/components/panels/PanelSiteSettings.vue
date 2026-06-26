<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveSiteSettings } from '@/modules'

const props = defineProps<{
  siteConfig: Panel.SiteConfig
}>()

const emit = defineEmits<{
  (e: 'update:siteConfig', config: Panel.SiteConfig): void
}>()

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
      favicon_url: localSiteConfig.value.favicon_url || '',
    })
    if (res.code === 0) {
      emit('update:siteConfig', { ...localSiteConfig.value })
      toast.success('站点设置已保存')
    } else toast.error(res.msg || '保存失败')
  } catch {
    toast.error('保存失败')
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div>
      <h3 class="text-sm font-medium text-foreground mb-2">站点信息</h3>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-2">
          <Label>站点标题 (浏览器标签页)</Label>
          <Input v-model="localSiteConfig.site_title" placeholder="站点标题" />
        </div>
        <div class="flex flex-col gap-2">
          <Label>网站图标 URL (favicon)</Label>
          <Input v-model="localSiteConfig.favicon_url" placeholder="输入图标URL，显示在浏览器标签页上" />
        </div>
      </div>
    </div>
    <div>
      <h3 class="text-sm font-medium text-foreground mb-2">登录页背景</h3>
      <p class="text-sm text-muted-foreground mb-2">设置登录页的背景图片</p>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-2">
          <Label>登录页背景图片</Label>
          <Input v-model="localSiteConfig.login_bg_image" placeholder="输入图片URL" />
        </div>
      </div>
    </div>
    <div class="flex justify-end gap-2">
      <Button @click="handleSave">保存</Button>
    </div>
  </div>
</template>
