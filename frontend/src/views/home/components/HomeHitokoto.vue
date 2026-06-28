<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { getHitokoto } from '@/modules'
import { usePanelState } from '@/store'

const panelState = usePanelState()

const hitokotoText = ref('')
const hitokotoFrom = ref('')
const loading = ref(false)
const displayedCount = ref(0)
const fading = ref(false)
let typewriterTimer: ReturnType<typeof setTimeout> | null = null
let autoSwitchTimer: ReturnType<typeof setInterval> | null = null

// ===== 配置读取（含默认值） =====
// 打字机完整出现时长，秒（默认 3，整句在该时长内均匀打完）
const typewriterDuration = computed(() => panelState.panelConfig.hitokotoTypewriterDuration ?? 3)
// 是否启用打字机效果（默认 false）
const typewriterEnabled = computed(() => panelState.panelConfig.hitokotoTypewriter ?? false)
// 打字机动画方式（默认 'type'）
const typewriterAnimation = computed(
  () => panelState.panelConfig.hitokotoTypewriterAnimation ?? 'type',
)
// 光标样式（默认 'blink'，仅 type 动画下生效）
const typewriterCursor = computed(() => panelState.panelConfig.hitokotoTypewriterCursor ?? 'blink')
// 是否显示出处 from（默认 true）
const showFrom = computed(() => panelState.panelConfig.hitokotoShowFrom ?? true)
// 是否显示作者 from_who（默认 true，优先于 from）
const showFromWho = computed(() => panelState.panelConfig.hitokotoShowFromWho ?? true)
// 文字对齐（默认 'center'）
const align = computed(() => panelState.panelConfig.hitokotoAlign ?? 'center')
// 一言分类（默认 []，即全部；兼容旧字段 hitokotoCategory）
const category = computed<string[]>(() => {
  const cfg = panelState.panelConfig as Panel.panelConfig & { hitokotoCategory?: string }
  if (Array.isArray(cfg.hitokotoCategories)) return cfg.hitokotoCategories
  // 旧字段迁移：单选 string 转为 [string]
  if (cfg.hitokotoCategory && typeof cfg.hitokotoCategory === 'string') return [cfg.hitokotoCategory]
  return []
})
// 自动轮播开关（默认 false）
const autoSwitch = computed(() => panelState.panelConfig.hitokotoAutoSwitch ?? false)
// 自动轮播间隔，秒（默认 30）
const autoSwitchInterval = computed(() => panelState.panelConfig.hitokotoAutoSwitchInterval ?? 30)
// 切换过渡动画时长，秒（默认 0.3）
const transitionDuration = computed(() => panelState.panelConfig.hitokotoTransitionDuration ?? 0.3)

// ===== 文本切片（用 Array.from 正确处理 Unicode/emoji） =====
const chars = computed(() => Array.from(hitokotoText.value))
const displayedText = computed(() => chars.value.slice(0, displayedCount.value).join(''))
const isTyping = computed(() => displayedCount.value < chars.value.length)

// 是否使用逐字 type 动画（含光标）
const isTypeMode = computed(() => typewriterEnabled.value && typewriterAnimation.value === 'type')
// 是否使用整句渲染的渐入动画（fade/slide）
const isCharStaggerMode = computed(
  () => typewriterEnabled.value && (typewriterAnimation.value === 'fade' || typewriterAnimation.value === 'slide'),
)

// 渐入动画每字延迟（ms），整句在 duration 内均匀展开
const perCharDelay = computed(() => {
  const total = chars.value.length
  if (total === 0) return 0
  return Math.min(500, Math.max(30, (typewriterDuration.value * 1000) / total))
})

// 过渡动画内联样式（淡入淡出切换）；minHeight 单行占位，避免切换期间高度塌陷
const transitionStyle = computed(() => ({
  transition: `opacity ${transitionDuration.value}s ease`,
  opacity: fading.value ? 0 : 1,
  minHeight: '1.6em',
}))

// 容器对齐 class
const alignClass = computed(() => (align.value === 'left' ? 'text-left' : 'text-center'))

// 光标可见性：仅 type 模式且非 none 时显示
const cursorVisible = computed(() => isTypeMode.value && typewriterCursor.value !== 'none')
const cursorClass = computed(() =>
  typewriterCursor.value === 'blink' ? 'hitokoto-cursor hitokoto-cursor-blink' : 'hitokoto-cursor',
)

// 拉取一条随机一言：失败静默，保留上次成功内容
async function fetchHitokoto() {
  if (loading.value) return
  loading.value = true
  try {
    // 分类参数：hitokotoCategories 为空数组时不传 c（即"全部"）
    const data = await getHitokoto({
      apiUrl: panelState.panelConfig.hitokotoApiUrl,
      categories: category.value,
    })
    // 切换前淡出
    if (hitokotoText.value && transitionDuration.value > 0) {
      fading.value = true
      await new Promise(resolve => setTimeout(resolve, transitionDuration.value * 1000))
    }
    hitokotoText.value = data.hitokoto || ''
    // 出处优先 from_who，否则用 from；from 非空时加书名号；受开关控制
    const who = data.from_who?.trim()
    const from = data.from?.trim()
    let newFrom = ''
    if (showFromWho.value && who) newFrom = who
    else if (showFrom.value && from) newFrom = `《${from}》`
    hitokotoFrom.value = newFrom
    fading.value = false
    startTypewriter()
  } catch {
    // 静默失败，保留上次内容
    fading.value = false
  } finally {
    loading.value = false
  }
}

// 打字机：按时长均匀输出字符，每字延迟限制 30-500ms 避免极端值
function startTypewriter() {
  if (typewriterTimer) { clearTimeout(typewriterTimer); typewriterTimer = null }
  displayedCount.value = 0
  if (!isTypeMode.value) {
    // 非 type 模式直接显示整句（fade/slide 由 CSS 动画处理）
    displayedCount.value = chars.value.length
    return
  }
  const total = chars.value.length
  if (total === 0) return
  const delay = perCharDelay.value
  function tick() {
    if (displayedCount.value < total) {
      displayedCount.value += 1
      typewriterTimer = setTimeout(tick, delay)
    } else {
      typewriterTimer = null
    }
  }
  typewriterTimer = setTimeout(tick, delay)
}

// 自动轮播定时器
function setupAutoSwitch() {
  if (autoSwitchTimer) { clearInterval(autoSwitchTimer); autoSwitchTimer = null }
  if (autoSwitch.value && autoSwitchInterval.value > 0) {
    autoSwitchTimer = setInterval(() => {
      fetchHitokoto()
    }, autoSwitchInterval.value * 1000)
  }
}

// 自动轮播配置变化时重建定时器
watch([autoSwitch, autoSwitchInterval], setupAutoSwitch)

onMounted(() => {
  fetchHitokoto()
  setupAutoSwitch()
})

onBeforeUnmount(() => {
  if (typewriterTimer) clearTimeout(typewriterTimer)
  if (autoSwitchTimer) clearInterval(autoSwitchTimer)
})
</script>

<template>
  <div
    class="hitokoto-bar mx-auto mb-4 max-w-3xl px-4 py-2 rounded-lg text-sm text-white/90"
    :class="alignClass"
  >
    <div v-if="hitokotoText" class="min-w-0" :style="transitionStyle">
      <!-- type 模式：逐字显示 + 光标 -->
      <template v-if="isTypeMode">
        <span class="hitokoto-text">{{ displayedText }}</span>
        <span v-if="cursorVisible" :class="cursorClass"></span>
      </template>
      <!-- fade/slide 模式：整句渲染，每字渐入 -->
      <template v-else-if="isCharStaggerMode">
        <span
          v-for="(ch, i) in chars"
          :key="i"
          class="hitokoto-char"
          :class="`hitokoto-char-${typewriterAnimation}`"
          :style="{ animationDelay: `${i * perCharDelay}ms` }"
        >{{ ch }}</span>
      </template>
      <!-- 无打字机：直接显示整句 -->
      <template v-else>
        <span class="hitokoto-text">{{ hitokotoText }}</span>
      </template>
      <!-- 出处/作者：打字结束后显示（用 visibility 占位，避免 v-if 切换 DOM 导致高度抖动） -->
      <span
        class="ml-2 text-white/60 text-xs"
        :style="{ visibility: hitokotoFrom && !isTyping ? 'visible' : 'hidden' }"
      >—— {{ hitokotoFrom }}</span>
    </div>
    <div v-else class="text-white/50">加载中...</div>
  </div>
</template>

<style scoped>
/* 透明背景（移除毛玻璃），与上一轮 spec 一致 */
.hitokoto-bar {
  background-color: transparent;
}

/* type 模式光标：默认块状；blink 类叠加闪烁动画 */
.hitokoto-cursor {
  display: inline-block;
  width: 0.6em;
  height: 1em;
  vertical-align: text-bottom;
  margin-left: 2px;
  background-color: currentColor;
}
.hitokoto-cursor-blink {
  animation: hitokoto-blink 1s steps(2, start) infinite;
}
@keyframes hitokoto-blink {
  to {
    visibility: hidden;
  }
}

/* fade/slide 模式：每字动画 */
.hitokoto-char {
  display: inline-block;
  opacity: 0;
  animation-fill-mode: forwards;
}
/* 淡入 */
.hitokoto-char-fade {
  animation-name: hitokoto-fade-in;
  animation-duration: 0.3s;
  animation-timing-function: ease;
}
@keyframes hitokoto-fade-in {
  to {
    opacity: 1;
  }
}
/* 滑入：从下方上移并淡入 */
.hitokoto-char-slide {
  animation-name: hitokoto-slide-in;
  animation-duration: 0.3s;
  animation-timing-function: ease;
}
@keyframes hitokoto-slide-in {
  from {
    opacity: 0;
    transform: translateY(0.4em);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
