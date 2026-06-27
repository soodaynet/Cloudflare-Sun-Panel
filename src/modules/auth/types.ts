export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  userInfo: {
    id: number
    username: string
    name: string
    headImage: string
    status: number
    role: number
    mail: string
    created_at: string
  }
}
