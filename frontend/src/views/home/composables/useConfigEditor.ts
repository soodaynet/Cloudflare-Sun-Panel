import { ref, watch, type Ref } from 'vue'
import { toast } from '@/components/ui/sonner'
import { usePanelState } from '@/store'
import { setUserConfig } from '@/modules'

interface UseConfigEditorOptions {
  /** 来源配置（通常是 props.panelConfig） */
  config: Ref<Panel.panelConfig>
  /** 保存成功后触发（如 props.onSaved） */
  onSaved?: () => void
  /** 保存成功后触发，传入保存的配置（如 emit('save', config)） */
  onSave?: (config: Panel.panelConfig) => void
}

/**
 * 通用的配置编辑逻辑，封装 watch 同步、保存、消息提示等公共逻辑。
 * 用于 PanelStyleSettings、PanelAnnounceSettings 等设置面板组件。
 */
export function useConfigEditor(options: UseConfigEditorOptions) {
  const { config, onSaved, onSave } = options

  const panelState = usePanelState()

  const localConfig = ref<Panel.panelConfig>({})

  // 浅 watch：panelState.updatePanelConfigFromCloud 通过 spread 创建新引用，浅监听足以触发同步
  // 移除 deep: true 避免对 60+ 字段面板配置的深度追踪开销
  watch(
    () => config.value,
    (val) => {
      localConfig.value = { ...val }
    },
    { immediate: true },
  )

  async function handleSave(): Promise<boolean> {
    const configToSave = { ...localConfig.value }
    try {
      const res = await setUserConfig({ panel: configToSave })
      if (res.code === 0) {
        panelState.updatePanelConfigFromCloud(configToSave)
        toast.success('配置已保存')
        onSave?.(configToSave)
        onSaved?.()
        return true
      }
      return false
    } catch {
      toast.error('保存失败')
      return false
    }
  }

  return {
    localConfig,
    handleSave,
    panelState,
  }
}