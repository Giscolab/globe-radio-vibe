import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import migrationsSql from '../engine/storage/sqlite/migrations.sql?raw';
import localSeedStations from '../engine/storage/sqlite/seed/stations.json';
import type { DatabaseRequest, DatabaseResponse } from './sqlite-opfs-init';

type SqliteExecOptions<Row> = {
  sql: string;
  bind?: unknown[];
  rowMode?: 'object' | 'array';
  callback?: (row: Row) => boolean | void;
};

type SqliteWasmDb = {
  exec: (options: string | SqliteExecOptions<unknown>) => void;
  changes: () => number;
  close: () => void;
};

type SqliteWasmModule = {
  oo1: {
    OpfsDb?: new (filename: string) => SqliteWasmDb;
  };
  capi?: {
    sqlite3_vfs_find?: (name: string) => unknown;
  };
};

type SeedStation = {
  id: string;
  name: string;
  url: string;
  urlResolved?: string;
  homepage?: string;
  favicon?: string;
  country: string;
  countryCode?: string;
  state?: string;
  language?: string;
  codec?: string;
  bitrate?: number;
  votes?: number;
  clickCount?: number;
  clickTrend?: number;
  geo?: { lat: number; lon: number };
  tags?: string[];
  lastCheckOk?: boolean;
  lastCheckTime?: string;
};

type WorldDatasetPayload = {
  version: string;
  generatedAt: string;
  source: string;
  total: number;
  stations: SeedStation[];
};

type InitResult = {
  mode: 'opfs';
  stationCount: number;
  localSeedCount: number;
  worldSeedCount: number;
  worldDatasetVersion: string | null;
};

const DB_FILENAME = '/globe-radio.sqlite3';
const DB_FILE_HANDLE_NAME = 'globe-radio.sqlite3';
const LOCAL_SEED_VERSION = '1';
const WORLD_DATASET_URL = '/data/world-stations.json';

let sqlitePromise: Promise<SqliteWasmModule> | null = null;
let dbPromise: Promise<SqliteWasmDb> | null = null;
let database: SqliteWasmDb | null = null;

function log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const prefix = `[SQLiteWorker] ${message}`;

  if (level === 'error') {
    console.error(prefix, data ?? '');
    return;
  }

  if (level === 'warn') {
    console.warn(prefix, data ?? '');
    return;
  }

  console.info(prefix, data ?? '');
}

async function loadSqliteModule(): Promise<SqliteWasmModule> {
  if (!sqlitePromise) {
    sqlitePromise = sqlite3InitModule({
      printErr: (...args: unknown[]) => {
        const message = args.join(' ');
        console.warn('[SQLiteWorker]', message);
      },
    }) as Promise<SqliteWasmModule>;
  }

  return sqlitePromise;
}

function dbExec(db: SqliteWasmDb, sql: string, bind?: unknown[]): void {
  if (bind?.length) {
    db.exec({ sql, bind });
    return;
  }

  db.exec(sql);
}

function dbSelectObjects<T>(db: SqliteWasmDb, sql: string, bind?: unknown[]): T[] {
  const rows: T[] = [];
  const options: SqliteExecOptions<T> = {
    sql,
    rowMode: 'object',
    callback: (row: T) => {
      rows.push(row);
    },
  };

  if (bind?.length) {
    options.bind = bind;
  }

  db.exec(options);
  return rows;
}

function dbSelectValue<T>(db: SqliteWasmDb, sql: string, bind?: unknown[]): T | null {
  let value: T | null = null;
  const options: SqliteExecOptions<unknown[]> = {
    sql,
    rowMode: 'array',
    callback: (row: unknown[]) => {
      value = (row[0] ?? null) as T | null;
      return false;
    },
  };

  if (bind?.length) {
    options.bind = bind;
  }

  db.exec(options);
  return value;
}

function getSetting(db: SqliteWasmDb, key: string): string | null {
  return dbSelectValue<string>(db, 'SELECT value FROM settings WHERE key = ?', [key]);
}

function setSetting(db: SqliteWasmDb, key: string, value: unknown): void {
  dbExec(
    db,
    `INSERT OR REPLACE INTO settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))`,
    [key, JSON.stringify(value)]
  );
}

function toStationParams(station: SeedStation): unknown[] {
  return [
    station.id,
    station.name,
    station.url,
    station.urlResolved ?? null,
    station.homepage ?? null,
    station.favicon ?? null,
    station.country,
    station.countryCode?.toUpperCase() ?? '',
    station.state ?? null,
    station.language ?? null,
    null,
    station.codec ?? null,
    station.bitrate ?? 0,
    station.votes ?? 0,
    station.clickCount ?? 0,
    station.clickTrend ?? 0,
    station.geo?.lat ?? null,
    station.geo?.lon ?? null,
    station.tags?.join(',') ?? null,
    station.lastCheckOk === false ? 0 : 1,
    station.lastCheckTime ?? null,
  ];
}

function upsertStation(db: SqliteWasmDb, station: SeedStation): void {
  dbExec(
    db,
    `INSERT INTO stations (
      id, name, url, url_resolved, homepage, favicon,
      country, country_code, state, language, language_codes,
      codec, bitrate, votes, click_count, click_trend,
      lat, lon, tags, last_check_ok, last_check_time, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      url = excluded.url,
      url_resolved = excluded.url_resolved,
      homepage = excluded.homepage,
      favicon = excluded.favicon,
      country = excluded.country,
      country_code = excluded.country_code,
      state = excluded.state,
      language = excluded.language,
      language_codes = excluded.language_codes,
      codec = excluded.codec,
      bitrate = excluded.bitrate,
      votes = excluded.votes,
      click_count = excluded.click_count,
      click_trend = excluded.click_trend,
      lat = excluded.lat,
      lon = excluded.lon,
      tags = excluded.tags,
      last_check_ok = excluded.last_check_ok,
      last_check_time = excluded.last_check_time,
      updated_at = datetime('now')`,
    toStationParams(station)
  );
}

function importStations(db: SqliteWasmDb, stations: SeedStation[], batchSize = 500): void {
  if (stations.length === 0) {
    return;
  }

  for (let index = 0; index < stations.length; index += batchSize) {
    const batch = stations.slice(index, index + batchSize);

    dbExec(db, 'BEGIN');
    try {
      for (const station of batch) {
        upsertStation(db, station);
      }
      dbExec(db, 'COMMIT');
    } catch (error) {
      dbExec(db, 'ROLLBACK');
      throw error;
    }
  }
}

function applyPragmas(db: SqliteWasmDb): void {
  dbExec(db, 'PRAGMA foreign_keys = ON');
  dbExec(db, 'PRAGMA temp_store = MEMORY');
  dbExec(db, 'PRAGMA journal_mode = WAL');
  dbExec(db, 'PRAGMA synchronous = NORMAL');
}

function applyMigrations(db: SqliteWasmDb): void {
  dbExec(db, migrationsSql);
}

async function loadWorldDataset(): Promise<WorldDatasetPayload | null> {
  try {
    const response = await fetch(WORLD_DATASET_URL, { cache: 'no-store' });
    if (!response.ok) {
      log('warn', `World dataset unavailable (${response.status})`);
      return null;
    }

    const payload = await response.json();
    if (!payload || typeof payload !== 'object') {
      log('warn', 'World dataset payload is invalid');
      return null;
    }

    if (Array.isArray(payload)) {
      return {
        version: 'legacy',
        generatedAt: new Date().toISOString(),
        source: 'RadioBrowser',
        total: payload.length,
        stations: payload as SeedStation[],
      };
    }

    const candidate = payload as Partial<WorldDatasetPayload>;
    if (!Array.isArray(candidate.stations)) {
      log('warn', 'World dataset has no stations array');
      return null;
    }

    return {
      version: candidate.version || 'unknown',
      generatedAt: candidate.generatedAt || new Date().toISOString(),
      source: candidate.source || 'RadioBrowser',
      total: candidate.total ?? candidate.stations.length,
      stations: candidate.stations,
    };
  } catch (error) {
    log('warn', 'Failed to load world dataset', error);
    return null;
  }
}

function ensureLocalSeed(db: SqliteWasmDb): void {
  const currentVersion = getSetting(db, 'seed.local.version');
  if (currentVersion === JSON.stringify(LOCAL_SEED_VERSION)) {
    return;
  }

  dbExec(db, 'BEGIN');
  try {
    for (const station of localSeedStations as SeedStation[]) {
      dbExec(
        db,
        `INSERT OR IGNORE INTO stations (
          id, name, url, url_resolved, homepage, favicon,
          country, country_code, state, language, language_codes,
          codec, bitrate, votes, click_count, click_trend,
          lat, lon, tags, last_check_ok, last_check_time, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        toStationParams(station)
      );
    }

    setSetting(db, 'seed.local.version', LOCAL_SEED_VERSION);
    setSetting(db, 'seed.local.count', (localSeedStations as SeedStation[]).length);
    dbExec(db, 'COMMIT');
  } catch (error) {
    dbExec(db, 'ROLLBACK');
    throw error;
  }
}

async function ensureWorldSeed(db: SqliteWasmDb): Promise<{ version: string | null; count: number }> {
  const payload = await loadWorldDataset();
  if (!payload) {
    return { version: null, count: 0 };
  }

  const currentVersion = getSetting(db, 'seed.world.version');
  const expectedVersion = JSON.stringify(payload.version);

  if (currentVersion === expectedVersion) {
    return { version: payload.version, count: payload.total };
  }

  importStations(db, payload.stations, 500);
  setSetting(db, 'seed.world.version', payload.version);
  setSetting(db, 'seed.world.generated_at', payload.generatedAt);
  setSetting(db, 'seed.world.count', payload.total);
  setSetting(db, 'seed.world.source', payload.source);

  return { version: payload.version, count: payload.total };
}

async function openDatabase(): Promise<SqliteWasmDb> {
  const sqlite3 = await loadSqliteModule();
  const opfsVfs = sqlite3.capi?.sqlite3_vfs_find?.('opfs');

  if (!sqlite3.oo1.OpfsDb || !opfsVfs) {
    throw new Error(
      'SQLite OPFS is unavailable. Serve the app with Cross-Origin-Opener-Policy=same-origin and Cross-Origin-Embedder-Policy=require-corp.'
    );
  }

  const db = new sqlite3.oo1.OpfsDb(DB_FILENAME);
  applyPragmas(db);
  applyMigrations(db);
  ensureLocalSeed(db);
  await ensureWorldSeed(db);

  return db;
}

async function getDatabase(): Promise<SqliteWasmDb> {
  if (database) {
    return database;
  }

  if (!dbPromise) {
    dbPromise = openDatabase()
      .then((db) => {
        database = db;
        return db;
      })
      .catch((error) => {
        dbPromise = null;
        throw error;
      });
  }

  return dbPromise;
}

async function closeDatabase(): Promise<void> {
  if (database) {
    database.close();
    database = null;
  }
  dbPromise = null;
}

async function deleteDatabase(): Promise<void> {
  await closeDatabase();

  if (!navigator.storage?.getDirectory) {
    return;
  }

  const root = await navigator.storage.getDirectory();
  await root.removeEntry(DB_FILE_HANDLE_NAME);
}

async function getInitResult(db: SqliteWasmDb): Promise<InitResult> {
  const stationCount = Number(dbSelectValue<number>(db, 'SELECT COUNT(*) FROM stations') ?? 0);
  const localSeedCount = Number(getSetting(db, 'seed.local.count') ? JSON.parse(getSetting(db, 'seed.local.count') as string) : 0);
  const worldSeedCount = Number(getSetting(db, 'seed.world.count') ? JSON.parse(getSetting(db, 'seed.world.count') as string) : 0);
  const versionSetting = getSetting(db, 'seed.world.version');

  return {
    mode: 'opfs',
    stationCount,
    localSeedCount,
    worldSeedCount,
    worldDatasetVersion: versionSetting ? JSON.parse(versionSetting) : null,
  };
}

async function handleRequest(message: DatabaseRequest): Promise<unknown> {
  switch (message.type) {
    case 'init': {
      const db = await getDatabase();
      return getInitResult(db);
    }

    case 'exec': {
      const db = await getDatabase();
      const payload = (message.payload ?? {}) as { sql: string; bind?: unknown[] };
      dbExec(db, payload.sql, payload.bind);
      return { changes: db.changes() };
    }

    case 'query': {
      const db = await getDatabase();
      const payload = (message.payload ?? {}) as { sql: string; bind?: unknown[] };
      return dbSelectObjects<Record<string, unknown>>(db, payload.sql, payload.bind);
    }

    case 'value': {
      const db = await getDatabase();
      const payload = (message.payload ?? {}) as { sql: string; bind?: unknown[] };
      return dbSelectValue(db, payload.sql, payload.bind);
    }

    case 'close': {
      await closeDatabase();
      return true;
    }

    case 'deleteDatabase': {
      await deleteDatabase();
      return true;
    }

    case 'vacuum': {
      const db = await getDatabase();
      dbExec(db, 'VACUUM');
      return true;
    }

    case 'integrity': {
      const db = await getDatabase();
      const rows = dbSelectObjects<{ integrity_check: string }>(db, 'PRAGMA integrity_check');
      const errors = rows
        .map((row) => row.integrity_check)
        .filter((value) => value !== 'ok');
      return {
        ok: errors.length === 0,
        errors,
      };
    }

    case 'analyze': {
      const db = await getDatabase();
      dbExec(db, 'ANALYZE');
      return true;
    }

    case 'stats': {
      const db = await getDatabase();
      const pageCount = Number(dbSelectValue<number>(db, 'PRAGMA page_count') ?? 0);
      const pageSize = Number(dbSelectValue<number>(db, 'PRAGMA page_size') ?? 0);
      const tableNames = ['stations', 'favorites', 'play_history', 'settings', 'ai_signals'];
      const tables = tableNames.map((name) => ({
        name,
        rowCount: Number(dbSelectValue<number>(db, `SELECT COUNT(*) FROM ${name}`) ?? 0),
      }));

      return {
        sizeBytes: pageCount * pageSize,
        pageCount,
        pageSize,
        tables,
      };
    }

    default:
      throw new Error(`Unsupported SQLite worker command: ${message.type}`);
  }
}

self.addEventListener('message', async (event: MessageEvent<DatabaseRequest>) => {
  const message = event.data;

  try {
    const result = await handleRequest(message);
    const response: DatabaseResponse = {
      id: message.id,
      ok: true,
      result,
    };
    self.postMessage(response);
  } catch (error) {
    const response: DatabaseResponse = {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
});
