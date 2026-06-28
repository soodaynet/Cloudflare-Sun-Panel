<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  ListMusic,
  Repeat,
  Repeat1,
  Shuffle,
  X,
} from 'lucide-vue-next'
import { parseMusic } from '@/modules'
import type { MusicTrack } from '@/modules'
import { usePanelState } from '@/store'

// 返回顶部按钮可见状态：控制音乐按钮 bottom 位置避让
const props = defineProps<{ backTopVisible?: boolean }>()

// 首页音乐播放器浮窗：原生 <audio> + 自定义 UI，不依赖 APlayer/MetingJS
const panelState = usePanelState()

// ====== 状态 ======
const tracks = ref<MusicTrack[]>([])
const currentIndex = ref(0)
const isPlaying = ref(false)
// 播放意图：用户点击播放或 autoplay 触发后置 true，待 canplay 时真正播放
const wantPlay = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref<number>(panelState.panelConfig.musicVolume ?? 0.7)
const loop = ref<'all' | 'one' | 'none'>(panelState.panelConfig.musicLoop ?? 'all')
const order = ref<'list' | 'random'>(panelState.panelConfig.musicOrder ?? 'list')
const expanded = ref(false)
// 折叠态按钮 / 展开态卡片 bottom 位置：返回顶部不可见时位于其位置（1rem），可见时上移避让（5rem）
const fabBottomStyle = computed(() => ({
  bottom: props.backTopVisible ? '5rem' : '1rem',
  transition: 'bottom 0.3s ease',
}))
// 展开态卡片根元素引用，用于点击外部检测
const cardRef = ref<HTMLElement | null>(null)
// 抑制本次 pointerdown 触发外部收起（避免展开按钮点击立即触发收起）
let suppressCollapseOnNextPointerDown = false
const showPlaylist = ref(false)
const loadError = ref(false)
const audioRef = ref<HTMLAudioElement | null>(null)

// ====== 计算属性 ======
const currentTrack = computed<MusicTrack | undefined>(() => tracks.value[currentIndex.value])
const progressPercent = computed(() =>
  duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0,
)
const volumePercent = computed(() => volume.value * 100)

// ====== 工具：时间格式化 mm:ss ======
function formatTime(sec: number): string {
  if (!sec || !isFinite(sec)) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 封面加载失败时隐藏图片，避免破损图标
function handleImgError(e: Event) {
  const target = e.target as HTMLImageElement
  target.style.opacity = '0'
}

// 展开卡片：置 expanded 为 true，并抑制本次 pointerdown 的外部收起检测
function handleExpand() {
  expanded.value = true
  suppressCollapseOnNextPointerDown = true
}

// document pointerdown 监听：点击卡片外部时收起
function handleDocumentPointerDown(e: PointerEvent) {
  if (suppressCollapseOnNextPointerDown) {
    suppressCollapseOnNextPointerDown = false
    return
  }
  if (expanded.value && cardRef.value && !cardRef.value.contains(e.target as Node)) {
    expanded.value = false
  }
}

// ====== 加载歌单 ======
async function loadTracks() {
  const config = panelState.panelConfig
  if (!config.musicId) {
    tracks.value = []
    loadError.value = false
    return
  }
  try {
    // parseMusic 直连上游 Meting API，返回裸 MusicTrack[]（不再有 code/msg/data 包装）
    const data = await parseMusic({
      server: config.musicServer ?? 'netease',
      type: config.musicType ?? 'playlist',
      id: config.musicId ?? '',
      apiUrl: config.musicApiUrl ?? 'https://api.moeyao.cn/meting/',
    })
    tracks.value = Array.isArray(data) ? data : []
    currentIndex.value = 0
    loadError.value = false
    // 自动播放：tracks 填充后 watch 会更新 src，onCanPlay 会触发 play
    if (tracks.value.length > 0 && config.musicAutoplay) {
      wantPlay.value = true
    }
  } catch {
    tracks.value = []
    loadError.value = true
  }
}

// ====== 播放控制 ======
function togglePlay() {
  if (!audioRef.value || !currentTrack.value) return
  if (isPlaying.value) {
    audioRef.value.pause()
    wantPlay.value = false
    return
  }
  wantPlay.value = true
  // 已就绪直接播放；否则确保 src 已设置，等 canplay 触发
  if (audioRef.value.readyState >= 2) {
    audioRef.value.play().catch(() => {
      wantPlay.value = false
    })
  } else if (!audioRef.value.src) {
    audioRef.value.src = currentTrack.value.url
    audioRef.value.load()
  }
}

// 切歌：设置 currentIndex，watch 更新 src，onCanPlay 触发播放
function playTrack(index: number) {
  if (index < 0 || index >= tracks.value.length) return
  wantPlay.value = true
  currentIndex.value = index
}

function playNext() {
  if (tracks.value.length === 0) return
  // 单曲循环：重播当前
  if (loop.value === 'one') {
    if (audioRef.value) {
      audioRef.value.currentTime = 0
      audioRef.value.play().catch(() => {})
    }
    return
  }
  let next: number
  if (order.value === 'random') {
    if (tracks.value.length === 1) {
      next = currentIndex.value
    } else {
      do {
        next = Math.floor(Math.random() * tracks.value.length)
      } while (next === currentIndex.value)
    }
  } else {
    next = currentIndex.value + 1
    if (next >= tracks.value.length) {
      // 不循环且已是最后一首：停止
      if (loop.value === 'none') {
        wantPlay.value = false
        isPlaying.value = false
        return
      }
      // list + all：回到第一首
      next = 0
    }
  }
  playTrack(next)
}

function playPrev() {
  if (tracks.value.length === 0) return
  let prev: number
  if (order.value === 'random') {
    if (tracks.value.length === 1) {
      prev = currentIndex.value
    } else {
      do {
        prev = Math.floor(Math.random() * tracks.value.length)
      } while (prev === currentIndex.value)
    }
  } else {
    prev = currentIndex.value - 1
    if (prev < 0) {
      prev = loop.value === 'all' ? tracks.value.length - 1 : 0
    }
  }
  playTrack(prev)
}

// 进度拖动
function seek(e: Event) {
  const target = e.target as HTMLInputElement
  if (!audioRef.value || !duration.value) return
  audioRef.value.currentTime = (target.valueAsNumber / 100) * duration.value
  currentTime.value = audioRef.value.currentTime
}

// 音量
function setVolume(e: Event) {
  const target = e.target as HTMLInputElement
  const v = Number(target.value)
  if (audioRef.value) audioRef.value.volume = v
  volume.value = v
}

// 循环模式：all → one → none → all
function toggleLoop() {
  loop.value = loop.value === 'all' ? 'one' : loop.value === 'one' ? 'none' : 'all'
}

// 播放顺序：list → random → list
function toggleOrder() {
  order.value = order.value === 'list' ? 'random' : 'list'
}

// ====== audio 事件处理 ======
function onTimeUpdate() {
  if (audioRef.value) currentTime.value = audioRef.value.currentTime
}
function onLoadedMetadata() {
  if (audioRef.value) duration.value = audioRef.value.duration
}
function onCanPlay() {
  // 待播放意图满足时触发播放
  if (wantPlay.value && audioRef.value) {
    audioRef.value.play().catch(() => {
      wantPlay.value = false
    })
  }
}
function onPlay() {
  isPlaying.value = true
}
function onPause() {
  isPlaying.value = false
}
function onEnded() {
  playNext()
}

// ====== 生命周期 ======
onMounted(() => {
  if (audioRef.value) {
    audioRef.value.volume = volume.value
  }
  loadTracks()
  // 注册 document pointerdown 监听，实现点击卡片外部收起
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})

// 当前曲目 url 变化时加载新源
watch(
  () => currentTrack.value?.url,
  (url) => {
    if (!url || !audioRef.value) return
    audioRef.value.src = url
    audioRef.value.load()
  },
)
</script>

<template>
  <!-- 隐藏的原生 audio 元素 -->
  <audio
    ref="audioRef"
    class="hidden"
    @timeupdate="onTimeUpdate"
    @loadedmetadata="onLoadedMetadata"
    @canplay="onCanPlay"
    @play="onPlay"
    @pause="onPause"
    @ended="onEnded"
  />

  <!-- ====== 折叠态：圆形按钮 ====== -->
  <button
    v-if="!expanded"
    type="button"
    title="音乐播放器"
    class="music-glass fixed right-4 z-40 size-12 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-200"
    :class="{ playing: isPlaying }"
    :style="fabBottomStyle"
    @click="handleExpand"
  >
    <Music class="size-5" />
    <!-- 失败或空曲目时显示红点 -->
    <span
      v-if="loadError || tracks.length === 0"
      class="absolute top-1 right-1 size-2 rounded-full bg-red-500 ring-2 ring-black/20"
    ></span>
  </button>

  <!-- ====== 展开态：卡片 ====== -->
  <div
    v-else
    ref="cardRef"
    class="music-glass fixed right-4 z-40 w-72 rounded-xl p-3 shadow-xl"
    :style="fabBottomStyle"
  >
    <!-- 失败 / 空状态 -->
    <div v-if="loadError || tracks.length === 0" class="flex items-center justify-between gap-2 py-2">
      <span class="text-sm text-white/80">{{ loadError ? '加载失败' : '暂无曲目' }}</span>
      <div class="flex items-center gap-1">
        <button
          v-if="loadError"
          type="button"
          class="text-xs text-white/70 hover:text-white px-2 py-1 rounded hover:bg-white/10"
          @click="loadTracks"
        >
          重试
        </button>
        <button
          type="button"
          title="收起"
          class="text-white/60 hover:text-white p-1 rounded hover:bg-white/10"
          @click="expanded = false"
        >
          <X class="size-4" />
        </button>
      </div>
    </div>

    <!-- 正常播放器 -->
    <template v-else-if="currentTrack">
      <!-- 顶部：封面 + 歌名/歌手 + 关闭 -->
      <div class="flex items-center gap-2">
        <img
          :src="currentTrack.pic"
          :alt="currentTrack.name"
          class="size-12 rounded object-cover bg-white/10 flex-shrink-0"
          loading="lazy"
          @error="handleImgError"
        />
        <div class="flex-1 min-w-0">
          <div class="text-sm text-white font-medium truncate">{{ currentTrack.name }}</div>
          <div class="text-xs text-white/60 truncate">{{ currentTrack.artist }}</div>
        </div>
        <button
          type="button"
          title="收起"
          class="text-white/60 hover:text-white p-1 rounded hover:bg-white/10 flex-shrink-0"
          @click="expanded = false"
        >
          <X class="size-4" />
        </button>
      </div>

      <!-- 进度条 -->
      <div class="mt-2">
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          :value="progressPercent"
          class="music-range w-full"
          :style="{ background: `linear-gradient(to right, #fff ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%)` }"
          @input="seek"
        />
        <div class="flex justify-between text-[10px] text-white/60 mt-0.5 tabular-nums">
          <span>{{ formatTime(currentTime) }}</span>
          <span>{{ formatTime(duration) }}</span>
        </div>
      </div>

      <!-- 控件行 -->
      <div class="flex items-center justify-center gap-1 mt-1">
        <button type="button" title="上一首" class="ctrl-btn" @click="playPrev">
          <SkipBack class="size-4" />
        </button>
        <button type="button" :title="isPlaying ? '暂停' : '播放'" class="ctrl-btn-primary" @click="togglePlay">
          <Pause v-if="isPlaying" class="size-5" />
          <Play v-else class="size-5" />
        </button>
        <button type="button" title="下一首" class="ctrl-btn" @click="playNext">
          <SkipForward class="size-4" />
        </button>
        <button
          type="button"
          :title="loop === 'all' ? '循环：列表' : loop === 'one' ? '循环：单曲' : '循环：关闭'"
          class="ctrl-btn"
          :class="{ 'text-white/40': loop === 'none' }"
          @click="toggleLoop"
        >
          <Repeat v-if="loop === 'all'" class="size-4" />
          <Repeat1 v-else-if="loop === 'one'" class="size-4" />
          <X v-else class="size-4" />
        </button>
        <button
          type="button"
          :title="order === 'list' ? '顺序播放' : '随机播放'"
          class="ctrl-btn"
          @click="toggleOrder"
        >
          <ListMusic v-if="order === 'list'" class="size-4" />
          <Shuffle v-else class="size-4" />
        </button>
        <button
          type="button"
          title="播放列表"
          class="ctrl-btn"
          :class="{ 'bg-white/20 text-white': showPlaylist }"
          @click="showPlaylist = !showPlaylist"
        >
          <ListMusic class="size-4" />
        </button>
      </div>

      <!-- 音量 -->
      <div class="flex items-center gap-2 mt-2">
        <Volume2 class="size-4 text-white/70 flex-shrink-0" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="volume"
          class="music-range flex-1"
          :style="{ background: `linear-gradient(to right, #fff ${volumePercent}%, rgba(255,255,255,0.2) ${volumePercent}%)` }"
          @input="setVolume"
        />
      </div>

      <!-- 播放列表 -->
      <ul
        v-if="showPlaylist"
        class="mt-2 max-h-40 overflow-y-auto rounded bg-black/20 divide-y divide-white/5"
      >
        <li
          v-for="(track, i) in tracks"
          :key="track.id || i"
          class="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-white/10 text-xs"
          :class="i === currentIndex ? 'text-white bg-white/10' : 'text-white/70'"
          @click="playTrack(i)"
        >
          <span class="w-4 text-center flex-shrink-0">
            <Play v-if="i === currentIndex && isPlaying" class="size-3 inline-block" />
            <span v-else>{{ i + 1 }}</span>
          </span>
          <span class="flex-1 truncate">{{ track.name }}</span>
          <span class="text-white/40 flex-shrink-0 truncate max-w-20">{{ track.artist }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
/* 毛玻璃容器：复用全局 --ann-blur / --ann-opacity */
.music-glass {
  background-color: rgba(255, 255, 255, var(--ann-opacity, 0.15));
  backdrop-filter: blur(var(--ann-blur, 12px));
  -webkit-backdrop-filter: blur(var(--ann-blur, 12px));
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
  color: #fff;
}

/* 折叠态播放中：脉冲扩散环动画（参考 Mizuki MusicFabButton） */
.music-glass.playing::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid rgba(255, 255, 255, 0.35);
  animation: music-fab-pulse 1.8s ease-out infinite;
  pointer-events: none;
}

@keyframes music-fab-pulse {
  0% {
    opacity: 0;
    transform: scale(0.92);
  }
  30% {
    opacity: 0.75;
  }
  100% {
    opacity: 0;
    transform: scale(1.12);
  }
}

/* 控件按钮 */
.ctrl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  color: rgba(255, 255, 255, 0.85);
  transition: background-color 0.15s ease, color 0.15s ease;
}
.ctrl-btn:hover {
  background-color: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.ctrl-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px;
  background-color: rgba(255, 255, 255, 0.9);
  color: #111;
  transition: background-color 0.15s ease, transform 0.15s ease;
}
.ctrl-btn-primary:hover {
  background-color: #fff;
  transform: scale(1.05);
}

/* range 滑块自定义样式（轨道由 :style 背景渐变填充） */
.music-range {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  outline: none;
}
.music-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.music-range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* 播放列表滚动条隐藏 */
ul::-webkit-scrollbar {
  width: 4px;
}
ul::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
}
</style>
