<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { VueDraggable } from 'vue-draggable-plus'
import { saveGroupSort } from '@/modules'

interface ItemGroup {
  id?: number
  title: string
  sort?: number
  items?: Panel.ItemInfo[]
  publicVisible?: number
  hoverStatus?: boolean
  sortStatus?: boolean
}

const props = defineProps<{
  groups: ItemGroup[]
}>()

const emit = defineEmits<{
  (e: 'add-group'): void
  (e: 'edit-group', group: ItemGroup): void
  (e: 'delete-group', group: ItemGroup): void
  (e: 'sort-end'): void
  (e: 'saved'): void
}>()

const localGroups = ref<ItemGroup[]>([...props.groups])
watch(
  () => props.groups,
  (val) => {
    localGroups.value = [...val]
  },
)

async function handleGroupSortEnd() {
  const sortItems = localGroups.value.filter((g) => g.id).map((g, i) => ({ id: g.id!, sort: i }))
  try {
    const res = await saveGroupSort(sortItems)
    if (res.code === 0) {
      emit('saved')
    }
  } catch {
    /* error handled by parent */
  }
}

function handleAddGroup() {
  emit('add-group')
}

function handleEditGroup(group: ItemGroup) {
  emit('edit-group', group)
}

function handleDeleteGroup(group: ItemGroup) {
  emit('delete-group', group)
}
</script>

<template>
  <Card class="h-full">
    <CardHeader>
      <div class="flex items-center justify-between gap-2">
        <CardTitle>分组管理</CardTitle>
        <Button size="sm" @click="handleAddGroup">添加分组</Button>
      </div>
      <p class="text-xs text-muted-foreground">拖拽分组可调整排序</p>
    </CardHeader>
    <!-- 拖拽列表可滚动 -->
    <CardContent class="flex-1 min-h-0 flex flex-col">
      <VueDraggable
        v-model="localGroups"
        :animation="200"
        class="flex flex-col gap-2 overflow-auto flex-1 min-h-0"
        @end="handleGroupSortEnd"
      >
        <div
          v-for="(group, gi) in localGroups"
          :key="group.id || gi"
          class="flex items-center justify-between p-3 border rounded cursor-move bg-white/50 dark:bg-gray-800/50"
        >
          <div class="flex items-center gap-2">
            <span class="text-gray-400 text-sm cursor-move">⠿</span>
            <span class="font-medium">{{ group.title }}</span>
            <span
              class="text-xs px-1.5 py-0.5 rounded"
              :class="group.publicVisible !== 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
            >
              {{ group.publicVisible !== 0 ? '访客可见' : '隐藏' }}
            </span>
          </div>
          <div class="flex gap-2">
            <Button size="sm" variant="outline" @click="handleEditGroup(group)">编辑</Button>
            <Button size="sm" variant="destructive" @click="handleDeleteGroup(group)">删除</Button>
          </div>
        </div>
      </VueDraggable>
    </CardContent>
  </Card>
</template>
