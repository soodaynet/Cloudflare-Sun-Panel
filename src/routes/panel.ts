import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { publicModeMiddleware, getAuthUser } from '../middleware/auth';
import { validate, iconEditSchema, iconAddMultipleSchema, idsSchema, sortSchema, getListByGroupIdSchema, faviconSchema } from '../utils/validate';
import { PanelService } from '../services/PanelService';
import { ok, fail, getErrorMessage } from '../utils/response';

type Variables = {
  validatedBody: unknown;
};

const panelApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>();

panelApp.use('*', publicModeMiddleware);

/** 校验 URL 是否合法（SSRF 防护） */
function isValidUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return false;

    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Pattern);
    if (match) {
      const [, a, b, c, d] = match.map(Number);
      if (a === 10) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 127) return false;
      if (a === 169 && b === 254) return false;
      if (a === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** 从 HTML 中解析 favicon 链接 */
function parseFaviconFromHtml(html: string, baseUrl: string): string | null {
  // 匹配多种 favicon 格式: icon, shortcut icon, apple-touch-icon, mask-icon 等
  const regex = /<link[^>]*\brel=["']([^"']*\b(?:icon|apple-touch-icon|mask-icon)\b[^"']*)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  const candidates: string[] = [];

  const hrefRegex = /href=["']([^"']+)["']/i;
  while ((match = regex.exec(html)) !== null) {
    const hrefMatch = match[0].match(hrefRegex);
    if (hrefMatch && hrefMatch[1]) {
      const resolved = new URL(hrefMatch[1], baseUrl).href;
      // 优先 apple-touch-icon (通常尺寸更大)
      if (/apple-touch-icon/i.test(match[1])) {
        candidates.unshift(resolved);
      } else {
        candidates.push(resolved);
      }
    }
  }
  return candidates.length > 0 ? candidates[0] : null;
}

/** 快速探测 favicon 路径（HEAD 请求，不下载 body） */
async function probeFavicon(origin: string, path: string): Promise<string | null> {
  try {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 3000);
    const res = await fetch(`${origin}${path}`, {
      method: 'HEAD',
      signal: abort.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SunPanel/1.0)' },
      cf: { cacheTtl: 3600 },
    } as RequestInit);
    clearTimeout(timeout);
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.startsWith('image/') || ct.includes('icon')) {
        return `${origin}${path}`;
      }
    }
  } catch { /* probe failed */ }
  return null;
}

/**
 * 统一获取全部数据（分组 + 所有图标 + 用户配置）
 * POST /api/panel/getAllData
 */
panelApp.post('/getAllData', async (c) => {
  try {
    const user = getAuthUser(c);
    const userId = user!.userId;
    const service = new PanelService(c.env.DB);
    const result = await service.getAllData(userId);

    c.header('Cache-Control', 'public, max-age=30');
    return ok(c, result);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 批量添加图标
 * POST /api/panel/itemIcon/addMultiple
 */
panelApp.post('/itemIcon/addMultiple', validate(iconAddMultipleSchema), async (c) => {
  try {
    const user = getAuthUser(c);
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403);
    const items = c.var.validatedBody as Array<{
      icon?: { itemType: number; src?: string; text?: string; backgroundColor?: string };
      title: string; url: string; description?: string;
      openMethod?: number; sort?: number; itemIconGroupId: number;
    }>;

    const service = new PanelService(c.env.DB);
    await service.addMultipleIcons(items, user!.userId);
    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 编辑图标
 * POST /api/panel/itemIcon/edit
 */
panelApp.post('/itemIcon/edit', validate(iconEditSchema), async (c) => {
  try {
    const user = getAuthUser(c);
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403);
    const body = c.var.validatedBody as {
      id?: number; icon?: { itemType: number; src?: string; text?: string; backgroundColor?: string };
      title: string; url: string; description?: string;
      openMethod?: number; sort?: number; itemIconGroupId: number;
    };

    const service = new PanelService(c.env.DB);
    const result = await service.editIcon(body, user!.userId);
    return ok(c, result);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 根据分组 ID 获取图标列表
 * POST /api/panel/itemIcon/getListByGroupId
 */
panelApp.post('/itemIcon/getListByGroupId', validate(getListByGroupIdSchema), async (c) => {
  try {
    const user = getAuthUser(c);
    const { itemIconGroupId } = c.var.validatedBody as { itemIconGroupId?: number };

    const service = new PanelService(c.env.DB);
    const list = await service.getIconsByGroupId(itemIconGroupId || 0, user!.userId);
    return ok(c, list);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 批量删除图标
 * POST /api/panel/itemIcon/deletes
 */
panelApp.post('/itemIcon/deletes', validate(idsSchema), async (c) => {
  try {
    const user = getAuthUser(c);
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403);
    const { ids } = c.var.validatedBody as { ids: number[] };

    const service = new PanelService(c.env.DB);
    await service.deleteIcons(ids, user!.userId);
    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 保存图标排序
 * POST /api/panel/itemIcon/saveSort
 */
panelApp.post('/itemIcon/saveSort', validate(sortSchema), async (c) => {
  try {
    const user = getAuthUser(c);
    if (user!.visitMode === 1) return fail(c, '访客模式下不允许修改', 403);
    const { sortItems } = c.var.validatedBody as { sortItems: Array<{ id: number; sort: number }> };

    if (sortItems.length === 0) {
      return ok(c, null);
    }

    const service = new PanelService(c.env.DB);
    await service.saveIconSort(sortItems, user!.userId);
    return ok(c, null);
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

/**
 * 获取站点图标 (favicon)
 * POST /api/panel/itemIcon/getSiteFavicon
 *
 * 策略: 先用 HEAD 快速探测常见路径，未命中则下载 HTML 解析
 */
panelApp.post('/itemIcon/getSiteFavicon', validate(faviconSchema), async (c) => {
  try {
    const { url } = c.var.validatedBody as { url: string };

    if (!isValidUrl(url)) {
      return fail(c, 'URL 不合法或包含内网地址', 400);
    }

    const parsedUrl = new URL(url);
    const origin = parsedUrl.origin;

    // 阶段 1: 快速探测常见路径（HEAD 请求，不下载 body）
    const probePaths = [
      '/favicon.ico',
      '/favicon.png',
      '/favicon.svg',
      '/apple-touch-icon.png',
      '/apple-touch-icon-precomposed.png',
    ];
    const probes = probePaths.map(path => probeFavicon(origin, path));
    const results = await Promise.allSettled(probes);
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        return ok(c, { iconUrl: r.value });
      }
    }

    // 阶段 2: 下载 HTML 并解析 <link> 标签
    const htmlRes = await fetch(origin, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SunPanel/1.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
      cf: { cacheTtl: 3600 },
    } as RequestInit);

    if (!htmlRes.ok) {
      return ok(c, { iconUrl: `${origin}/favicon.ico` });
    }

    const html = await htmlRes.text();
    const iconUrl = parseFaviconFromHtml(html, origin) || `${origin}/favicon.ico`;

    return ok(c, { iconUrl });
  } catch (e: unknown) {
    return fail(c, getErrorMessage(e), 500);
  }
});

export default panelApp;