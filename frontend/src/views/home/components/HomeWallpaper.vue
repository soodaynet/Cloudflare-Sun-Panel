<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  backgroundImageSrc: string
  backgroundBlur: number
  backgroundMaskNumber: number
  backgroundType?: string
}>()

const isVideo = computed(() => /\.(mp4|webm|ogg)(\?.*)?$/i.test(props.backgroundImageSrc))

// ========== 双图层交叉淡入淡出 ==========
// 始终把新图片放到当前不活跃的图层，旧图层保持显示直到新图层加载完成
// 然后同时切换：旧图层 opacity 1→0，新图层 opacity 0→1
const layerA = ref({ src: '', loaded: false, active: false })
const layerB = ref({ src: '', loaded: false, active: false })

function clearLayers() {
  layerA.value = { src: '', loaded: false, active: false }
  layerB.value = { src: '', loaded: false, active: false }
}

watch(
  () => props.backgroundImageSrc,
  (newUrl, oldUrl) => {
    if (isVideo.value || !newUrl) {
      clearLayers()
      return
    }
    if (newUrl === oldUrl) return

    // 新 URL 放到当前不活跃的图层上
    if (!layerA.value.active) {
      layerA.value = { src: newUrl, loaded: false, active: false }
    } else {
      layerB.value = { src: newUrl, loaded: false, active: false }
    }
  },
  { immediate: true },
)

/** 新图层加载完成后的交叉过渡：激活新图层，停用旧图层 */
function handleLayerLoad(layer: typeof layerA, otherLayer: typeof layerA) {
  layer.value = { ...layer.value, loaded: true }

  if (otherLayer.value.active) {
    // 交叉过渡：旧图层淡出，新图层淡入（CSS transition 同步处理）
    layer.value = { ...layer.value, active: true }
    otherLayer.value = { ...otherLayer.value, active: false }
    // 600ms 后清除旧图层 DOM（transition 500ms + 100ms 缓冲）
    setTimeout(() => {
      if (otherLayer.value.src && !otherLayer.value.active) {
        otherLayer.value = { src: '', loaded: false, active: false }
      }
    }, 600)
  } else {
    // 首次加载：直接激活，无交叉过渡
    layer.value = { ...layer.value, active: true }
  }
}

function onLayerALoad() {
  handleLayerLoad(layerA, layerB)
}

function onLayerBLoad() {
  handleLayerLoad(layerB, layerA)
}
</script>

<template>
  <template v-if="backgroundImageSrc">
    <!-- 视频背景 -->
    <video
      v-if="isVideo"
      :src="backgroundImageSrc"
      autoplay
      loop
      muted
      playsinline
      class="fixed inset-0 z-[1] w-full h-full object-cover"
      :style="{
        filter: `blur(${backgroundBlur}px)`,
        contain: 'strict',
        contentVisibility: 'auto',
      }"
    />
    <!-- 静态图片：双图层交叉淡入淡出 -->
    <template v-else>
      <img
        v-if="layerA.src"
        :src="layerA.src"
        alt=""
        fetchpriority="high"
        loading="eager"
        decoding="async"
        class="fixed inset-0 z-[1] w-full h-full object-cover wallpaper-img"
        :class="{ 'wallpaper-active': layerA.active }"
        :style="{
          filter: `blur(${backgroundBlur}px)`,
          contain: 'strict',
          contentVisibility: 'auto',
        }"
        @load="onLayerALoad"
      />
      <img
        v-if="layerB.src"
        :src="layerB.src"
        alt=""
        fetchpriority="high"
        loading="eager"
        decoding="async"
        class="fixed inset-0 z-[2] w-full h-full object-cover wallpaper-img"
        :class="{ 'wallpaper-active': layerB.active }"
        :style="{
          filter: `blur(${backgroundBlur}px)`,
          contain: 'strict',
          contentVisibility: 'auto',
        }"
        @load="onLayerBLoad"
      />
    </template>
    <!-- 遮罩层 -->
    <div
      class="fixed inset-0 z-[3]"
      :style="{
        backgroundColor: `rgba(0,0,0,${backgroundMaskNumber})`,
        contain: 'strict',
      }"
    />
  </template>
  <!-- 无壁纸时的渐变背景 -->
  <div v-else class="fixed inset-0 z-[1]" style="background: #dce2e8; contain: strict" />
</template>

<style scoped>
/* 双图层交叉淡入淡出：新图 opacity 0→1，旧图 opacity 1→0，同步过渡 0.5s */
.wallpaper-img {
  opacity: 0;
  transition: opacity 0.5s ease-in-out;
}
.wallpaper-img.wallpaper-active {
  opacity: 1;
}
</style>