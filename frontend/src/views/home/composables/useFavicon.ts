import { ref } from 'vue'
import { toast } from '@/components/ui/sonner'
import { getSiteFavicon } from '@/modules'

export function useFavicon() {
  const getIconLoading = ref(false)
  const iconCandidates = ref<string[]>([])

  // 调用后端获取站点 favicon 候选列表
  async function getIconByUrl(url: string) {
    if (!url) {
      toast.warning('请先输入网址')
      return
    }
    getIconLoading.value = true
    iconCandidates.value = []
    try {
      const res = await getSiteFavicon<{ iconUrls: string[] }>(url)
      if (res.code === 0 && res.data && res.data.iconUrls.length > 0) {
        iconCandidates.value = res.data.iconUrls
        toast.success(`找到 ${iconCandidates.value.length} 个图标候选`)
      } else {
        toast.error(res.msg || '获取图标失败')
      }
    } catch {
      toast.error('网络错误')
    } finally {
      getIconLoading.value = false
    }
  }

  function selectIcon(iconUrl: string): string {
    iconCandidates.value = []
    toast.success('已选择图标')
    return iconUrl
  }

  return {
    getIconLoading,
    iconCandidates,
    getIconByUrl,
    selectIcon,
  }
}
