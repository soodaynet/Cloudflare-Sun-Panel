/**
 * 业务模块统一导出
 * 新结构：按功能拆分模块，每个模块包含 api.ts 与 types.ts
 */

// auth

// panel
export {
  getAllData,
  saveGroup,
  deleteGroups,
  saveGroupSort,
  addItems,
  editItem,
  deleteItems,
  saveItemSort,
  getSiteFavicon,
} from './panel/api'

// users
export {
  setUserConfig,
  updateUserInfo,
  updatePassword,
  getUserList,
  createUser,
  updateUser,
  deleteUsers,
  getPublicVisitUser,
  setPublicVisitUser,
} from './users/api'

// settings
export {
  saveSiteSettings,
  getInit,
} from './settings/api'

// hitokoto
export { getHitokoto } from './hitokoto/api'

// music
export { parseMusic } from './music/api'
export type { MusicTrack } from './music/types'

// search
export { saveSearchEngineConfig } from './search/api'
export type { SearchEngine, SearchEngineConfig } from './search/types'

// types
export type { UserFormData } from './users/types'
