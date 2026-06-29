-- Sun-Panel D1 Database Schema

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT DEFAULT '',
    head_image TEXT DEFAULT '',
    status INTEGER DEFAULT 1,       -- 0:停用 1:启用
    role INTEGER DEFAULT 2,         -- 1:管理员 2:普通用户
    mail TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 图标分组表
CREATE TABLE IF NOT EXISTS item_icon_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    icon TEXT DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    sort INTEGER DEFAULT 0,
    public_visible INTEGER DEFAULT 1,     -- 1:访客可见 0:访客不可见
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 图标表
CREATE TABLE IF NOT EXISTS item_icons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    icon_json TEXT DEFAULT '',           -- JSON: {itemType, src, text, backgroundColor}
    title TEXT NOT NULL DEFAULT '',
    url TEXT DEFAULT '',
    description TEXT DEFAULT '',
    open_method INTEGER DEFAULT 0,       -- 打开方式
    sort INTEGER DEFAULT 0,
    item_icon_group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (item_icon_group_id) REFERENCES item_icon_groups(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 用户配置表
CREATE TABLE IF NOT EXISTS user_configs (
    user_id INTEGER PRIMARY KEY,
    panel_json TEXT DEFAULT '{}',         -- 面板样式 JSON
    search_engine_json TEXT DEFAULT '{}', -- 搜索引擎配置 JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_name TEXT NOT NULL UNIQUE,
    config_value TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_item_icons_group_id ON item_icons(item_icon_group_id);
CREATE INDEX IF NOT EXISTS idx_item_icons_user_id ON item_icons(user_id);
CREATE INDEX IF NOT EXISTS idx_item_icon_groups_user_id ON item_icon_groups(user_id);
-- 复合索引：按用户查询分组并按 sort, id 排序
CREATE INDEX IF NOT EXISTS idx_item_icon_groups_user_sort ON item_icon_groups(user_id, sort, id);
-- 复合索引：按分组查询图标 + 按用户隔离
CREATE INDEX IF NOT EXISTS idx_item_icons_group_user ON item_icons(item_icon_group_id, user_id);
-- 复合索引：按用户排序图标
CREATE INDEX IF NOT EXISTS idx_item_icons_user_sort ON item_icons(user_id, sort, id);

-- 默认管理员 (密码: admin)，仅在 users 表为空时插入
INSERT INTO users (id, username, password, name, role, status)
SELECT 1, 'admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'Admin', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM users);