// Engine - Storage Module Exports
export {
  initDatabase,
  getDatabase,
  getStorageMode,
  isInitialized,
  closeDatabase,
  deleteDatabase,
  vacuumDatabase,
  checkIntegrity,
  analyzeDatabase,
  getDatabaseStats,
  type SqliteDatabase,
  type StorageMode,
} from './sqlite/db';

export {
  SqliteStationRepository,
  getSqliteRepository,
} from './sqlite/stationRepository';

export {
  exportDatabase,
  downloadDatabase,
  exportAndDownload,
  type ExportOptions,
} from './export/exportDb';

export {
  importDatabase,
  selectImportFile,
  type ImportResult,
} from './export/importDb';

// Storage initialization helper
import { initDatabase } from './sqlite/db';
import { logger } from '../core/logger';

let storageReady = false;

export async function initStorage(): Promise<void> {
  if (storageReady) return;

  try {
    logger.info('Storage', 'Initializing storage...');
    await initDatabase();
    storageReady = true;
    logger.info('Storage', 'Storage initialized successfully');
  } catch (error) {
    logger.error('Storage', 'Storage initialization failed:', error);
    throw error;
  }
}

export function isStorageReady(): boolean {
  return storageReady;
}
