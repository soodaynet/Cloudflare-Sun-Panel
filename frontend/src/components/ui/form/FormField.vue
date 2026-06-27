<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

const props = defineProps<{ name?: string; class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div
    data-slot="form-field"
    :class="props.class"
  >
    <slot />
  </div>
</template>
