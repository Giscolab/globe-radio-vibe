// Engine - Station Service (orchestration layer)
import { Station } from '../types/radio';
import { logger } from '../core/logger';
import { stationRepository } from './repository/stationRepo';
import { fetchStationsByCountry, searchStations, reportStationClick } from './sources/radiobrowser';

interface CacheEntry {
  timestamp: number;
  data: Station[];
}

const cache: Map<string, CacheEntry> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isCacheValid(key: string): boolean {
  const entry = cache.get(key);
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL;
}

export async function getStationsByCountry(
  countryCode: string,
  forceRefresh: boolean = false
): Promise<Station[]> {
  const cacheKey = `country:${countryCode.toUpperCase()}`;
  
  // Check cache first
  if (!forceRefresh && isCacheValid(cacheKey)) {
    logger.debug('StationService', `Cache hit for ${countryCode}`);
    return cache.get(cacheKey)!.data;
  }
  
  // Check repository
  const repoStations = stationRepository.getByCountry(countryCode);
  if (!forceRefresh && repoStations.length > 0) {
    logger.debug('StationService', `Repository hit for ${countryCode}: ${repoStations.length} stations`);
    return repoStations;
  }
  
  // Fetch from API
  logger.info('StationService', `Fetching stations for ${countryCode} from API`);
  const stations = await fetchStationsByCountry(countryCode);
  
  // Update repository and cache
  if (stations.length > 0) {
    stationRepository.upsertMany(stations);
    cache.set(cacheKey, { timestamp: Date.now(), data: stations });
  }
  
  return stations;
}

export async function searchStationsByQuery(query: string): Promise<Station[]> {
  // First search in repository
  const localResults = stationRepository.search(query);
  if (localResults.length >= 10) {
    return localResults;
  }
  
  // If not enough results, search API
  const apiResults = await searchStations({ name: query, limit: 50 });
  stationRepository.upsertMany(apiResults);
  
  // Merge and dedupe
  const allIds = new Set<string>();
  const merged: Station[] = [];
  
  for (const station of [...localResults, ...apiResults]) {
    if (!allIds.has(station.id)) {
      allIds.add(station.id);
      merged.push(station);
    }
  }
  
  return merged;
}

export async function onStationPlay(stationId: string): Promise<void> {
  // Report click to RadioBrowser (async, non-blocking)
  reportStationClick(stationId).catch(() => {});
}

export function clearCache(): void {
  cache.clear();
  logger.info('StationService', 'Cache cleared');
}
