import { ref } from 'vue'
import { toast } from '@/components/ui/sonner'
import { addItems, editItem } from '@/modules'
import { invalidateCacheByPrefix } from '@/utils/requestCache'

export function useItemEditor(loadData: () => Promise<void>) {

  const editModalShow = ref(false)
  const editingItem = ref<Panel.ItemInfo>({
    title: '',
    url: '',
    openMethod: 2,
    icon: { itemType: 0, text: '', backgroundColor: '#4a90d9' },
    itemIconGroupId: undefined,
  })
  const editingGroupId = ref<number>()

  function openAddItem(groupId: number) {
    editingItem.value = {
      title: '',
      url: '',
      description: '',
      openMethod: 2,
      icon: { itemType: 0, text: '', backgroundColor: '#4a90d9' },
      itemIconGroupId: groupId,
    }
    editingGroupId.value = groupId
    editModalShow.value = true
  }

  function openEditItem(item: Panel.ItemInfo) {
    editingItem.value = { ...item }
    editingGroupId.value = item.itemIconGroupId
    editModalShow.value = true
  }

  async function handleSaveItem() {
    const item = editingItem.value
    if (!item?.title) {
      toast.warning('请输入标题')
      return
    }
    try {
      const res = item.id ? await editItem<Panel.ItemInfo>(item) : await addItems<Panel.ItemInfo[]>([item])
      if (res.code === 0) {
        toast.success('保存成功')
        editModalShow.value = false
        invalidateCacheByPrefix('panel:')
        await loadData()
      } else toast.error(res.msg || '保存失败')
    } catch {
      toast.error('网络错误')
    }
  }

  return {
    editModalShow,
    editingItem,
    editingGroupId,
    openAddItem,
    openEditItem,
    handleSaveItem,
  }
}
