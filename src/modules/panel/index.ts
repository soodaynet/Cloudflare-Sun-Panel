import type { ModuleDefinition } from '../types'
import { router } from './routes'

export const panelModule: ModuleDefinition = {
  name: 'panel',
  mountPath: '/panel',
  router,
}
