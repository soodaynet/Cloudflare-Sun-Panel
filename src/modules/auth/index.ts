import type { ModuleDefinition } from '../types'
import { router } from './routes'

export const authModule: ModuleDefinition = {
  name: 'auth',
  mountPath: '/',
  router,
}
