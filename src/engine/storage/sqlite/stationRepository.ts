// Engine - SQLite Station Repository
import { Station } from '../../types/radio';
import { IStationRepository } from '../../radio/repository/stationRepo';
import { SqliteDatabase, getDatabase } from './db';
import { logger } from '../../core/logger';

interface StationRow {
  id: string;
  name: string;
  url: string;
  url_resolved: string | null;
  homepage: string | null;
  favicon: string | null;
  country: string;
  country_code: string;
  state: string | null;
  language: string | null;
  language_codes: string | null;
  codec: string | null;
  bitrate: number;
  votes: number;
  click_count: number;
  click_trend: number;
  lat: number | null;
  lon: number | null;
  tags: string | null;
  last_check_ok: number;
  last_check_time: string | null;
}

interface PlayHistoryRow extends StationRow {
  played_at: string;
  duration_seconds: number;
}

export interface PlayHistoryRecord {
  station: Station;
  playedAt: string;
  durationSeconds: number;
}

function rowToStation(row: StationRow): Station {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    urlResolved: row.url_resolved || undefined,
    homepage: row.homepage || undefined,
    favicon: row.favicon || undefined,
    country: row.country,
    countryCode: row.country_code,
    state: row.state || undefined,
    language: row.language || undefined,
    codec: row.codec || undefined,
    bitrate: row.bitrate,
    votes: row.votes,
    clickCount: row.click_count,
    clickTrend: row.click_trend,
    geo: row.lat && row.lon ? { lat: row.lat, lon: row.lon } : undefined,
    tags: row.tags?.split(',').filter(Boolean) || [],
    lastCheckOk: row.last_check_ok === 1,
    lastCheckTime: row.last_check_time || undefined,
  };
}

function stationToParams(station: Station): unknown[] {
  return [
    station.id,
    station.name,
    station.url,
    station.urlResolved || null,
    station.homepage || null,
    station.favicon || null,
    station.country,
    station.countryCode,
    station.state || null,
    station.language || null,
    null, // language_codes - not in schema
    station.codec || null,
    station.bitrate || 0,
    station.votes || 0,
    station.clickCount || 0,
    station.clickTrend || 0,
    station.geo?.lat || null,
    station.geo?.lon || null,
    station.tags?.join(',') || null,
    station.lastCheckOk ? 1 : 0,
    station.lastCheckTime || null,
  ];
}

export class SqliteStationRepository implements IStationRepository {
  private db: SqliteDatabase | null = null;

  private getDb(): SqliteDatabase {
    if (!this.db) {
      this.db = getDatabase();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  getAll(): Station[] {
    const rows = this.getDb().selectObjects<StationRow>('SELECT * FROM stations');
    return rows.map(rowToStation);
  }

  getById(id: string): Station | undefined {
    const rows = this.getDb().selectObjects<StationRow>(
      'SELECT * FROM stations WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? rowToStation(rows[0]) : undefined;
  }

  getByCountry(countryCode: string): Station[] {
    const code = countryCode.toUpperCase();
    const rows = this.getDb().selectObjects<StationRow>(
      'SELECT * FROM stations WHERE country_code = ? ORDER BY votes DESC',
      [code]
    );
    return rows.map(rowToStation);
  }

  search(query: string): Station[] {
    const pattern = `%${query}%`;
    const rows = this.getDb().selectObjects<StationRow>(
      `SELECT * FROM stations 
       WHERE name LIKE ? OR country LIKE ? OR tags LIKE ?
       ORDER BY votes DESC LIMIT 100`,
      [pattern, pattern, pattern]
    );
    return rows.map(rowToStation);
  }

  upsert(station: Station): void {
    const params = stationToParams(station);
    this.getDb().exec(
      `INSERT OR REPLACE INTO stations (
        id, name, url, url_resolved, homepage, favicon,
        country, country_code, state, language, language_codes,
        codec, bitrate, votes, click_count, click_trend,
        lat, lon, tags, last_check_ok, last_check_time, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      params
    );
  }

  upsertMany(stations: Station[]): void {
    const db = this.getDb();
    db.exec('BEGIN TRANSACTION');
    try {
      for (const station of stations) {
        this.upsert(station);
      }
      db.exec('COMMIT');
      logger.info('SqliteRepo', `Upserted ${stations.length} stations`);
    } catch (error) {
      db.exec('ROLLBACK');
      logger.error('SqliteRepo', 'Batch upsert failed:', error);
      throw error;
    }
  }

  delete(id: string): boolean {
    this.getDb().exec('DELETE FROM stations WHERE id = ?', [id]);
    return this.getDb().changes() > 0;
  }

  clear(): void {
    this.getDb().exec('DELETE FROM stations');
    logger.info('SqliteRepo', 'All stations cleared');
  }

  count(): number {
    const count = this.getDb().selectValue('SELECT COUNT(*) FROM stations');
    return (count as number) || 0;
  }

  // Favorites methods
  addFavorite(stationId: string): void {
    this.getDb().exec(
      'INSERT OR IGNORE INTO favorites (station_id) VALUES (?)',
      [stationId]
    );
  }

  removeFavorite(stationId: string): void {
    this.getDb().exec('DELETE FROM favorites WHERE station_id = ?', [stationId]);
  }

  getFavorites(): Station[] {
    const rows = this.getDb().selectObjects<StationRow>(
      `SELECT s.* FROM stations s
       INNER JOIN favorites f ON s.id = f.station_id
       ORDER BY f.added_at DESC`
    );
    return rows.map(rowToStation);
  }

  isFavorite(stationId: string): boolean {
    const count = this.getDb().selectValue(
      'SELECT COUNT(*) FROM favorites WHERE station_id = ?',
      [stationId]
    );
    return (count as number) > 0;
  }

  // Play history methods
  recordPlay(stationId: string, durationSeconds: number = 0): void {
    this.getDb().exec(
      'INSERT INTO play_history (station_id, duration_seconds) VALUES (?, ?)',
      [stationId, durationSeconds]
    );
  }

  getPlayHistory(limit: number = 100): PlayHistoryRecord[] {
    const rows = this.getDb().selectObjects<PlayHistoryRow>(
      `SELECT s.*, h.played_at, h.duration_seconds FROM stations s
       INNER JOIN play_history h ON s.id = h.station_id
       ORDER BY h.played_at DESC LIMIT ?`,
      [limit]
    );
    return rows.map((row) => ({
      station: rowToStation(row),
      playedAt: row.played_at,
      durationSeconds: row.duration_seconds || 0,
    }));
  }

  clearHistory(): void {
    this.getDb().exec('DELETE FROM play_history');
  }

  // Settings methods
  setSetting(key: string, value: unknown): void {
    const jsonValue = JSON.stringify(value);
    this.getDb().exec(
      `INSERT OR REPLACE INTO settings (key, value, updated_at) 
       VALUES (?, ?, datetime('now'))`,
      [key, jsonValue]
    );
  }

  getSetting<T>(key: string, defaultValue: T): T {
    const value = this.getDb().selectValue(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    );
    if (value === null || value === undefined) {
      return defaultValue;
    }
    try {
      return JSON.parse(value as string) as T;
    } catch {
      return defaultValue;
    }
  }
}

// Singleton instance
let sqliteRepo: SqliteStationRepository | null = null;

export function getSqliteRepository(): SqliteStationRepository {
  if (!sqliteRepo) {
    sqliteRepo = new SqliteStationRepository();
  }
  return sqliteRepo;
}
