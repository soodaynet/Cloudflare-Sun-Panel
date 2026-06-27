<script setup lang="ts">
interface App {
  name: string
  key: string
  icon: string
  adminOnly?: boolean
}

const props = defineProps<{
  apps: App[]
  activeApp: string
  collapsed: boolean
  isSmallScreen: boolean
}>()

const emit = defineEmits<{
  (e: 'update:activeApp', appKey: string): void
  (e: 'update:collapsed', value: boolean): void
}>()

function handleAppClick(appKey: string) {
  emit('update:activeApp', appKey)
  if (props.isSmallScreen) {
    emit('update:collapsed', true)
  }
}
</script>

<template>
  <div
    class="h-full overflow-hidden transition-[width] duration-300 shrink-0"
    :style="{ width: collapsed ? '0px' : (isSmallScreen ? '100%' : '180px') }"
  >
    <div class="h-full dark:bg-[#2c2c32] p-2">
      <div
        v-for="app in apps" :key="app.key"
        class="px-3 py-2.5 rounded-lg mb-1 cursor-pointer font-medium text-sm flex items-center gap-2 transition-colors"
        :class="activeApp === app.key ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300'"
        @click="handleAppClick(app.key)"
      >
        <span>{{ app.icon }}</span>
        <span>{{ app.name }}</span>
      </div>
    </div>
  </div>
</template>