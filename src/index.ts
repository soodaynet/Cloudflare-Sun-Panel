import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { corsMiddleware } from './middleware/cors';
import authRoutes from './routes/auth';
import panelRoutes from './routes/panel';
import groupsRoutes from './routes/groups';
import usersRoutes from './routes/users';
import settingsRoutes from './routes/settings';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS 中间件
app.use('*', corsMiddleware);

// 健康检查
app.get('/api/health', (c) => {
  return c.json({ code: 0, msg: 'ok', data: { status: 'running', time: new Date().toISOString() } });
});

// 路由挂载
app.route('/api', authRoutes);      // /api/login, /api/register
app.route('/api/panel', panelRoutes);   // /api/panel/itemIcon/*
app.route('/api/panel', groupsRoutes);  // /api/panel/itemIconGroup/*
app.route('/api/panel', usersRoutes);   // /api/panel/userConfig/*, /api/panel/users/*
app.route('/api', usersRoutes);         // /api/user/*
app.route('/api', settingsRoutes);      // /api/system/*, /api/about

export default app;