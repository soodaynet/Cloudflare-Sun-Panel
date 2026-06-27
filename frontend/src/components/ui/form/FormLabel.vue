<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <label
    data-slot="form-label"
    :class="cn('data-[error=true]:text-destructive text-sm leading-none font-medium', props.class)"
  >
    <slot />
  </label>
</template>
