import { post } from '@/utils/request'
import type {
  AllDataResponse,
  ItemIconGroup,
  ItemIconSortRequest,
  ItemInfo,
  SiteFaviconResponse,
  SortItemRequest,
} from './types'

// ========== 图标分组 API ==========
/** 统一获取全部数据（分组 + 所有图标 + 用户配置），一次请求替代 N+1 次 */
export function getAllData<T = AllDataResponse>() {
  return post<T>({ url: '/panel/getAllData' })
}

export function saveGroup<T>(req: ItemIconGroup) {
  return post<T>({ url: '/panel/itemIconGroup/edit', data: req })
}

export function deleteGroups<T>(ids: number[]) {
  return post<T>({ url: '/panel/itemIconGroup/deletes', data: { ids } })
}

export function saveGroupSort<T>(sortItems: SortItemRequest[]) {
  return post<T>({ url: '/panel/itemIconGroup/saveSort', data: { sortItems } })
}

// ========== 图标 API ==========
export function addItems<T>(items: ItemInfo[]) {
  return post<T>({ url: '/panel/itemIcon/addMultiple', data: items })
}

export function editItem<T>(req: ItemInfo) {
  return post<T>({ url: '/panel/itemIcon/edit', data: req })
}

export function deleteItems<T>(ids: number[]) {
  return post<T>({ url: '/panel/itemIcon/deletes', data: { ids } })
}

export function saveItemSort<T>(data: ItemIconSortRequest) {
  return post<T>({ url: '/panel/itemIcon/saveSort', data })
}

export function getSiteFavicon<T = SiteFaviconResponse>(url: string) {
  return post<T>({ url: '/panel/itemIcon/getSiteFavicon', data: { url } })
}
