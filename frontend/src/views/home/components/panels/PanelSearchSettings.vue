<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { VueDraggable } from 'vue-draggable-plus'
import { GripVertical, Plus, RotateCcw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/sonner'
import { saveSearchEngineConfig } from '@/modules'
import type { SearchEngine, SearchEngineConfig } from '@/modules'

const props = defineProps<{
  searchEngineConfig: SearchEngineConfig
}>()

const emit = defineEmits<{
  (e: 'update:searchEngineConfig', config: SearchEngineConfig): void
}>()

const { t } = useI18n()

// 内置默认引擎，用于「恢复默认」
const DEFAULT_ENGINES: SearchEngine[] = [
  { name: 'Google', url: 'https://www.google.com/search?q=', icon: '' },
  { name: 'Bing', url: 'https://www.bing.com/search?q=', icon: '' },
  { name: 'Yandex', url: 'https://yandex.com/search/?text=', icon: '' },
]

// 本地可编辑引擎列表（深拷贝，避免直接改 props）
const localEngines = ref<SearchEngine[]>([])
const localCurrentIndex = ref<number>(0)

function syncFromProps() {
  localEngines.value = (props.searchEngineConfig.engines || []).map((e) => ({ ...e }))
  localCurrentIndex.value = props.searchEngineConfig.currentIndex ?? 0
}

watch(
  () => props.searchEngineConfig,
  () => syncFromProps(),
  { immediate: true, deep: true },
)

function handleAdd() {
  localEngines.value.push({ name: '', url: '', icon: '' })
}

function handleDelete(index: number) {
  localEngines.value.splice(index, 1)
  if (index === localCurrentIndex.value) {
    // 删除的就是当前默认，回退到第一个
    localCurrentIndex.value = 0
  } else if (localCurrentIndex.value > index) {
    // 删除的在前，索引前移
    localCurrentIndex.value -= 1
  }
  // 越界保护：列表为空或索引超出范围时夹紧
  const maxIndex = Math.max(0, localEngines.value.length - 1)
  if (localCurrentIndex.value > maxIndex) {
    localCurrentIndex.value = maxIndex
  }
}

function handleResetDefault() {
  localEngines.value = DEFAULT_ENGINES.map((e) => ({ ...e }))
  localCurrentIndex.value = 0
}

async function handleSave() {
  try {
    const res = await saveSearchEngineConfig({
      engines: localEngines.value,
      currentIndex: localCurrentIndex.value,
    })
    if (res.code === 0) {
      emit('update:searchEngineConfig', {
        engines: localEngines.value.map((e) => ({ ...e })),
        currentIndex: localCurrentIndex.value,
      })
      toast.success(t('deskModule.searchBox.saved'))
    } else {
      toast.error(res.msg || t('common.failed'))
    }
  } catch {
    toast.error(t('common.failed'))
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div>
      <h3 class="text-sm font-medium text-foreground mb-2">{{ t('deskModule.searchBox.engineSettings') }}</h3>
      <Card>
        <CardContent class="p-3 sm:p-4">
          <VueDraggable
            v-model="localEngines"
            :animation="200"
            handle=".drag-handle"
            class="flex flex-col gap-2"
          >
            <div
              v-for="(engine, index) in localEngines"
              :key="index"
              class="grid grid-cols-1 gap-2 sm:grid-cols-[auto_minmax(100px,1fr)_minmax(140px,1.5fr)_minmax(100px,1fr)_auto] sm:items-center rounded-md border p-2 bg-background/40"
            >
              <div class="flex items-center gap-2">
                <span
                  class="drag-handle cursor-move text-muted-foreground select-none inline-flex size-9 items-center justify-center rounded-md hover:bg-accent"
                >
                  <GripVertical class="size-4" />
                </span>
                <Badge v-if="index === localCurrentIndex" variant="secondary">
                  {{ t('deskModule.searchBox.currentDefault') }}
                </Badge>
              </div>
              <Input v-model="engine.name" :placeholder="t('deskModule.searchBox.engineName')" />
              <Input v-model="engine.url" :placeholder="t('deskModule.searchBox.engineUrl')" />
              <Input v-model="engine.icon" :placeholder="t('deskModule.searchBox.engineIcon')" />
              <Button
                variant="destructive"
                size="icon"
                :title="t('deskModule.searchBox.deleteEngine')"
                :aria-label="t('deskModule.searchBox.deleteEngine')"
                @click="handleDelete(index)"
              >
                <span class="text-lg leading-none">&times;</span>
              </Button>
            </div>
          </VueDraggable>
          <div
            v-if="localEngines.length === 0"
            class="text-center text-muted-foreground text-sm py-4"
          >
            {{ t('common.noData') }}
          </div>
        </CardContent>
      </Card>
    </div>
    <div class="flex justify-end gap-2">
      <Button variant="outline" @click="handleResetDefault">
        <RotateCcw class="size-4" />
        {{ t('deskModule.searchBox.resetDefault') }}
      </Button>
      <Button variant="outline" @click="handleAdd">
        <Plus class="size-4" />
        {{ t('deskModule.searchBox.addEngine') }}
      </Button>
      <Button @click="handleSave">{{ t('common.save') }}</Button>
    </div>
  </div>
</template>
