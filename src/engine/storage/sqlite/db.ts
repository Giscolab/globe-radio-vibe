import { logger } from '../../core/logger';
import {
  createSqliteWorkerClient,
  type SqliteWorkerClient,
} from '../../../worker/sqlite-opfs-init';

export type StorageMode = 'opfs' | 'unknown';

export interface SqliteDatabase {
  exec(sql: string, params?: unknown[]): Promise<void>;
  selectObjects<T>(sql: string, params?: unknown[]): Promise<T[]>;
  selectValue<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  close(): Promise<void>;
}

type InitResult = {
  mode: 'opfs';
  stationCount: number;
  localSeedCount: number;
  worldSeedCount: number;
  worldDatasetVersion: string | null;
};

type DatabaseState = {
  client: SqliteWorkerClient | null;
  db: SqliteDatabase | null;
  initialized: boolean;
  mode: StorageMode;
  initPromise: Promise<SqliteDatabase> | null;
};

const state: DatabaseState = {
  client: null,
  db: null,
  initialized: false,
  mode: 'unknown',
  initPromise: null,
};

function createDatabaseFacade(client: SqliteWorkerClient): SqliteDatabase {
  return {
    async exec(sql: string, params?: unknown[]) {
      await client.request('exec', { sql, bind: params });
    },

    async selectObjects<T>(sql: string, params?: unknown[]) {
      return client.request<T[]>('query', { sql, bind: params });
    },

    async selectValue<T = unknown>(sql: string, params?: unknown[]) {
      return client.request<T | null>('value', { sql, bind: params });
    },

    async close() {
      await client.request('close');
    },
  };
}

function resetState(): void {
  state.client = null;
  state.db = null;
  state.initialized = false;
  state.mode = 'unknown';
  state.initPromise = null;
}

export async function initDatabase(): Promise<SqliteDatabase> {
  if (state.db && state.initialized) {
    return state.db;
  }

  if (!state.initPromise) {
    state.initPromise = (async () => {
      logger.info('Storage', 'Initializing SQLite OPFS worker...');

      const client = createSqliteWorkerClient();
      const db = createDatabaseFacade(client);

      try {
        const initResult = await client.request<InitResult>('init');

        state.client = client;
        state.db = db;
        state.initialized = true;
        state.mode = initResult.mode;

        logger.info(
          'Storage',
          `Database initialized (${initResult.stationCount} stations, local=${initResult.localSeedCount}, world=${initResult.worldSeedCount})`
        );

        return db;
      } catch (error) {
        await client.terminate();
        resetState();
        logger.error('Storage', 'Failed to initialize SQLite OPFS worker', error);
        throw error;
      }
    })();
  }

  return state.initPromise;
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
  if (!state.client || !state.db) {
    resetState();
    return;
  }

  try {
    await state.db.close();
  } finally {
    await state.client.terminate();
    resetState();
    logger.info('Storage', 'Database worker closed');
  }
}

export async function deleteDatabase(): Promise<void> {
  if (!state.client) {
    const client = createSqliteWorkerClient();
    try {
      await client.request('deleteDatabase');
    } finally {
      await client.terminate();
    }
    resetState();
    return;
  }

  try {
    await state.client.request('deleteDatabase');
  } finally {
    await state.client.terminate();
    resetState();
    logger.info('Storage', 'Database deleted from OPFS');
  }
}

export async function vacuumDatabase(): Promise<void> {
  if (!state.client) {
    throw new Error('Database not initialized');
  }

  logger.info('Storage', 'Running VACUUM...');
  await state.client.request('vacuum');
}

export async function checkIntegrity(): Promise<{ ok: boolean; errors: string[] }> {
  if (!state.client) {
    throw new Error('Database not initialized');
  }

  return state.client.request<{ ok: boolean; errors: string[] }>('integrity');
}

export async function analyzeDatabase(): Promise<void> {
  if (!state.client) {
    throw new Error('Database not initialized');
  }

  await state.client.request('analyze');
}

export async function getDatabaseStats(): Promise<{
  sizeBytes: number;
  pageCount: number;
  pageSize: number;
  tables: Array<{ name: string; rowCount: number }>;
}> {
  if (!state.client) {
    throw new Error('Database not initialized');
  }

  return state.client.request('stats');
}
