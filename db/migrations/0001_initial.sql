CREATE TABLE IF NOT EXISTS workspace (
  id TEXT PRIMARY KEY,
  singleton INTEGER NOT NULL DEFAULT 1 UNIQUE CHECK (singleton = 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS device (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  browser TEXT NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS device_workspace_updated_idx ON device(workspace_id, updated_at);

CREATE TABLE IF NOT EXISTS "group" (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  pinned_tracked_tab_id TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS group_workspace_updated_idx ON "group"(workspace_id, updated_at);

CREATE TABLE IF NOT EXISTS tracked_tab (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES "group"(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  emoji TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  current_url TEXT NOT NULL,
  current_title TEXT,
  active_device_id TEXT REFERENCES device(id) ON DELETE SET NULL,
  last_updated_device_id TEXT REFERENCES device(id) ON DELETE SET NULL,
  is_private INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS tracked_tab_workspace_updated_idx ON tracked_tab(workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS tracked_tab_active_device_idx ON tracked_tab(active_device_id);

CREATE TABLE IF NOT EXISTS tracked_tab_history (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  tracked_tab_id TEXT NOT NULL REFERENCES tracked_tab(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  title TEXT,
  visited_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS history_workspace_visited_idx ON tracked_tab_history(workspace_id, visited_at);
CREATE INDEX IF NOT EXISTS history_tab_visited_idx ON tracked_tab_history(tracked_tab_id, visited_at);

CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id TEXT PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
  record_history INTEGER NOT NULL DEFAULT 1,
  strip_query_params INTEGER NOT NULL DEFAULT 0,
  strip_fragments INTEGER NOT NULL DEFAULT 1,
  excluded_hosts TEXT NOT NULL DEFAULT '[]',
  dashboard_theme_seed TEXT NOT NULL DEFAULT '#6750A4',
  dashboard_theme_variant TEXT NOT NULL DEFAULT 'TONAL_SPOT',
  history_retention_days INTEGER,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS mutation_receipt (
  operation_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS receipt_workspace_applied_idx ON mutation_receipt(workspace_id, applied_at);
