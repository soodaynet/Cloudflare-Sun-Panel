<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'

const router = useRouter()
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
    <div class="glass-panel rounded-2xl px-8 py-10 sm:px-12 flex flex-col items-center gap-6">
      <div class="text-7xl font-bold text-primary">404</div>
      <div>
        <h1 class="text-xl font-semibold">页面不存在</h1>
        <p class="mt-2 text-sm text-muted-foreground">你访问的页面可能已被删除或不存在</p>
      </div>
      <Button @click="router.push('/')">返回首页</Button>
    </div>
  </div>
</template>
