<script setup lang="ts">
defineProps<{
  backgroundImageSrc: string
  backgroundBlur: number
  backgroundMaskNumber: number
}>()
</script>

<template>
  <template v-if="backgroundImageSrc">
    <!-- img 标签渲染壁纸：支持 fetchpriority="high" 优先加载 -->
    <img
      :src="backgroundImageSrc"
      alt=""
      fetchpriority="high"
      decoding="sync"
      class="fixed inset-0 z-[1] w-full min-h-full object-cover"
      :style="{
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