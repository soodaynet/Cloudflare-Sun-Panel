import type { ModuleDefinition } from '../types'
import { adminRouter, selfRouter } from './routes'

export const usersAdminModule: ModuleDefinition = {
  name: 'users-admin',
  mountPath: '/panel/users',
  router: adminRouter,
}

export const userSelfModule: ModuleDefinition = {
  name: 'user-self',
  mountPath: '/user',
  router: selfRouter,
}
