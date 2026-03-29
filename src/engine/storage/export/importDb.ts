// Engine - Database Import
import { initDatabase, closeDatabase, getStorageMode } from '../sqlite/db';
import { logger } from '../../core/logger';
import { StationSchema, Station } from '../../types/radio';
import { getSqliteRepository } from '../sqlite/stationRepository';

export interface ImportResult {
  success: boolean;
  stationsImported: number;
  favoritesImported: number;
  historyImported: number;
  errors: string[];
}

export async function importDatabase(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    stationsImported: 0,
    favoritesImported: 0,
    historyImported: 0,
    errors: [],
  };

  logger.info('Import', `Starting import from: ${file.name}`);

  try {
    const content = await file.text();
    
    // Detect format
    if (file.name.endsWith('.db') && getStorageMode() === 'opfs') {
      // Binary SQLite file - direct restore to OPFS
      await importBinaryDatabase(file);
      result.success = true;
      logger.info('Import', 'Binary database restored');
      return result;
    }

    // JSON format import
    const lines = content.split('\n').filter(line => !line.startsWith('--') && line.trim());
    
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.table && data.rows) {
          await importTable(data.table, data.rows, result);
        }
      } catch (error) {
        result.errors.push(`Parse error: ${error}`);
      }
    }

    result.success = result.errors.length === 0;
    logger.info('Import', `Import complete: ${result.stationsImported} stations, ${result.favoritesImported} favorites`);
  } catch (error) {
    result.errors.push(`Import failed: ${error}`);
    logger.error('Import', 'Import failed:', error);
  }

  return result;
}

async function importBinaryDatabase(file: File): Promise<void> {
  // Close current database
  await closeDatabase();

  // Write file to OPFS
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle('globe-radio.sqlite3', { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();

  // Reinitialize database
  await initDatabase();
  await initDatabase();

  logger.info('Import', 'Binary database restored to OPFS');
}

async function importTable(
  table: string,
  rows: Record<string, unknown>[],
  result: ImportResult
): Promise<void> {
  const repo = getSqliteRepository();

  switch (table) {
    case 'stations':
      for (const row of rows) {
        try {
          const station = validateStation(row);
          if (station) {
            await repo.upsert(station);
            result.stationsImported++;
          }
        } catch (error) {
          result.errors.push(`Station validation failed: ${error}`);
        }
      }
      break;

    case 'favorites':
      for (const row of rows) {
        if (row.station_id && typeof row.station_id === 'string') {
          await repo.addFavorite(row.station_id);
          result.favoritesImported++;
        }
      }
      break;

    case 'play_history':
      for (const row of rows) {
        if (row.station_id && typeof row.station_id === 'string') {
          await repo.recordPlay(row.station_id, (row.duration_seconds as number) || 0);
          result.historyImported++;
        }
      }
      break;

    case 'settings':
      for (const row of rows) {
        if (row.key && typeof row.key === 'string' && row.value) {
          try {
            const value = JSON.parse(row.value as string);
            await repo.setSetting(row.key, value);
          } catch {
            await repo.setSetting(row.key, row.value);
          }
        }
      }
      break;
  }
}

function validateStation(data: Record<string, unknown>): Station | null {
  try {
    // Map snake_case to camelCase
    const mapped = {
      id: data.id,
      name: data.name,
      url: data.url,
      urlResolved: data.url_resolved,
      homepage: data.homepage,
      favicon: data.favicon,
      country: data.country,
      countryCode: data.country_code,
      state: data.state,
      language: data.language,
      codec: data.codec,
      bitrate: data.bitrate || 0,
      votes: data.votes || 0,
      clickCount: data.click_count || 0,
      clickTrend: data.click_trend || 0,
      geo: data.lat && data.lon ? { lat: data.lat as number, lon: data.lon as number } : undefined,
      tags: data.tags ? String(data.tags).split(',') : [],
      lastCheckOk: data.last_check_ok === 1,
      lastCheckTime: data.last_check_time as string | undefined,
    };

    return StationSchema.parse(mapped);
  } catch (error) {
    logger.warn('Import', 'Station validation failed:', error);
    return null;
  }
}

export function selectImportFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.db,.json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error('No file selected'));
      }
    };

    input.click();
  });
}
