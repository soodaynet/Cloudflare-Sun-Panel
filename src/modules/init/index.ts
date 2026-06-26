import type { ModuleDefinition } from '../types'
import { router } from './routes'

export const initModule: ModuleDefinition = {
  name: 'init',
  mountPath: '/',
  router,
}
