import type { ModuleDefinition } from '../types'
import { router } from './routes'

export const settingsModule: ModuleDefinition = {
  name: 'settings',
  mountPath: '/',
  router,
}
