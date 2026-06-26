<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <tr
    data-slot="table-empty"
    :class="cn('hover:bg-transparent', props.class)"
  >
    <td
      colspan="100%"
      class="text-muted-foreground p-4 text-center align-middle"
    >
      <slot />
    </td>
  </tr>
</template>
