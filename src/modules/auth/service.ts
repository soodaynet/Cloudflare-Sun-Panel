import type { D1Database } from '@cloudflare/workers-types'
import type { UserRow } from '../shared/types'
import { verifyPassword } from '../shared/password'
import { signToken } from '../shared/jwt'
import { queryFirst } from '../shared/db'
import { AppError } from '../shared/errors'

/** 用户查询字段（含 password 用于校验） */
const USER_SELECT = 'SELECT id, username, password, name, head_image, status, role, mail, created_at, updated_at FROM users'

export class AuthService {
  constructor(private db: D1Database) {}

  /**
   * 根据用户名查找用户
   * @param username 用户名
   */
  async findByUsername(username: string): Promise<UserRow | null> {
    return queryFirst<UserRow>(this.db, `${USER_SELECT} WHERE username = ?`, username)
  }

  /** 将数据库行格式化为前端需要的用户信息对象 */
  private formatUserInfo(row: UserRow) {
    return {
      id: row.id,
      username: row.username,
      name: row.name || '',
      headImage: row.head_image || '',
      status: row.status,
      role: row.role,
      mail: row.mail || '',
      created_at: row.created_at,
    }
  }

  /**
   * 用户登录认证
   * @param username 用户名
   * @param password 密码
   * @param jwtSecret JWT 签名密钥
   * @returns token 和用户信息
   * @throws AppError 用户名或密码错误、账号被禁用
   */
  async authenticate(username: string, password: string, jwtSecret?: string) {
    const user = await this.findByUsername(username)
    if (!user) throw AppError.unauthorized('用户名或密码错误')

    const valid = await verifyPassword(password, user.password)
    if (!valid) throw AppError.unauthorized('用户名或密码错误')

    if (user.status !== 1) throw AppError.forbidden('账号已被禁用')

    const token = await signToken(
      { userId: user.id, username: user.username, role: user.role },
      { secret: jwtSecret },
    )

    return { token, userInfo: this.formatUserInfo(user) }
  }
}
