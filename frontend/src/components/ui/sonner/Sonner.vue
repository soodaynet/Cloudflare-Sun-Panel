<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { dismiss, type ToastPosition, type ToastType, useToast } from './use-toast'

const props = withDefaults(
  defineProps<{
    position?: ToastPosition
    class?: HTMLAttributes['class']
    richColors?: boolean
  }>(),
  {
    position: 'bottom-right',
    richColors: true,
  },
)

const { toasts } = useToast()

const positionClass = computed(() => {
  const map: Record<ToastPosition, string> = {
    'top-left': 'top-0 left-0 flex-col',
    'top-center': 'top-0 left-1/2 -translate-x-1/2 flex-col',
    'top-right': 'top-0 right-0 flex-col',
    'bottom-left': 'bottom-0 left-0 flex-col-reverse',
    'bottom-center': 'bottom-0 left-1/2 -translate-x-1/2 flex-col-reverse',
    'bottom-right': 'bottom-0 right-0 flex-col-reverse',
  }
  return map[props.position]
})

const iconMap: Record<ToastType, unknown> = {
  default: null,
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
}

const iconClass: Record<ToastType, string> = {
  default: 'text-foreground',
  success: 'text-emerald-500',
  error: 'text-destructive',
  warning: 'text-amber-500',
  info: 'text-blue-500',
}

const typeAccent: Record<ToastType, string> = {
  default: '',
  success: 'border-l-2 border-l-emerald-500',
  error: 'border-l-2 border-l-destructive',
  warning: 'border-l-2 border-l-amber-500',
  info: 'border-l-2 border-l-blue-500',
}
</script>

<template>
  <Teleport to="body">
    <ol
      data-slot="toaster"
      :class="cn(
        'pointer-events-none group fixed z-[100] flex max-h-screen w-full max-w-sm gap-2 p-4',
        positionClass,
        props.class,
      )"
    >
      <TransitionGroup
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-x-4 scale-95"
        enter-to-class="opacity-100 translate-x-0 scale-100"
        leave-active-class="transition duration-200 ease-in absolute"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 translate-x-4 scale-95"
        move-class="transition duration-300 ease-out"
      >
        <li
          v-for="(t, i) in toasts"
          :key="t.id"
          :data-type="t.type"
          :class="cn(
            'bg-background text-foreground pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-md border p-4 shadow-lg transition-all duration-300',
            richColors ? typeAccent[t.type] : '',
            // 非最新项默认折叠堆叠，鼠标移入容器时展开显示全部
            i < toasts.length - 1 && 'max-h-0 scale-95 border-transparent opacity-0 py-0 shadow-none group-hover:max-h-96 group-hover:scale-100 group-hover:opacity-100 group-hover:py-4 group-hover:border group-hover:shadow-lg',
          )"
        >
          <component
            :is="iconMap[t.type]"
            v-if="iconMap[t.type]"
            :class="cn('mt-0.5 size-5 shrink-0', iconClass[t.type])"
          />
          <div class="grid gap-1 flex-1">
            <div v-if="t.title" class="text-sm font-semibold">
              {{ t.title }}
            </div>
            <div v-if="t.description" class="text-muted-foreground text-sm">
              {{ t.description }}
            </div>
          </div>
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground absolute top-1.5 right-1.5 rounded-md p-0.5 transition-colors focus:outline-none"
            aria-label="Close"
            @click="dismiss(t.id)"
          >
            <X class="size-4" />
          </button>
        </li>
      </TransitionGroup>
    </ol>
  </Teleport>
</template>
