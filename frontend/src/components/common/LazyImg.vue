<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  src: string
  alt?: string
  srcset?: string
  sizes?: string
  fetchpriority?: 'high' | 'low' | 'auto'
  fallbackText?: string
  fallbackBg?: string
  /** IntersectionObserver 懒加载，rootMargin=300px，未入镜时不设 src */
  lazy?: boolean
  nativeLoading?: 'eager' | 'lazy'
}>(), {
  alt: '',
  srcset: '',
  sizes: '',
  fetchpriority: 'auto',
  fallbackBg: '#4a90d9',
  lazy: true,
  nativeLoading: undefined,
})

const emit = defineEmits<{
  (e: 'loaded'): void
  (e: 'error'): void
}>()

const loaded = ref(false)
const errored = ref(false)
const shouldLoad = ref(!props.lazy)

const wrapperRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (!props.lazy || shouldLoad.value) return

  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        shouldLoad.value = true
        observer?.disconnect()
      }
    },
    { rootMargin: '300px' },
  )

  if (wrapperRef.value) {
    observer.observe(wrapperRef.value)
  }
})

onUnmounted(() => {
  observer?.disconnect()
})

const showSrc = computed(() => (!errored.value && shouldLoad.value) ? props.src : '')

function onLoad() {
  loaded.value = true
  emit('loaded')
}

function onError() {
  errored.value = true
  emit('error')
}
</script>

<template>
  <div ref="wrapperRef" class="lazy-img-wrapper w-full h-full relative">
    <!-- 加载中骨架屏 -->
    <div
      v-if="!loaded && !errored"
      class="absolute inset-0 rounded-lg flex items-center justify-center"
      :style="{ backgroundColor: fallbackBg + '20' }"
    >
      <div class="w-4 h-4 border-2 border-white/40 border-t-white/80 rounded-full animate-spin" />
    </div>

    <!-- 错误回退：默认图标 -->
    <div
      v-if="errored && !fallbackText"
      class="w-full h-full rounded-lg flex items-center justify-center"
      :style="{ backgroundColor: fallbackBg }"
    >
      <svg class="w-4 h-4 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <ellipse cx="12" cy="12" rx="4" ry="10" />
        <path d="M2 12h20" />
      </svg>
    </div>

    <!-- 错误回退：文字图标 -->
    <div
      v-else-if="errored && fallbackText"
      class="w-full h-full rounded-lg flex items-center justify-center text-white font-bold text-lg"
      :style="{ backgroundColor: fallbackBg }"
    >
      {{ fallbackText.charAt(0) || '?' }}
    </div>

    <!-- 正常图片：shouldLoad 为 true 时才设置 src（IntersectionObserver 触发） -->
    <img
      v-if="shouldLoad"
      :src="showSrc"
      :srcset="srcset"
      :sizes="sizes"
      :alt="alt"
      :fetchpriority="fetchpriority"
      :loading="nativeLoading || (lazy ? 'lazy' : 'eager')"
      decoding="async"
      referrerpolicy="no-referrer"
      class="lazy-img w-full h-full object-cover"
      :class="{ 'opacity-0': !loaded, 'opacity-100': loaded }"
      @load="onLoad"
      @error="onError"
    />
  </div>
</template>

<style scoped>
.lazy-img-wrapper {
  overflow: hidden;
  border-radius: inherit;
}

.lazy-img {
  transition: opacity 0.3s ease;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
.animate-spin {
  animation: spin 0.8s linear infinite;
}
</style>