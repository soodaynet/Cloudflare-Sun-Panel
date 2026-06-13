import { ref, watch, type Ref } from 'vue'
import { useMessage } from 'naive-ui'
import { usePanelState } from '@/store'
import { setUserConfig } from '@/api/index'

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

  const message = useMessage()
  const panelState = usePanelState()

  const localConfig = ref<Panel.panelConfig>({})

  watch(
    () => config.value,
    (val) => {
      localConfig.value = { ...val }
    },
    { immediate: true, deep: true },
  )

  async function handleSave() {
    const configToSave = { ...localConfig.value }
    try {
      const res = await setUserConfig({ panel: configToSave })
      if (res.code === 0) {
        panelState.updatePanelConfigFromCloud(configToSave)
        message.success('配置已保存')
        onSave?.(configToSave)
        onSaved?.()
      }
    } catch {
      message.error('保存失败')
    }
  }

  return {
    localConfig,
    handleSave,
    panelState,
  }
}