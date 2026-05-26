import { defineStore } from 'pinia'

const TOKEN_KEY = 'sun-panel-token'
const USER_KEY = 'sun-panel-user'

export interface AuthState {
  token: string | null
  userInfo: User.Info | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => {
    const token = localStorage.getItem(TOKEN_KEY)
    const userStr = localStorage.getItem(USER_KEY)
    return {
      token,
      userInfo: userStr ? JSON.parse(userStr) : null,
    }
  },

  getters: {
    isLoggedIn: (state) => !!state.token,
    isAdmin: (state) => state.userInfo?.role === 1,
  },

  actions: {
    setToken(token: string) {
      this.token = token
      localStorage.setItem(TOKEN_KEY, token)
    },

    setUserInfo(info: User.Info) {
      this.userInfo = info
      localStorage.setItem(USER_KEY, JSON.stringify(info))
    },

    loginSuccess(token: string, userInfo: User.Info) {
      this.setToken(token)
      this.setUserInfo(userInfo)
    },

    removeToken() {
      this.token = null
      this.userInfo = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    },
  },
})