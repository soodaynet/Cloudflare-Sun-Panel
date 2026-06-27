<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore, usePanelState } from '@/store'

const authStore = useAuthStore()
const panelState = usePanelState()

const logoText = computed(() => panelState.panelConfig.logoText || '')

const logoImgStyle = computed(() => {
  const size = panelState.panelConfig.logoSize
  return size ? { height: `${size}px`, width: 'auto' } : { height: '32px', width: 'auto' }
})
</script>

<template>
  <div
    v-if="panelState.panelConfig.logoImageSrc || logoText || authStore.isVisitMode"
    class="home-logo flex justify-center items-center gap-2 sm:gap-3 mb-4"
  >
    <img
      v-if="panelState.panelConfig.logoImageSrc"
      :src="panelState.panelConfig.logoImageSrc"
      :style="logoImgStyle"
      alt="Logo"
      width="128"
      height="32"
      fetchpriority="high"
      loading="eager"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="($event.target as HTMLImageElement).style.display = 'none'"
    />
    <span v-if="logoText" class="text-white text-base sm:text-xl font-bold">{{ logoText }}</span>
    <span
      v-if="authStore.isVisitMode"
      class="text-yellow-400 text-[10px] sm:text-xs bg-yellow-900/50 px-1.5 sm:px-2 py-0.5 rounded"
      >访客模式</span
    >
  </div>
</template>

<style scoped>
/* 流式布局：移除原 position fixed，改为正常文档流居中显示 */
.home-logo {
  z-index: 40;
}
</style>
