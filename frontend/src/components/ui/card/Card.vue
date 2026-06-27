<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <!-- // shadcn-vue 生成，本地修改：圆角统一为 rounded-lg，与 dialog 保持一致 -->
  <div
    data-slot="card"
    :class="cn(
      'bg-card text-card-foreground flex flex-col gap-6 rounded-lg border py-6 shadow-sm',
      props.class,
    )"
  >
    <slot />
  </div>
</template>
