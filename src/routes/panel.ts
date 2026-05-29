import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { publicModeMiddleware, getAuthUser } from '../middleware/auth';
import type { ApiResponse, ItemIconRequest, ItemIconRow, ItemIconSortRequest } from '../models/types';

const panelApp = new Hono<{ Bindings: { DB: D1Database } }>();

panelApp.use('*', publicModeMiddleware);

function isHttpUrl(url: string): boolean {
  return /^(https?:\/\/|\/\/)/i.test(url);
}

function isValidUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return false
    if (hostname.startsWith('10.') ||
        hostname.startsWith('172.') && hostname.split('.')[1] >= '16' && hostname.split('.')[1] <= '31' ||
        hostname.startsWith('192.168.')) return false
    return true
  } catch {
    return false
  }
}

const FETCH_TIMEOUT_MS = 8000

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timer)
  }
}

async function getFaviconUrl(urlStr: string): Promise<string | null> {
  if (!isValidUrl(urlStr)) return null

  try {
    const domain = new URL(urlStr)
    const resp = await fetchWithTimeout(urlStr, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'follow',
    })

    if (!resp.ok) {
      const resp2 = await fetchWithTimeout(`https://${domain.hostname}/favicon.ico`, { method: 'HEAD' })
      if (resp2.ok) return `https://${domain.hostname}/favicon.ico`
      return null
    }

    const html = await resp.text();
    const linkRegex = /<link[^>]+rel=["']([^"']*\bicon\b[^"']*)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    const hrefRegex = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']([^"']*\bicon\b[^"']*)["'][^>]*>/gi;

    let match;
    const icons: string[] = [];

    for (const re of [linkRegex, hrefRegex]) {
      while ((match = re.exec(html)) !== null) {
        const href = re === linkRegex ? match[2] : match[1];
        if (href.match(/\.(ico|png|svg|jpg|jpeg|gif|webp)/i) || match[1]?.includes('icon')) {
          icons.push(href);
        }
      }
    }

    for (const v of icons) {
      if (isHttpUrl(v)) return v;
      const urlInfo = new URL(urlStr);
      const fullUrl = `${urlInfo.protocol}//${urlInfo.host}/${v.replace(/^\//, '')}`;
      return fullUrl;
    }

    const defaultFavicon = `${domain.protocol}//${domain.hostname}/favicon.ico`
    const checkResp = await fetchWithTimeout(defaultFavicon, { method: 'HEAD' })
    if (checkResp.ok) return defaultFavicon

    return null;
  } catch {
    return null;
  }
}

/** 图标行转前端格式 */
function formatIcon(row: ItemIconRow) {
  return {
    id: row.id,
    icon: JSON.parse(row.icon_json || '{}'),
    title: row.title,
    url: row.url,
    description: row.description,
    openMethod: row.open_method,
    sort: row.sort,
    itemIconGroupId: row.item_icon_group_id,
    userId: row.user_id,
    createTime: row.created_at,
    updateTime: row.updated_at,
  };
}

const ICON_INSERT_SQL = 'INSERT INTO item_icons (icon_json, title, url, description, open_method, sort, item_icon_group_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

/** 构建图标 bind 参数数组 */
function iconBindParams(item: { icon?: unknown; title: string; url: string; description?: string; openMethod?: number; sort?: number; itemIconGroupId: number }, userId: number) {
  return [JSON.stringify(item.icon || {}), item.title, item.url, item.description || '', item.openMethod || 0, item.sort || 0, item.itemIconGroupId, userId];
}

/**
 * 统一获取全部数据（分组 + 所有图标 + 用户配置）
 * POST /api/panel/getAllData
 * 将原有的 N+1 次请求合并为 1 次，减少 Workers 调用次数
 */
panelApp.post('/getAllData', async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const userId = user!.userId;

  const groupRows = await db.prepare(
    'SELECT * FROM item_icon_groups WHERE user_id = ? ORDER BY sort ASC, id ASC'
  ).bind(userId).all();

  const groups = groupRows.results as unknown as Array<{
    id: number; icon: string; title: string; description: string;
    sort: number; public_visible: number; user_id: number;
    created_at: string; updated_at: string;
  }>;

  const groupIds = groups.map(g => g.id);
  if (groupIds.length === 0) {
    const configRow = await db.prepare('SELECT panel_json FROM user_configs WHERE user_id = ?').bind(userId).first() as { panel_json: string } | null;
    c.header('Cache-Control', 'public, max-age=30');
    return c.json({
      code: 0, msg: 'ok',
      data: { groups: [], itemsMap: {}, panelConfig: configRow?.panel_json ? JSON.parse(configRow.panel_json) : {} }
    } satisfies ApiResponse);
  }

  const placeholders = groupIds.map(() => '?').join(',');
  const iconRows = await db.prepare(
    `SELECT * FROM item_icons WHERE item_icon_group_id IN (${placeholders}) AND user_id = ? ORDER BY sort ASC, id ASC`
  ).bind(...groupIds, userId).all();

  const itemsMap: Record<number, ReturnType<typeof formatIcon>[]> = {};
  (iconRows.results as unknown as ItemIconRow[]).forEach(row => {
    const gid = row.item_icon_group_id;
    if (!itemsMap[gid]) itemsMap[gid] = [];
    itemsMap[gid].push(formatIcon(row));
  });

  const configRow = await db.prepare('SELECT panel_json FROM user_configs WHERE user_id = ?').bind(userId).first() as { panel_json: string } | null;

  const result = {
    groups: groups.map(g => ({
      id: g.id, icon: g.icon, title: g.title, description: g.description,
      sort: g.sort, publicVisible: g.public_visible, userId: g.user_id,
      createTime: g.created_at, updateTime: g.updated_at,
    })),
    itemsMap,
    panelConfig: configRow?.panel_json ? JSON.parse(configRow.panel_json) : {},
  };

  c.header('Cache-Control', 'public, max-age=30');
  return c.json({ code: 0, msg: 'ok', data: result } satisfies ApiResponse);
});

/**
 * 批量添加图标
 * POST /api/panel/itemIcon/addMultiple
 */
panelApp.post('/itemIcon/addMultiple', async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const items = await c.req.json<ItemIconRequest[]>();

  if (!items || items.length === 0) {
    return c.json({ code: 400, msg: '数据不能为空', data: null } satisfies ApiResponse);
  }

  const stmt = db.prepare(ICON_INSERT_SQL);
  const inserts = items.map(item => stmt.bind(...iconBindParams(item, user!.userId) as [unknown, ...unknown[]]));
  await db.batch(inserts);

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

/**
 * 编辑图标
 * POST /api/panel/itemIcon/edit
 */
panelApp.post('/itemIcon/edit', async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const body = await c.req.json<ItemIconRequest>();

  if (!body.title) {
    return c.json({ code: 400, msg: '标题不能为空', data: null } satisfies ApiResponse);
  }

  if (body.id) {
    await db.prepare(
      `UPDATE item_icons SET icon_json = ?, title = ?, url = ?, description = ?, 
       open_method = ?, sort = ?, item_icon_group_id = ?, updated_at = datetime('now') 
       WHERE id = ? AND user_id = ?`
    ).bind(
      JSON.stringify(body.icon || {}),
      body.title,
      body.url,
      body.description || '',
      body.openMethod || 0,
      body.sort || 0,
      body.itemIconGroupId,
      body.id,
      user!.userId
    ).run();

    const row = await db.prepare('SELECT * FROM item_icons WHERE id = ?').bind(body.id).first();
    return c.json({ code: 0, msg: 'ok', data: formatIcon(row as unknown as ItemIconRow) } satisfies ApiResponse);
  } else {
    const result = await db.prepare(ICON_INSERT_SQL).bind(...iconBindParams(body, user!.userId) as [unknown, ...unknown[]]).run();

    const row = await db.prepare('SELECT * FROM item_icons WHERE id = ?').bind(result.meta.last_row_id).first();
    return c.json({ code: 0, msg: 'ok', data: formatIcon(row as unknown as ItemIconRow) } satisfies ApiResponse);
  }
});

/**
 * 根据分组 ID 获取图标列表
 * POST /api/panel/itemIcon/getListByGroupId
 */
panelApp.post('/itemIcon/getListByGroupId', async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const { itemIconGroupId } = await c.req.json<{ itemIconGroupId?: number }>();

  const rows = await db.prepare(
    'SELECT * FROM item_icons WHERE item_icon_group_id = ? AND user_id = ? ORDER BY sort ASC, id ASC'
  ).bind(itemIconGroupId || 0, user!.userId).all();

  const list = rows.results.map(row => formatIcon(row as unknown as ItemIconRow));

  return c.json({ code: 0, msg: 'ok', data: list } satisfies ApiResponse);
});

/**
 * 批量删除图标
 * POST /api/panel/itemIcon/deletes
 */
panelApp.post('/itemIcon/deletes', async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const { ids } = await c.req.json<{ ids: number[] }>();

  if (!ids || ids.length === 0) {
    return c.json({ code: 400, msg: 'ids 不能为空', data: null } satisfies ApiResponse);
  }

  const placeholders = ids.map(() => '?').join(',');
  await db.prepare(
    `DELETE FROM item_icons WHERE id IN (${placeholders}) AND user_id = ?`
  ).bind(...ids, user!.userId).run();

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

/**
 * 保存图标排序
 * POST /api/panel/itemIcon/saveSort
 */
panelApp.post('/itemIcon/saveSort', async (c) => {
  const db = c.env.DB;
  const user = getAuthUser(c);
  const { sortItems } = await c.req.json<ItemIconSortRequest>();

  if (!sortItems || sortItems.length === 0) {
    return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
  }

  const stmt = db.prepare("UPDATE item_icons SET sort = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?");
  const batch = sortItems.map(item => stmt.bind(item.sort, item.id, user!.userId));
  await db.batch(batch);

  return c.json({ code: 0, msg: 'ok', data: null } satisfies ApiResponse);
});

/**
 * 获取网站 favicon 图标 URL
 * POST /api/panel/itemIcon/getSiteFavicon
 */
panelApp.post('/itemIcon/getSiteFavicon', async (c) => {
  const { url } = await c.req.json<{ url: string }>();

  if (!url) {
    return c.json({ code: 400, msg: 'url 不能为空', data: null } satisfies ApiResponse);
  }

  const iconUrl = await getFaviconUrl(url);

  if (!iconUrl) {
    return c.json({ code: 1, msg: '获取图标失败', data: null } satisfies ApiResponse);
  }

  return c.json({ code: 0, msg: 'ok', data: { iconUrl } } satisfies ApiResponse);
});

export default panelApp;