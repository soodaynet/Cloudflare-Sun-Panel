import type { D1Database } from '@cloudflare/workers-types'
import type { ItemIconRow, ItemIconGroupRow } from './types'
import type {
  IconItem,
  GroupItem,
  IconEditBody,
  GroupEditBody,
  SortItem,
  AllDataResponse,
  FaviconResponse,
} from './types'
import { queryAll, queryFirst } from '../shared/db'
import { AppError } from '../shared/errors'
import { isValidUrl, parseFaviconFromHtml, parseSiteMetadataFromHtml, probeFavicon } from '../shared/favicon'

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
  formatIcon(row: ItemIconRow): IconItem {
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
  formatGroup(row: ItemIconGroupRow): GroupItem {
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
   * @param prefetchedConfigRow 预取的 user_configs 行（/init 聚合路径复用，命中时跳过 user_configs 查询）
   */
  async getAllData(
    userId: number,
    prefetchedConfigRow?: { panel_json: string } | null,
  ): Promise<AllDataResponse> {
    const [groups, iconRows, configRow] = await Promise.all([
      queryAll<ItemIconGroupRow>(this.db,
        `${GROUP_SELECT} WHERE user_id = ? ORDER BY sort ASC, id ASC`, userId),
      queryAll<ItemIconRow>(this.db,
        `${ICON_SELECT} WHERE user_id = ? ORDER BY sort ASC, id ASC`, userId),
      // 命中预取行则跳过 user_configs 查询（/init 路径已由 userConfig.getRawRow 预取）
      prefetchedConfigRow !== undefined
        ? Promise.resolve(prefetchedConfigRow)
        : queryFirst<{ panel_json: string }>(this.db,
          'SELECT panel_json FROM user_configs WHERE user_id = ?', userId),
    ])

    const itemsMap: Record<number, IconItem[]> = {}
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
  async getIconsByGroupId(itemIconGroupId: number, userId: number): Promise<IconItem[]> {
    return (await queryAll<ItemIconRow>(this.db,
      `${ICON_SELECT} WHERE item_icon_group_id = ? AND user_id = ? ORDER BY sort ASC, id ASC`,
      itemIconGroupId, userId)).map(row => this.formatIcon(row))
  }

  /**
   * 获取用户的所有分组列表
   * @param userId 用户 ID
   */
  async getGroupList(userId: number): Promise<GroupItem[]> {
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
  async addMultipleIcons(items: IconEditBody[], userId: number): Promise<void> {
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
  async editIcon(body: IconEditBody, userId: number): Promise<IconItem> {
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
  async deleteIcons(ids: number[], userId: number): Promise<void> {
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
  async saveIconSort(sortItems: SortItem[], userId: number): Promise<void> {
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
  async editGroup(body: GroupEditBody, userId: number): Promise<GroupItem> {
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
  async deleteGroups(ids: number[], userId: number): Promise<void> {
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
  async saveGroupSort(sortItems: SortItem[], userId: number): Promise<void> {
    if (sortItems.length === 0) return
    const stmt = this.db.prepare(
      "UPDATE item_icon_groups SET sort = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
    )
    const batch = sortItems.map(item => stmt.bind(item.sort, item.id, userId))
    await this.db.batch(batch)
  }

  // ========== 其他 ==========

  /**
   * 获取站点 favicon URL 列表 + 站点元数据
   *
   * 服务端抓取站点 HTML 并解析所有图标 link 标签
   * （icon/shortcut icon/apple-touch-icon/mask-icon/fluid-icon 与 msapplication-TileImage），
   * 同时解析 Open Graph / 基础元数据（title/description/siteName/ogImage）；
   * HEAD 探测 /favicon.ico 与 HTML 抓取并行执行；受 isValidUrl SSRF 防护；
   * HTML 抓取 3s 超时；cf 边缘缓存 1 小时。
   * 抓取失败时使用兜底 URL（站点 /favicon.ico + Google favicon 服务）。
   *
   * @param url 站点 URL
   */
  async getSiteFavicon(url: string): Promise<FaviconResponse> {
    if (!isValidUrl(url)) {
      throw AppError.badRequest('URL 不合法或包含内网地址')
    }
    const parsedUrl = new URL(url)
    const origin = parsedUrl.origin
    const found = new Set<string>()
    let meta = { title: '', description: '', siteName: '', ogImage: '' }

    // 并行执行：favicon.ico HEAD 探测 + HTML 抓取
    const [probe, html] = await Promise.all([
      probeFavicon(origin, '/favicon.ico'),
      (async () => {
        try {
          const abort = new AbortController()
          const timeout = setTimeout(() => abort.abort(), 3000)
          const res = await fetch(origin, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SunPanel/1.0)', Accept: 'text/html' },
            signal: abort.signal,
            redirect: 'follow',
            cf: { cacheTtl: 3600 },
          } as RequestInit)
          clearTimeout(timeout)
          if (!res.ok) return null
          return await res.text()
        } catch { return null }
      })(),
    ])

    if (probe) found.add(probe.url)

    if (html) {
      // 同时解析 favicon 候选与站点元数据
      const candidates = parseFaviconFromHtml(html, origin)
      for (const c of candidates) found.add(c.url)
      meta = parseSiteMetadataFromHtml(html, origin)
      if (meta.ogImage) found.add(meta.ogImage)
    }

    // 兜底
    found.add(`${origin}/favicon.ico`)
    // 兜底改走同源 /api/favicon-proxy（边缘缓存 30 天 + 64px），避免外链 google favicon
    found.add(`/api/favicon-proxy?domain=${encodeURIComponent(parsedUrl.hostname)}&sz=64`)

    const iconUrls = Array.from(found).slice(0, 10)
    return { iconUrls, title: meta.title, description: meta.description, siteName: meta.siteName }
  }
}
