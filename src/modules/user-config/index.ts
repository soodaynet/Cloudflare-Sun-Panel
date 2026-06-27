import type { ModuleDefinition } from '../types'
import { router } from './routes'

export const userConfigModule: ModuleDefinition = {
  name: 'user-config',
  mountPath: '/panel/userConfig',
  router,
}
