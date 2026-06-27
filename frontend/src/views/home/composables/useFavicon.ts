import { ref } from 'vue'
import { toast } from '@/components/ui/sonner'
import { getSiteFavicon } from '@/modules'

interface SiteMeta {
  title: string
  description: string
  siteName: string
}

export function useFavicon() {
  const getIconLoading = ref(false)
  const iconCandidates = ref<string[]>([])
  const siteMeta = ref<SiteMeta>({ title: '', description: '', siteName: '' })

  // 调用后端获取站点 favicon 候选列表 + 站点元数据
  async function getIconByUrl(url: string) {
    if (!url) {
      toast.warning('请先输入网址')
      return
    }
    getIconLoading.value = true
    iconCandidates.value = []
    siteMeta.value = { title: '', description: '', siteName: '' }
    try {
      const res = await getSiteFavicon<{ iconUrls: string[]; title?: string; description?: string; siteName?: string }>(url)
      if (res.code === 0 && res.data) {
        iconCandidates.value = res.data.iconUrls || []
        siteMeta.value = {
          title: res.data.title || '',
          description: res.data.description || '',
          siteName: res.data.siteName || '',
        }
        if (iconCandidates.value.length > 0) {
          toast.success(`找到 ${iconCandidates.value.length} 个图标候选`)
        } else {
          toast.success('获取信息成功')
        }
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
    siteMeta,
    getIconByUrl,
    selectIcon,
  }
}
