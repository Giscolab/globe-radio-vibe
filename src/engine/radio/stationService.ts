import { logger } from '../core/logger';
import { initSqliteRepository } from '../storage/sqlite/stationRepository';
import { Station } from '../types/radio';

type CacheEntry = {
  timestamp: number;
  data: Station[];
};

type PaginationOptions = {
  limit?: number;
  offset?: number;
  page?: number;
};

const CACHE_TTL = 5 * 60 * 1000;
const DEFAULT_LIMIT = 100;
const cache = new Map<string, CacheEntry>();

function isCacheValid(key: string): boolean {
  const entry = cache.get(key);
  return Boolean(entry) && Date.now() - entry!.timestamp < CACHE_TTL;
}

function resolvePagination(options?: PaginationOptions): { limit: number; offset: number } {
  const limit = options?.limit ?? DEFAULT_LIMIT;

  if (options?.offset != null) {
    return { limit, offset: Math.max(0, options.offset) };
  }

  if (options?.page != null) {
    const pageIndex = Math.max(1, options.page);
    return { limit, offset: (pageIndex - 1) * limit };
  }

  return { limit, offset: 0 };
}

export async function getByCountry(
  countryCode: string,
  options?: PaginationOptions | boolean,
  forceRefresh = false
): Promise<Station[]> {
  const resolvedOptions = typeof options === 'boolean' ? undefined : options;
  const shouldForceRefresh = typeof options === 'boolean' ? options : forceRefresh;
  const { limit, offset } = resolvePagination(resolvedOptions);
  const key = `country:${countryCode.toUpperCase()}:${limit}:${offset}`;

  if (!shouldForceRefresh && isCacheValid(key)) {
    return cache.get(key)!.data;
  }

  try {
    const repository = await initSqliteRepository();
    const stations = await repository.getByCountry(countryCode, { limit, offset });
    cache.set(key, { timestamp: Date.now(), data: stations });
    return stations;
  } catch (error) {
    logger.error('StationService', `Failed to load country ${countryCode}`, error);
    return [];
  }
}

export async function getAll(options?: PaginationOptions): Promise<Station[]> {
  const { limit, offset } = resolvePagination(options);
  const key = `all:${limit}:${offset}`;

  if (isCacheValid(key)) {
    return cache.get(key)!.data;
  }

  try {
    const repository = await initSqliteRepository();
    const stations = await repository.getAll({ limit, offset });
    cache.set(key, { timestamp: Date.now(), data: stations });
    return stations;
  } catch (error) {
    logger.error('StationService', 'Failed to load stations', error);
    return [];
  }
}

export async function searchStations(
  query: string,
  options?: PaginationOptions
): Promise<Station[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [];
  }

  const { limit, offset } = resolvePagination(options);
  const key = `search:${normalizedQuery.toLowerCase()}:${limit}:${offset}`;

  if (isCacheValid(key)) {
    return cache.get(key)!.data;
  }

  try {
    const repository = await initSqliteRepository();
    const stations = await repository.search(normalizedQuery, { limit, offset });
    cache.set(key, { timestamp: Date.now(), data: stations });
    return stations;
  } catch (error) {
    logger.error('StationService', `Search failed for "${normalizedQuery}"`, error);
    return [];
  }
}

export async function getTopStations(
  limitOrOptions: number | PaginationOptions = DEFAULT_LIMIT
): Promise<Station[]> {
  const options = typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : limitOrOptions;
  const { limit, offset } = resolvePagination(options);
  const key = `top:${limit}:${offset}`;

  if (isCacheValid(key)) {
    return cache.get(key)!.data;
  }

  try {
    const repository = await initSqliteRepository();
    const stations = await repository.getTop({ limit, offset });
    cache.set(key, { timestamp: Date.now(), data: stations });
    return stations;
  } catch (error) {
    logger.error('StationService', 'Failed to load top stations', error);
    return [];
  }
}

export async function onStationPlay(stationId: string): Promise<void> {
  logger.debug('StationService', `Station play: ${stationId}`);
}

export function clearCache(): void {
  cache.clear();
}

export const searchStationsByQuery = searchStations;
export const getStationsByCountry = getByCountry;
