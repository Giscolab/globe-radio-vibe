// Engine - SQLite WASM Database Manager
import { logger } from '../../core/logger';

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import migrationsSql from './migrations.sql?raw';

export type SqliteDatabase = {
  exec: (sql: string, params?: unknown[]) => void;
  selectObjects: <T>(sql: string, params?: unknown[]) => T[];
  selectValue: (sql: string, params?: unknown[]) => unknown;
  changes: () => number;
  close: () => void;
};

export type StorageMode = 'opfs' | 'memory';

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
    DB: new (filename: string) => SqliteWasmDb;
    OpfsDb?: new (filename: string) => SqliteWasmDb;
  };
};

interface DatabaseState {
  db: SqliteDatabase | null;
  mode: StorageMode;
  initialized: boolean;
}

const state: DatabaseState = {
  db: null,
  mode: 'memory',
  initialized: false,
};

const DB_NAME = 'globe-radio.sqlite3';

async function detectOPFS(): Promise<boolean> {
  try {
    if (!navigator.storage?.getDirectory) return false;
    const root = await navigator.storage.getDirectory();
    const testHandle = await root.getFileHandle('__opfs_test__', { create: true });
    await root.removeEntry('__opfs_test__');
    return true;
  } catch (error) {
    logger.info('Storage', 'OPFS not available, falling back to memory.');
    return false;
  }
}

let sqlitePromise: Promise<SqliteWasmModule> | null = null;

async function loadSqliteWasm(): Promise<SqliteWasmModule> {
  if (!sqlitePromise) {
    // Initialize without wasmBinary - let the module load it via locateFile
    sqlitePromise = sqlite3InitModule() as Promise<SqliteWasmModule>;
  }
  return sqlitePromise;
}

export async function initDatabase(): Promise<SqliteDatabase> {
  if (state.initialized && state.db) return state.db;

  logger.info('Storage', 'Initializing SQLite WASM...');

  const sqlite3 = await loadSqliteWasm();
  const opfsAvailable = await detectOPFS();

  let db: SqliteWasmDb;

  if (opfsAvailable && sqlite3.oo1.OpfsDb) {
    try {
      logger.info('Storage', 'Using OPFS storage');
      db = new sqlite3.oo1.OpfsDb(DB_NAME);
      state.mode = 'opfs';
    } catch (error) {
      logger.warn('Storage', 'OPFS init failed, falling back to memory:', error);
      db = new sqlite3.oo1.DB(':memory:');
      state.mode = 'memory';
    }
  } else {
    logger.info('Storage', 'Using in-memory storage (OPFS not available)');
    db = new sqlite3.oo1.DB(':memory:');
    state.mode = 'memory';
  }

  const wrappedDb: SqliteDatabase = {
    exec: (sql: string, params?: unknown[]) => {
      if (params?.length) db.exec({ sql, bind: params });
      else db.exec(sql);
    },
    selectObjects: <T>(sql: string, params?: unknown[]): T[] => {
      const result: T[] = [];
      const options: SqliteExecOptions<T> = {
        sql,
        rowMode: 'object',
        callback: (row: T) => { result.push(row); }
      };
      if (params?.length) options.bind = params;
      db.exec(options);
      return result;
    },
    selectValue: (sql: string, params?: unknown[]): unknown => {
      let value: unknown = null;
      const options: SqliteExecOptions<unknown[]> = {
        sql,
        rowMode: 'array',
        callback: (row: unknown[]) => {
          value = row[0];
          return false;
        }
      };
      if (params?.length) options.bind = params;
      db.exec(options);
      return value;
    },
    changes: () => db.changes(),
    close: () => db.close(),
  };

  applyMigrations(wrappedDb);

  state.db = wrappedDb;
  state.initialized = true;

  logger.info('Storage', `Database initialized (mode: ${state.mode})`);
  return wrappedDb;
}

function applyMigrations(db: SqliteDatabase): void {
  try {
    db.exec(migrationsSql);
    logger.info('Storage', 'Migrations applied');
  } catch (error) {
    logger.error('Storage', 'Failed to apply migrations:', error);
    throw error;
  }
}

export function getDatabase(): SqliteDatabase | null {
  return state.db;
}

export function getStorageMode(): StorageMode {
  return state.mode;
}

export function isInitialized(): boolean {
  return state.initialized;
}

export async function closeDatabase(): Promise<void> {
  if (state.db) {
    state.db.close();
    state.db = null;
    state.initialized = false;
    logger.info('Storage', 'Database closed');
  }
}

export async function deleteDatabase(): Promise<void> {
  await closeDatabase();
  if (state.mode === 'opfs') {
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(DB_NAME);
      logger.info('Storage', 'Database file deleted from OPFS');
    } catch (error) {
      logger.warn('Storage', 'Failed to delete OPFS database:', error);
    }
  }
}

export async function vacuumDatabase(): Promise<void> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');
  logger.info('Storage', 'Running VACUUM...');
  const start = performance.now();
  db.exec('VACUUM');
  logger.info('Storage', `VACUUM completed in ${Math.round(performance.now() - start)}ms`);
}

export async function checkIntegrity(): Promise<{ ok: boolean; errors: string[] }> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');
  logger.info('Storage', 'Running integrity check...');
  const results = db.selectObjects<{ integrity_check: string }>('PRAGMA integrity_check');
  const errors = results.filter(r => r.integrity_check !== 'ok').map(r => r.integrity_check);
  const ok = errors.length === 0;
  if (ok) logger.info('Storage', 'Integrity check passed');
  else logger.error('Storage', 'Integrity check failed:', errors);
  return { ok, errors };
}

export async function analyzeDatabase(): Promise<void> {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');
  logger.info('Storage', 'Running ANALYZE...');
  const start = performance.now();
  db.exec('ANALYZE');
  logger.info('Storage', `ANALYZE completed in ${Math.round(performance.now() - start)}ms`);
}

export async function getDatabaseStats() {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized');

  const pageCount = db.selectValue('PRAGMA page_count') as number;
  const pageSize = db.selectValue('PRAGMA page_size') as number;
  const sizeBytes = pageCount * pageSize;

  const tableNames = ['stations', 'favorites', 'play_history', 'settings', 'ai_signals'];
  const tables = tableNames.map(name => {
    try {
      const count = db.selectValue(`SELECT COUNT(*) FROM ${name}`) as number;
      return { name, rowCount: count };
    } catch {
      return { name, rowCount: 0 };
    }
  });

  logger.info('Storage', `Database stats: ${(sizeBytes / 1024).toFixed(1)} KB, ${pageCount} pages`);
  return { sizeBytes, pageCount, pageSize, tables };
}
