PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  url_resolved TEXT,
  homepage TEXT,
  favicon TEXT,
  country TEXT NOT NULL,
  country_code TEXT NOT NULL,
  state TEXT,
  language TEXT,
  language_codes TEXT,
  codec TEXT,
  bitrate INTEGER DEFAULT 0,
  votes INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  click_trend INTEGER DEFAULT 0,
  lat REAL,
  lon REAL,
  tags TEXT,
  last_check_ok INTEGER DEFAULT 0,
  last_check_time TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS favorites (
  station_id TEXT PRIMARY KEY,
  added_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (station_id) REFERENCES stations (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS play_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL,
  played_at TEXT DEFAULT (datetime('now')),
  duration_seconds INTEGER DEFAULT 0,
  FOREIGN KEY (station_id) REFERENCES stations (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL,
  type TEXT NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (station_id) REFERENCES stations (id) ON DELETE CASCADE
);
