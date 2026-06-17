import type { D1Database } from '@cloudflare/workers-types'
import type { ItemIconRow, ItemIconGroupRow } from '../models/types'
import { queryAll, queryFirst } from '../utils/db'

const ICON_SELECT = 'SELECT id, icon_json, title, url, description, open_method, sort, item_icon_group_id, user_id, created_at, updated_at FROM item_icons'
const GROUP_SELECT = 'SELECT id, icon, title, description, sort, public_visible, user_id, created_at, updated_at FROM item_icon_groups'

/** 生成当前时间字符串（YYYY-MM-DD HH:mm:ss） */
function nowStr(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * 面板服务层 — 封装面板分组和图标的全部 CRUD 操作
 *
 * 职责：
 * - 数据格式化：将数据库行字段转换为前端驼峰命名
 * - 数据查询：分组列表、图标列表、全量数据（一次查询替代多次 API 调用）
 * - 图标 CRUD：批量添加、编辑/创建、批量删除、排序
 * - 分组 CRUD：编辑/创建、批量删除（级联删除图标）、排序
 *
 * 所有写操作均通过 userId 进行数据隔离，防止越权操作。
 *
 * @example
 * ```ts
 * const service = new PanelService(db)
 * const { groups, itemsMap } = await service.getAllData(userId)
 * ```
 */
export class PanelService {
  constructor(private db: D1Database) {}

  // ========== 数据格式化 ==========

  /** 将数据库行格式化为前端需要的图标对象 */
  formatIcon(row: ItemIconRow) {
    const icon = JSON.parse(row.icon_json || '{}')
    return {
      id: row.id,
      icon,
      title: row.title,
      url: row.url,
      description: row.description,
      openMethod: row.open_method,
      sort: row.sort,
      itemIconGroupId: row.item_icon_group_id,
      userId: row.user_id,
      createTime: row.created_at,
      updateTime: row.updated_at,
    }
  }

  /** 将数据库行格式化为前端需要的分组对象 */
  formatGroup(row: ItemIconGroupRow) {
    return {
      id: row.id, icon: row.icon, title: row.title, description: row.description,
      sort: row.sort, publicVisible: row.public_visible, userId: row.user_id,
      createTime: row.created_at, updateTime: row.updated_at,
    }
  }

  // ========== 数据查询 ==========

  /**
   * 获取用户全部面板数据（分组、图标、面板配置）
   * 一次查询替代多次 API 调用，减少网络往返
   * @param userId 用户 ID
   */
  async getAllData(userId: number) {
    const [groups, iconRows, configRow] = await Promise.all([
      queryAll<ItemIconGroupRow>(this.db,
        `${GROUP_SELECT} WHERE user_id = ? ORDER BY sort ASC, id ASC`, userId),
      queryAll<ItemIconRow>(this.db,
        `${ICON_SELECT} WHERE user_id = ? ORDER BY sort ASC, id ASC`, userId),
      queryFirst<{ panel_json: string }>(this.db,
        'SELECT panel_json FROM user_configs WHERE user_id = ?', userId),
    ])

    const itemsMap: Record<number, ReturnType<typeof this.formatIcon>[]> = {}
    for (const row of iconRows) {
      const gid = row.item_icon_group_id
      if (!itemsMap[gid]) itemsMap[gid] = []
      itemsMap[gid].push(this.formatIcon(row))
    }

    return {
      groups: groups.map(g => this.formatGroup(g)),
      itemsMap,
      panelConfig: configRow?.panel_json ? JSON.parse(configRow.panel_json) : {},
    }
  }

  /**
   * 根据分组 ID 获取图标列表
   * @param itemIconGroupId 分组 ID
   * @param userId 用户 ID
   */
  async getIconsByGroupId(itemIconGroupId: number, userId: number) {
    return (await queryAll<ItemIconRow>(this.db,
      `${ICON_SELECT} WHERE item_icon_group_id = ? AND user_id = ? ORDER BY sort ASC, id ASC`,
      itemIconGroupId, userId)).map(row => this.formatIcon(row))
  }

  /**
   * 获取用户的所有分组
   * @param userId 用户 ID
   */
  async getGroups(userId: number) {
    const rows = await queryAll<ItemIconGroupRow>(this.db,
      `${GROUP_SELECT} WHERE user_id = ? ORDER BY sort ASC, id ASC`, userId)
    return rows.map(row => this.formatGroup(row))
  }

  // ========== 图标 CRUD ==========

  /**
   * 批量添加图标
   * @param items 图标列表
   * @param userId 用户 ID
   */
  async addMultipleIcons(items: Array<{
    icon?: unknown; title: string; url: string; description?: string;
    openMethod?: number; sort?: number; itemIconGroupId: number
  }>, userId: number) {
    const stmt = this.db.prepare(
      'INSERT INTO item_icons (icon_json, title, url, description, open_method, sort, item_icon_group_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const inserts = items.map(item =>
      stmt.bind(
        JSON.stringify(item.icon || {}), item.title, item.url,
        item.description || '', item.openMethod || 0, item.sort || 0,
        item.itemIconGroupId, userId
      )
    )
    await this.db.batch(inserts)
  }

  /**
   * 编辑或创建图标（有 id 则更新，无 id 则创建）
   * @param body 图标数据
   * @param userId 用户 ID
   */
  async editIcon(body: {
    id?: number; icon?: unknown; title: string; url: string;
    description?: string; openMethod?: number; sort?: number; itemIconGroupId: number
  }, userId: number) {
    const fields = {
      icon_json: JSON.stringify(body.icon || {}),
      title: body.title,
      url: body.url,
      description: body.description || '',
      open_method: body.openMethod || 0,
      sort: body.sort || 0,
      item_icon_group_id: body.itemIconGroupId,
    }

    let resultId: number

    if (body.id) {
      await this.db.prepare(
        `UPDATE item_icons SET icon_json = ?, title = ?, url = ?, description = ?,
         open_method = ?, sort = ?, item_icon_group_id = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`
      ).bind(
        fields.icon_json, fields.title, fields.url, fields.description,
        fields.open_method, fields.sort, fields.item_icon_group_id,
        body.id, userId
      ).run()
      resultId = body.id
    } else {
      const result = await this.db.prepare(
        'INSERT INTO item_icons (icon_json, title, url, description, open_method, sort, item_icon_group_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        fields.icon_json, fields.title, fields.url, fields.description,
        fields.open_method, fields.sort, fields.item_icon_group_id, userId
      ).run()
      resultId = result.meta.last_row_id as number
    }

    return {
      id: resultId,
      icon: body.icon || {},
      title: body.title,
      url: body.url,
      description: body.description || '',
      openMethod: body.openMethod || 0,
      sort: body.sort || 0,
      itemIconGroupId: body.itemIconGroupId,
      userId,
      createTime: nowStr(),
      updateTime: nowStr(),
    }
  }

  /**
   * 批量删除图标
   * @param ids 图标 ID 列表
   * @param userId 用户 ID
   */
  async deleteIcons(ids: number[], userId: number) {
    const placeholders = ids.map(() => '?').join(',')
    await this.db.prepare(
      `DELETE FROM item_icons WHERE id IN (${placeholders}) AND user_id = ?`
    ).bind(...ids, userId).run()
  }

  /**
   * 保存图标排序
   * @param sortItems 排序项列表（id + sort）
   * @param userId 用户 ID
   */
  async saveIconSort(sortItems: Array<{ id: number; sort: number }>, userId: number) {
    if (sortItems.length === 0) return
    const stmt = this.db.prepare(
      "UPDATE item_icons SET sort = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
    )
    const batch = sortItems.map(item => stmt.bind(item.sort, item.id, userId))
    await this.db.batch(batch)
  }

  // ========== 分组 CRUD ==========

  /**
   * 编辑或创建分组（有 id 则更新，无 id 则创建）
   * @param body 分组数据
   * @param userId 用户 ID
   */
  async editGroup(body: {
    id?: number; icon?: string; title: string; description?: string;
    sort?: number; publicVisible?: number
  }, userId: number) {
    const fields = {
      icon: body.icon || '',
      title: body.title,
      description: body.description || '',
      sort: body.sort || 0,
      public_visible: body.publicVisible ?? 1,
    }

    let resultId: number

    if (body.id) {
      await this.db.prepare(
        `UPDATE item_icon_groups SET icon = ?, title = ?, description = ?, sort = ?,
         public_visible = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
      ).bind(
        fields.icon, fields.title, fields.description, fields.sort,
        fields.public_visible, body.id, userId
      ).run()
      resultId = body.id
    } else {
      const result = await this.db.prepare(
        'INSERT INTO item_icon_groups (icon, title, description, sort, public_visible, user_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(
        fields.icon, fields.title, fields.description, fields.sort,
        fields.public_visible, userId
      ).run()
      resultId = result.meta.last_row_id as number
    }

    return {
      id: resultId,
      icon: fields.icon,
      title: fields.title,
      description: fields.description,
      sort: fields.sort,
      publicVisible: fields.public_visible,
      userId,
      createTime: nowStr(),
      updateTime: nowStr(),
    }
  }

  /**
   * 批量删除分组（同时删除分组下的图标）
   * @param ids 分组 ID 列表
   * @param userId 用户 ID
   */
  async deleteGroups(ids: number[], userId: number) {
    const placeholders = ids.map(() => '?').join(',')
    // D1 不支持同一连接并行执行 prepared statement，必须顺序执行
    await this.db.prepare(`DELETE FROM item_icons WHERE item_icon_group_id IN (${placeholders}) AND user_id = ?`)
      .bind(...ids, userId).run()
    await this.db.prepare(`DELETE FROM item_icon_groups WHERE id IN (${placeholders}) AND user_id = ?`)
      .bind(...ids, userId).run()
  }

  /**
   * 保存分组排序
   * @param sortItems 排序项列表（id + sort）
   * @param userId 用户 ID
   */
  async saveGroupSort(sortItems: Array<{ id: number; sort: number }>, userId: number) {
    if (sortItems.length === 0) return
    const stmt = this.db.prepare(
      "UPDATE item_icon_groups SET sort = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
    )
    const batch = sortItems.map(item => stmt.bind(item.sort, item.id, userId))
    await this.db.batch(batch)
  }
}