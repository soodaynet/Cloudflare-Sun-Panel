import type { D1Database } from '@cloudflare/workers-types'
import { queryFirst } from '../shared/db'
import { AppError } from '../shared/errors'
import type { UserConfigRow, UserConfigData } from './types'

/**
 * 用户配置服务层 — 封装 user_configs 表的 CRUD 操作
 *
 * 职责：
 * - 获取用户配置（不存在时自动初始化空记录）
 * - 保存用户配置（存在则更新，不存在则插入）
 *
 * 所有写操作均通过 userId 进行数据隔离，防止越权操作。
 */
export class UserConfigService {
  constructor(private db: D1Database) {}

  /**
   * 获取用户配置
   * - 校验用户存在
   * - 若 user_configs 无记录，则插入空记录并返回空配置
   * @param userId 用户 ID
   * @throws AppError 用户不存在时抛出 400 错误
   */
  async get(userId: number): Promise<UserConfigData> {
    const [user, row] = await Promise.all([
      queryFirst<{ id: number }>(this.db, 'SELECT id FROM users WHERE id = ?', userId),
      queryFirst<UserConfigRow>(
        this.db,
        'SELECT panel_json, search_engine_json FROM user_configs WHERE user_id = ?',
        userId,
      ),
    ])

    if (!user) throw AppError.badRequest('用户不存在')

    if (!row) {
      await this.db.prepare('INSERT INTO user_configs (user_id) VALUES (?)').bind(userId).run()
      return { panel: {}, searchEngine: {} }
    }

    return {
      panel: JSON.parse(row.panel_json || '{}'),
      searchEngine: JSON.parse(row.search_engine_json || '{}'),
    }
  }

  /**
   * 保存用户配置（存在则更新，不存在则插入）
   * @param userId 用户 ID
   * @param panelJson 面板配置 JSON 字符串
   * @param searchEngineJson 搜索引擎配置 JSON 字符串
   */
  async set(userId: number, panelJson: string, searchEngineJson: string): Promise<void> {
    const existing = await queryFirst<{ user_id: number }>(
      this.db,
      'SELECT user_id FROM user_configs WHERE user_id = ?',
      userId,
    )

    if (existing) {
      await this.db
        .prepare(
          "UPDATE user_configs SET panel_json = ?, search_engine_json = ?, updated_at = datetime('now') WHERE user_id = ?",
        )
        .bind(panelJson, searchEngineJson, userId)
        .run()
    } else {
      await this.db
        .prepare(
          'INSERT INTO user_configs (user_id, panel_json, search_engine_json) VALUES (?, ?, ?)',
        )
        .bind(userId, panelJson, searchEngineJson)
        .run()
    }
  }
}
