<script setup lang="ts">
import { watch } from 'vue'

const props = defineProps<{
  backgroundImageSrc: string
  backgroundBlur: number
  backgroundMaskNumber: number
}>()

function preloadBackgroundImage(url: string) {
  document.querySelector('link[rel="preload"][as="image"][data-wallpaper]')?.remove()
  if (!url) return
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = url
  link.setAttribute('data-wallpaper', 'true')
  document.head.appendChild(link)
}

watch(() => props.backgroundImageSrc, (url) => {
  preloadBackgroundImage(url)
}, { immediate: true })
</script>

<template>
  <template v-if="backgroundImageSrc">
    <!-- 壁纸层 -->
    <div class="fixed inset-0 z-[1]" :style="{
      filter: `blur(${backgroundBlur}px)`,
      transform: 'translateZ(0)',
      willChange: 'transform',
    }">
      <img :src="backgroundImageSrc" class="w-full h-full object-cover" fetchpriority="high" decoding="async" alt="" />
    </div>
    <!-- 遮罩层 -->
    <div class="fixed inset-0 z-[1]" :style="{
      backgroundColor: `rgba(0,0,0,${backgroundMaskNumber})`
    }" />
  </template>
</template>