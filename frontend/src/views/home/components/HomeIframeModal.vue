<script setup lang="ts">
import { computed } from 'vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const props = defineProps<{
  visible: boolean
  src: string
  title: string
  isLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'loaded'): void
}>()

const show = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})
</script>

<template>
  <Dialog v-model:open="show">
    <DialogContent
      class="max-w-[1000px] w-[95vw] h-[85vh] sm:h-[600px] rounded-2xl p-0"
      @pointer-down-outside.prevent
    >
      <DialogHeader class="px-4 py-3 border-b">
        <DialogTitle class="flex items-center">
          <span class="mr-5">{{ title }}</span>
          <span
            v-if="isLoading"
            class="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"
          />
        </DialogTitle>
      </DialogHeader>
      <div class="w-full h-[calc(100%-49px)] rounded-2xl overflow-hidden border dark:border-zinc-700">
        <div v-if="isLoading" class="flex flex-col p-5">
          <div class="h-[50px] w-full rounded-lg bg-muted animate-pulse" />
          <div class="h-[180px] w-full mt-5 rounded-lg bg-muted animate-pulse" />
          <div class="h-[180px] w-full mt-5 rounded-lg bg-muted animate-pulse" />
        </div>
        <iframe v-show="!isLoading" :src="src" class="w-full h-full" frameborder="0" @load="emit('loaded')" />
      </div>
    </DialogContent>
  </Dialog>
</template>
