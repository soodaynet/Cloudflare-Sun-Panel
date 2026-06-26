<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <form
    data-slot="form"
    :class="props.class"
  >
    <slot />
  </form>
</template>
