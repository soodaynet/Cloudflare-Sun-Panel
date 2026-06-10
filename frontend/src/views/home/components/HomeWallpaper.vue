<script setup lang="ts">
defineProps<{
  backgroundImageSrc: string
  backgroundBlur: number
  backgroundMaskNumber: number
}>()
</script>

<template>
  <template v-if="backgroundImageSrc">
    <!-- CSS background-image 方式渲染壁纸：异步解码，不阻塞主线程 -->
    <!-- bg-[#1a1a2e] 作为加载期间的纯色占位，配合 index.html 中的 preload 确保首屏即显示 -->
    <div
      class="fixed inset-0 z-[1] bg-[#1a1a2e] bg-cover bg-center"
      :style="{
        backgroundImage: `url(${backgroundImageSrc})`,
        filter: `blur(${backgroundBlur}px)`,
        transform: 'translateZ(0)',
        willChange: 'transform',
      }"
    />
    <!-- 遮罩层 -->
    <div
      class="fixed inset-0 z-[1]"
      :style="{
        backgroundColor: `rgba(0,0,0,${backgroundMaskNumber})`,
      }"
    />
  </template>
  <!-- 无壁纸时的纯色背景 -->
  <div v-else class="fixed inset-0 z-[1] bg-[#1a1a2e]" />
</template>