// Engine - Database Export
import { getDatabase, getStorageMode } from '../sqlite/db';
import { logger } from '../../core/logger';

export interface ExportOptions {
  filename?: string;
  includeHistory?: boolean;
}

export async function exportDatabase(options: ExportOptions = {}): Promise<Blob> {
  const { filename = 'globe-radio-backup.db' } = options;
  const db = getDatabase();
  
  if (!db) {
    throw new Error('Database not initialized');
  }

  logger.info('Export', 'Starting database export...');

  // For OPFS mode, we need to read the file directly
  if (getStorageMode() === 'opfs') {
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle('globe-radio.sqlite3');
      const file = await fileHandle.getFile();
      const blob = new Blob([await file.arrayBuffer()], { type: 'application/x-sqlite3' });
      logger.info('Export', `Database exported: ${blob.size} bytes`);
      return blob;
    } catch (error) {
      logger.error('Export', 'OPFS export failed:', error);
      throw error;
    }
  }

  // For in-memory mode, export via SQL dump
  // This is a simplified export - full binary export would need sqlite3_serialize
  const tables = ['stations', 'favorites', 'play_history', 'settings', 'schema_version'];
  const dump: string[] = [];

  for (const table of tables) {
    try {
      const rows = db.selectObjects<Record<string, unknown>>(`SELECT * FROM ${table}`);
      if (rows.length > 0) {
        dump.push(`-- Table: ${table}`);
        dump.push(`-- Rows: ${rows.length}`);
        dump.push(JSON.stringify({ table, rows }));
      }
    } catch (error) {
      logger.warn('Export', `Could not export table ${table}:`, error);
    }
  }

  const content = dump.join('\n');
  const blob = new Blob([content], { type: 'application/json' });
  logger.info('Export', `Database exported (JSON mode): ${blob.size} bytes`);
  return blob;
}

export function downloadDatabase(blob: Blob, filename: string = 'globe-radio-backup.db'): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  logger.info('Export', `Download initiated: ${filename}`);
}

export async function exportAndDownload(options: ExportOptions = {}): Promise<void> {
  const { filename = 'globe-radio-backup.db' } = options;
  const blob = await exportDatabase(options);
  downloadDatabase(blob, filename);
}
