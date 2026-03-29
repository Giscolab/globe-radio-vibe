import { Station } from '../../types/radio';
import { logger } from '../../core/logger';
import { getDatabase, initDatabase, type SqliteDatabase } from './db';

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

interface FavoriteRow extends StationRow {
  added_at: string;
}

interface PlayHistoryRow extends StationRow {
  played_at: string;
  duration_seconds: number;
}

interface AISignalRow {
  id: number;
  station_id: string;
  type: string;
  duration_seconds: number | null;
  details: string | null;
  created_at: string;
}

interface SettingRow {
  key: string;
  value: string;
}

type QueryOptions = {
  limit?: number;
  offset?: number;
};

export interface PlayHistoryRecord {
  station: Station;
  playedAt: string;
  durationSeconds: number;
}

export type AISignalType = 'play' | 'skip' | 'favorite_add' | 'favorite_remove' | 'error';

export interface AISignalRecord {
  id: number;
  stationId: string;
  type: AISignalType;
  durationSeconds: number;
  details: string | null;
  createdAt: string;
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
    countryCode: row.country_code || undefined,
    state: row.state || undefined,
    language: row.language || undefined,
    codec: row.codec || undefined,
    bitrate: row.bitrate,
    votes: row.votes,
    clickCount: row.click_count,
    clickTrend: row.click_trend,
    geo:
      row.lat !== null && row.lon !== null
        ? {
            lat: row.lat,
            lon: row.lon,
          }
        : undefined,
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
    station.countryCode?.toUpperCase() || '',
    station.state || null,
    station.language || null,
    null,
    station.codec || null,
    station.bitrate || 0,
    station.votes || 0,
    station.clickCount || 0,
    station.clickTrend || 0,
    station.geo?.lat || null,
    station.geo?.lon || null,
    station.tags?.join(',') || null,
    station.lastCheckOk === false ? 0 : 1,
    station.lastCheckTime || null,
  ];
}

function normalizeQueryOptions(options?: QueryOptions): { limit: number; offset: number } {
  const limit = Math.max(1, options?.limit ?? 100);
  const offset = Math.max(0, options?.offset ?? 0);
  return { limit, offset };
}

function buildPaginationClause(options?: QueryOptions): { clause: string; params: unknown[] } {
  if (!options || options.limit == null) {
    if (options?.offset) {
      return {
        clause: ' LIMIT -1 OFFSET ?',
        params: [Math.max(0, options.offset)],
      };
    }

    return { clause: '', params: [] };
  }

  const { limit, offset } = normalizeQueryOptions(options);
  return {
    clause: ' LIMIT ? OFFSET ?',
    params: [limit, offset],
  };
}

export class SqliteStationRepository {
  private db: SqliteDatabase | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private stationCache = new Map<string, Station>();
  private favorites = new Map<string, string>();
  private playHistory: PlayHistoryRecord[] = [];
  private aiSignals: AISignalRecord[] = [];
  private settings = new Map<string, unknown>();

  async initialize(): Promise<void> {
    if (this.db) {
      return;
    }

    await initDatabase();
    this.db = getDatabase();
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.hydrateLocalState();
  }

  private async getDb(): Promise<SqliteDatabase> {
    if (!this.db) {
      await this.initialize();
    }

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return this.db;
  }

  private cacheStations(stations: Station[]): void {
    for (const station of stations) {
      this.stationCache.set(station.id, station);
    }
  }

  private async queryStations(sql: string, params?: unknown[]): Promise<Station[]> {
    const db = await this.getDb();
    const rows = await db.selectObjects<StationRow>(sql, params);
    const stations = rows.map(rowToStation);
    this.cacheStations(stations);
    return stations;
  }

  private queueWrite(task: () => Promise<void>): Promise<void> {
    const queued = this.writeQueue.then(task, task);
    this.writeQueue = queued.catch((error) => {
      logger.error('SqliteRepo', 'Write failed', error);
    });
    return queued;
  }

  private async hydrateLocalState(): Promise<void> {
    const db = await this.getDb();

    const favoriteRows = await db.selectObjects<FavoriteRow>(
      `SELECT s.*, f.added_at
       FROM favorites f
       INNER JOIN stations s ON s.id = f.station_id
       ORDER BY f.added_at DESC`
    );
    this.stationCache.clear();
    this.favorites.clear();

    for (const row of favoriteRows) {
      const station = rowToStation(row);
      this.stationCache.set(station.id, station);
      this.favorites.set(station.id, row.added_at);
    }

    const historyRows = await db.selectObjects<PlayHistoryRow>(
      `SELECT s.*, h.played_at, h.duration_seconds
       FROM play_history h
       INNER JOIN stations s ON s.id = h.station_id
       ORDER BY h.played_at DESC`
    );
    this.playHistory = historyRows.map((row) => {
      const station = rowToStation(row);
      this.stationCache.set(station.id, station);
      return {
        station,
        playedAt: row.played_at,
        durationSeconds: row.duration_seconds || 0,
      };
    });

    const signalRows = await db.selectObjects<AISignalRow>(
      `SELECT id, station_id, type, duration_seconds, details, created_at
       FROM ai_signals
       ORDER BY created_at DESC
       LIMIT 500`
    );
    this.aiSignals = signalRows.map((row) => ({
      id: row.id,
      stationId: row.station_id,
      type: row.type as AISignalType,
      durationSeconds: row.duration_seconds ?? 0,
      details: row.details ?? null,
      createdAt: row.created_at,
    }));

    const settingRows = await db.selectObjects<SettingRow>('SELECT key, value FROM settings');
    this.settings.clear();
    for (const row of settingRows) {
      try {
        this.settings.set(row.key, JSON.parse(row.value));
      } catch {
        this.settings.set(row.key, row.value);
      }
    }
  }

  async getAll(options?: QueryOptions): Promise<Station[]> {
    const pagination = buildPaginationClause(options);
    return this.queryStations(
      `SELECT * FROM stations
       ORDER BY click_count DESC, votes DESC, name ASC
       ${pagination.clause}`,
      pagination.params
    );
  }

  async getById(id: string): Promise<Station | undefined> {
    if (this.stationCache.has(id)) {
      return this.stationCache.get(id);
    }

    const rows = await this.queryStations('SELECT * FROM stations WHERE id = ? LIMIT 1', [id]);
    return rows[0];
  }

  async getByCountry(countryCode: string, options?: QueryOptions): Promise<Station[]> {
    const pagination = buildPaginationClause(options);
    return this.queryStations(
      `SELECT * FROM stations
       WHERE country_code = ?
       ORDER BY click_count DESC, votes DESC, name ASC
       ${pagination.clause}`,
      [countryCode.toUpperCase(), ...pagination.params]
    );
  }

  async search(query: string, options?: QueryOptions): Promise<Station[]> {
    const pagination = buildPaginationClause(options ?? { limit: 100, offset: 0 });
    const pattern = `%${query}%`;
    return this.queryStations(
      `SELECT * FROM stations
       WHERE name LIKE ? OR country LIKE ? OR tags LIKE ? OR language LIKE ?
       ORDER BY click_count DESC, votes DESC, name ASC
       ${pagination.clause}`,
      [pattern, pattern, pattern, pattern, ...pagination.params]
    );
  }

  async getTop(options?: QueryOptions): Promise<Station[]> {
    return this.getAll(options);
  }

  async upsert(station: Station): Promise<void> {
    this.stationCache.set(station.id, station);

    await this.queueWrite(async () => {
      const db = await this.getDb();
      await db.exec(
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
        stationToParams(station)
      );
    });
  }

  async upsertMany(stations: Station[]): Promise<void> {
    this.cacheStations(stations);

    await this.queueWrite(async () => {
      const db = await this.getDb();
      await db.exec('BEGIN');

      try {
        for (const station of stations) {
          await db.exec(
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
            stationToParams(station)
          );
        }

        await db.exec('COMMIT');
      } catch (error) {
        await db.exec('ROLLBACK');
        throw error;
      }
    });

    logger.info('SqliteRepo', `Upserted ${stations.length} stations`);
  }

  async insertMany(stations: Station[]): Promise<void> {
    await this.upsertMany(stations);
  }

  async syncStations(stations: Station[]): Promise<void> {
    await this.upsertMany(stations);
  }

  async delete(id: string): Promise<boolean> {
    this.stationCache.delete(id);
    this.favorites.delete(id);
    this.playHistory = this.playHistory.filter((row) => row.station.id !== id);
    this.aiSignals = this.aiSignals.filter((row) => row.stationId !== id);

    await this.queueWrite(async () => {
      const db = await this.getDb();
      await db.exec('DELETE FROM stations WHERE id = ?', [id]);
    });

    return true;
  }

  async clear(): Promise<void> {
    this.stationCache.clear();
    this.favorites.clear();
    this.playHistory = [];
    this.aiSignals = [];

    await this.queueWrite(async () => {
      const db = await this.getDb();
      await db.exec('DELETE FROM stations');
    });

    logger.info('SqliteRepo', 'All stations cleared');
  }

  async count(): Promise<number> {
    const db = await this.getDb();
    return Number((await db.selectValue<number>('SELECT COUNT(*) FROM stations')) ?? 0);
  }

  async addFavorite(stationId: string): Promise<void> {
    const addedAt = new Date().toISOString();
    this.favorites.set(stationId, addedAt);

    await this.queueWrite(async () => {
      const db = await this.getDb();
      await db.exec('INSERT OR IGNORE INTO favorites (station_id) VALUES (?)', [stationId]);
    });
  }

  async removeFavorite(stationId: string): Promise<void> {
    this.favorites.delete(stationId);

    await this.queueWrite(async () => {
      const db = await this.getDb();
      await db.exec('DELETE FROM favorites WHERE station_id = ?', [stationId]);
    });
  }

  getFavorites(): Station[] {
    return [...this.favorites.entries()]
      .sort((left, right) => right[1].localeCompare(left[1]))
      .map(([stationId]) => this.stationCache.get(stationId))
      .filter((station): station is Station => Boolean(station));
  }

  isFavorite(stationId: string): boolean {
    return this.favorites.has(stationId);
  }

  async recordPlay(stationId: string, durationSeconds = 0): Promise<void> {
    const station = this.stationCache.get(stationId);
    if (station) {
      this.playHistory.unshift({
        station,
        playedAt: new Date().toISOString(),
        durationSeconds,
      });
      this.playHistory = this.playHistory.slice(0, 500);
    }

    await this.queueWrite(async () => {
      const db = await this.getDb();
      await db.exec(
        'INSERT INTO play_history (station_id, duration_seconds) VALUES (?, ?)',
        [stationId, durationSeconds]
      );
    });
  }

  getPlayHistory(limit = 100): PlayHistoryRecord[] {
    return this.playHistory.slice(0, limit);
  }

  async clearHistory(): Promise<void> {
    this.playHistory = [];

    await this.queueWrite(async () => {
      const db = await this.getDb();
      await db.exec('DELETE FROM play_history');
    });
  }

  async recordSignal(
    type: AISignalType,
    stationId: string,
    options?: { durationSeconds?: number; details?: string }
  ): Promise<void> {
    const signal: AISignalRecord = {
      id: Date.now(),
      stationId,
      type,
      durationSeconds: options?.durationSeconds ?? 0,
      details: options?.details ?? null,
      createdAt: new Date().toISOString(),
    };

    this.aiSignals.unshift(signal);
    this.aiSignals = this.aiSignals.slice(0, 500);

    await this.queueWrite(async () => {
      const db = await this.getDb();
      await db.exec(
        `INSERT INTO ai_signals (station_id, type, duration_seconds, details)
         VALUES (?, ?, ?, ?)`,
        [stationId, type, options?.durationSeconds ?? 0, options?.details ?? null]
      );
    });
  }

  getSignals(limit = 200, types?: AISignalType[]): AISignalRecord[] {
    const filtered = types?.length
      ? this.aiSignals.filter((signal) => types.includes(signal.type))
      : this.aiSignals;

    return filtered.slice(0, limit);
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    this.settings.set(key, value);

    await this.queueWrite(async () => {
      const db = await this.getDb();
      await db.exec(
        `INSERT OR REPLACE INTO settings (key, value, updated_at)
         VALUES (?, ?, datetime('now'))`,
        [key, JSON.stringify(value)]
      );
    });
  }

  getSetting<T>(key: string, defaultValue: T): T {
    if (!this.settings.has(key)) {
      return defaultValue;
    }

    return this.settings.get(key) as T;
  }

  async awaitPendingWrites(): Promise<void> {
    await this.writeQueue;
  }
}

let sqliteRepo: SqliteStationRepository | null = null;
let initializing: Promise<SqliteStationRepository> | null = null;

export async function initSqliteRepository(): Promise<SqliteStationRepository> {
  if (sqliteRepo) {
    return sqliteRepo;
  }

  if (!initializing) {
    initializing = (async () => {
      const repository = new SqliteStationRepository();
      await repository.initialize();
      return repository;
    })();
  }

  sqliteRepo = await initializing;
  return sqliteRepo;
}

export function getSqliteRepository(): SqliteStationRepository {
  if (!sqliteRepo) {
    throw new Error('SQLite repository not initialized. Call initSqliteRepository() first.');
  }

  return sqliteRepo;
}
