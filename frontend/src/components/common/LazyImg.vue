<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

const props = withDefaults(defineProps<{
  src: string
  alt?: string
  /** 图片加载失败后是否显示文字回退 */
  fallbackText?: string
  fallbackBg?: string
  /** 是否使用 IntersectionObserver 懒加载（默认 true） */
  lazy?: boolean
  /** 距离视口的提前加载距离 (px) */
  rootMargin?: string
}>(), {
  alt: '',
  fallbackBg: '#4a90d9',
  lazy: true,
  rootMargin: '200px',
})

const emit = defineEmits<{
  (e: 'loaded'): void
  (e: 'error'): void
}>()

const loaded = ref(false)
const errored = ref(false)
const inView = ref(!props.lazy)

let observer: IntersectionObserver | null = null
const imgRef = ref<HTMLElement | null>(null)

const showSrc = computed(() => (inView.value && !errored.value) ? props.src : '')

function onLoad() {
  loaded.value = true
  emit('loaded')
}

function onError() {
  errored.value = true
  emit('error')
}

onMounted(() => {
  if (!props.lazy) {
    inView.value = true
    return
  }
  if ('loading' in HTMLImageElement.prototype) {
    inView.value = true
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        inView.value = true
        observer?.disconnect()
        observer = null
      }
    },
    { rootMargin: props.rootMargin }
  )
  if (!imgRef.value) return
  observer.observe(imgRef.value)
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <div ref="imgRef" class="lazy-img-wrapper w-full h-full relative">
    <!-- 加载中动画 -->
    <div
      v-if="!loaded && !errored && inView"
      class="absolute inset-0 rounded-lg flex items-center justify-center"
      :style="{ backgroundColor: fallbackBg + '20' }"
    >
      <div class="w-4 h-4 border-2 border-white/40 border-t-white/80 rounded-full animate-spin" />
    </div>

    <!-- 错误回退：显示默认地球图标 -->
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

    <!-- 错误回退：显示文字图标 -->
    <div
      v-else-if="errored && fallbackText"
      class="w-full h-full rounded-lg flex items-center justify-center text-white font-bold text-lg"
      :style="{ backgroundColor: fallbackBg }"
    >
      {{ fallbackText.charAt(0) || '?' }}
    </div>

    <!-- 正常图片 -->
    <img
      v-else
      :src="showSrc"
      :alt="alt"
      :data-lazy-img="src"
      loading="lazy"
      decoding="async"
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