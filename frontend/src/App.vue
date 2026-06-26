<script setup lang="ts">
import { Toaster } from '@/components/ui/sonner'
import { useTheme } from './hooks/useTheme'

// 初始化主题：基于 CSS 变量向 <html> 切换 `dark` class
useTheme()
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="page-fade">
      <component :is="Component" />
    </Transition>
  </RouterView>
  <Toaster position="top-right" class="pt-20" />
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
}
</style>
