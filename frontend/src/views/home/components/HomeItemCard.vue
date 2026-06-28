<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  item: Panel.ItemInfo
  editable: boolean
  isEditMode: boolean
  /** 是否在首屏可见，预加载图标 */
  eagerLoad?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', item: Panel.ItemInfo): void
  (e: 'edit', item: Panel.ItemInfo): void
  (e: 'delete', item: Panel.ItemInfo): void
}>()

const errored = ref(false)
// 图标是否加载完成，用于淡入过渡
const loaded = ref(false)

const realIconSrc = computed(() => props.item.icon?.src || '')

// 描述浮层跟随鼠标：记录鼠标 client 坐标与显示状态
const mouseX = ref(0)
const mouseY = ref(0)
const showDesc = ref(false)

function onMouseEnter() {
  if (props.item.description) showDesc.value = true
}
function onMouseMove(e: MouseEvent) {
  mouseX.value = e.clientX
  mouseY.value = e.clientY
}
function onMouseLeave() {
  showDesc.value = false
}

// 注：preconnectOrigin 已上提到父组件（home/index.vue），避免每卡片注册 watcher
</script>

<template>
  <div
    class="group-item w-20 h-20 sm:w-[88px] sm:h-[88px] md:w-24 md:h-24 flex flex-col items-center justify-center rounded-xl cursor-pointer transition-[transform,box-shadow,background-color] duration-200 ease-out hover:scale-105 hover:-translate-y-0.5 hover:shadow-lg relative glass-hover will-change-transform"
    @click="emit('click', item)"
    @mouseenter="onMouseEnter"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div class="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-lg overflow-hidden flex items-center justify-center mb-1">
      <img
        v-if="item.icon?.src"
        v-show="!errored"
        :src="realIconSrc"
        class="icon-fade w-full h-full object-cover rounded-lg"
        :class="{ 'opacity-0': !loaded && !errored, 'opacity-100': loaded }"
        :alt="item.title"
        width="40"
        height="40"
        :loading="eagerLoad ? 'eager' : 'lazy'"
        decoding="async"
        :fetchpriority="eagerLoad ? 'high' : 'auto'"
        referrerpolicy="no-referrer"
        @error="errored = true"
        @load="loaded = true"
      />
      <div
        v-if="!item.icon?.src || errored"
        class="w-full h-full rounded-lg flex items-center justify-center text-white font-bold text-lg"
        :style="{ backgroundColor: item.icon?.backgroundColor || '#4a90d9' }"
      >
        {{ item.icon?.text || item.title?.charAt(0) || '?' }}
      </div>
    </div>
    <span class="text-white text-[11px] sm:text-xs text-center break-words px-1 leading-tight font-medium">{{ item.title }}</span>

    <!-- 编辑模式下显示编辑/删除按钮，使用 lucide 矢量图标替代字符 -->
    <div v-if="editable && isEditMode" class="absolute top-1 right-1 flex gap-1">
      <Button
        size="icon"
        variant="secondary"
        title="编辑"
        class="h-6 w-6"
        @click.stop="emit('edit', item)"
      >
        <Pencil class="h-3 w-3" />
      </Button>
      <Button
        size="icon"
        variant="destructive"
        title="删除"
        class="h-6 w-6"
        @click.stop="emit('delete', item)"
      >
        <Trash2 class="h-3 w-3" />
      </Button>
    </div>

    <!-- 描述浮层：跟随鼠标位置，teleport 到 body 避免被分组边界裁剪；毛玻璃基于 --ann-blur/--ann-opacity +20% -->
    <Teleport to="body">
      <div
        v-if="showDesc && item.description"
        class="item-desc-glass fixed px-2 py-1.5 rounded-md text-[11px] text-white leading-snug pointer-events-none z-50 max-w-[240px]"
        :style="{ left: mouseX + 12 + 'px', top: mouseY + 12 + 'px' }"
      >
        {{ item.description }}
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.icon-fade {
  transition: opacity 200ms ease-out;
}
/* 描述浮层毛玻璃：基于 --ann-blur/--ann-opacity +20% */
.item-desc-glass {
  background-color: rgba(255, 255, 255, calc(var(--ann-opacity, 0.15) * 1.2));
  backdrop-filter: blur(calc(var(--ann-blur, 12px) * 1.2));
  -webkit-backdrop-filter: blur(calc(var(--ann-blur, 12px) * 1.2));
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}
</style>
