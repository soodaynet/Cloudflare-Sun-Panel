<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { SliderRootProps } from 'reka-ui'
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<Omit<SliderRootProps, 'modelValue'> & { class?: HTMLAttributes['class'] }>()
const modelValue = defineModel<number[]>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <SliderRoot
    data-slot="slider"
    v-bind="delegatedProps"
    v-model="modelValue"
    :class="cn(
      'relative flex w-full touch-none select-none items-center',
      props.class,
    )"
  >
    <SliderTrack
      data-slot="slider-track"
      :class="cn(
        'relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20',
      )"
    >
      <SliderRange
        data-slot="slider-range"
        :class="cn(
          'absolute h-full bg-primary',
        )"
      />
    </SliderTrack>
    <SliderThumb
      data-slot="slider-thumb"
      :class="cn(
        'block h-4 w-4 rounded-full border border-primary bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
      )"
    />
  </SliderRoot>
</template>
