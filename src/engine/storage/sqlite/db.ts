// Engine - SQLite WASM Database Manager
import { logger } from '../../core/logger';

export type SqliteDatabase = {
  exec: (sql: string, params?: unknown[]) => void;
  selectObjects: <T>(sql: string, params?: unknown[]) => T[];
  selectValue: (sql: string, params?: unknown[]) => unknown;
  changes: () => number;
  close: () => void;
};

export type StorageMode = 'opfs' | 'memory';

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
    if (!navigator.storage?.getDirectory) {
      return false;
    }
    const root = await navigator.storage.getDirectory();
    // Try to create a test file
    const testHandle = await root.getFileHandle('__opfs_test__', { create: true });
    await root.removeEntry('__opfs_test__');
    return true;
  } catch (error) {
    logger.warn('Storage', 'OPFS not available:', error);
    return false;
  }
}

async function loadSqliteWasm(): Promise<any> {
  try {
    // Dynamic import for code splitting
    const sqlite3InitModule = await import('@sqlite.org/sqlite-wasm');
    const sqlite3 = await sqlite3InitModule.default();
    return sqlite3;
  } catch (error) {
    logger.error('Storage', 'Failed to load SQLite WASM:', error);
    throw error;
  }
}

export async function initDatabase(): Promise<SqliteDatabase> {
  if (state.initialized && state.db) {
    return state.db;
  }

  logger.info('Storage', 'Initializing SQLite WASM...');

  const sqlite3 = await loadSqliteWasm();
  const opfsAvailable = await detectOPFS();

  let db: any;

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

  // Wrap the native DB with our interface
  const wrappedDb: SqliteDatabase = {
    exec: (sql: string, params?: unknown[]) => {
      if (params && params.length > 0) {
        db.exec({ sql, bind: params });
      } else {
        db.exec(sql);
      }
    },
    selectObjects: <T>(sql: string, params?: unknown[]): T[] => {
      const result: T[] = [];
      const options: any = {
        sql,
        rowMode: 'object',
        callback: (row: T) => {
          result.push(row);
          return undefined; // Continue iteration
        },
      };
      if (params && params.length > 0) {
        options.bind = params;
      }
      db.exec(options);
      return result;
    },
    selectValue: (sql: string, params?: unknown[]): unknown => {
      let value: unknown = null;
      const options: any = {
        sql,
        rowMode: 'array',
        callback: (row: unknown[]) => {
          value = row[0];
          return false; // Stop after first row
        },
      };
      if (params && params.length > 0) {
        options.bind = params;
      }
      db.exec(options);
      return value;
    },
    changes: () => db.changes(),
    close: () => db.close(),
  };

  state.db = wrappedDb;
  state.initialized = true;

  logger.info('Storage', `Database initialized (mode: ${state.mode})`);

  return wrappedDb;
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
