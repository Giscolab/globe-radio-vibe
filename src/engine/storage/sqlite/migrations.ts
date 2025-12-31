// Engine - SQLite Migrations
import { SqliteDatabase } from './db';
import { logger } from '../../core/logger';

interface Migration {
  version: number;
  name: string;
  up: (db: SqliteDatabase) => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_schema_version',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
  },
  {
    version: 2,
    name: 'create_stations',
    up: (db) => {
      db.exec(`
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
          last_check_ok INTEGER DEFAULT 1,
          last_check_time TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_stations_country_code ON stations(country_code)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_stations_name ON stations(name)');
    },
  },
  {
    version: 3,
    name: 'create_favorites',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS favorites (
          station_id TEXT PRIMARY KEY,
          added_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
        )
      `);
    },
  },
  {
    version: 4,
    name: 'create_play_history',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS play_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          station_id TEXT NOT NULL,
          played_at TEXT NOT NULL DEFAULT (datetime('now')),
          duration_seconds INTEGER DEFAULT 0,
          FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
        )
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_play_history_station ON play_history(station_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_play_history_played_at ON play_history(played_at DESC)');
    },
  },
  {
    version: 5,
    name: 'create_settings',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
  },
];

function getCurrentVersion(db: SqliteDatabase): number {
  try {
    const version = db.selectValue('SELECT MAX(version) FROM schema_version');
    return (version as number) || 0;
  } catch {
    return 0;
  }
}

function recordMigration(db: SqliteDatabase, version: number): void {
  db.exec('INSERT INTO schema_version (version) VALUES (?)', [version]);
}

export async function runMigrations(db: SqliteDatabase): Promise<void> {
  logger.info('Migrations', 'Checking migrations...');

  // Ensure schema_version table exists first
  migrations[0].up(db);

  const currentVersion = getCurrentVersion(db);
  const pendingMigrations = migrations.filter((m) => m.version > currentVersion);

  if (pendingMigrations.length === 0) {
    logger.info('Migrations', `Database is up to date (version ${currentVersion})`);
    return;
  }

  logger.info('Migrations', `Running ${pendingMigrations.length} migrations...`);

  for (const migration of pendingMigrations) {
    try {
      logger.debug('Migrations', `Applying migration ${migration.version}: ${migration.name}`);
      migration.up(db);
      recordMigration(db, migration.version);
      logger.info('Migrations', `Migration ${migration.version} applied: ${migration.name}`);
    } catch (error) {
      logger.error('Migrations', `Migration ${migration.version} failed:`, error);
      throw new Error(`Migration ${migration.version} (${migration.name}) failed: ${error}`);
    }
  }

  logger.info('Migrations', `Migrations complete. Now at version ${migrations.length}`);
}

export function getMigrationVersion(): number {
  return migrations.length;
}
