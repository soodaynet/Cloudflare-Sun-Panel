import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { publicModeMiddleware, getAuthUser } from '../middleware/auth';
import { validate, iconEditSchema, iconAddMultipleSchema, idsSchema, sortSchema, getListByGroupIdSchema } from '../utils/validate';
import { PanelService } from '../services/PanelService';
import { ok, fail, getErrorMessage } from '../utils/response';

type Variables = {
  validatedBody: unknown;
};

const panelApp = new Hono<{ Bindings: { DB: D1Database }; Variables: Variables }>();

panelApp.use('*', publicModeMiddleware);

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

export default panelApp;