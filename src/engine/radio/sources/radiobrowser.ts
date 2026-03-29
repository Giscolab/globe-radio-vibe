// Engine - RadioBrowser API Source
import { Station, RadioBrowserStationSchema, StationSchema } from '../../types/radio';
import { logger } from '../../core/logger';
import { radioBrowserThrottler } from '../../core/throttle';
import { canUpgradeToHttps, upgradeToHttps as upgradeUrlToHttps } from '../utils/httpsUpgrade';
import { z } from 'zod';

const RADIOBROWSER_SERVERS = [
  'de1.api.radio-browser.info',
  'nl1.api.radio-browser.info',
  'at1.api.radio-browser.info',
];

let currentServerIndex = 0;

function getNextServer(): string {
  const server = RADIOBROWSER_SERVERS[currentServerIndex];
  currentServerIndex = (currentServerIndex + 1) % RADIOBROWSER_SERVERS.length;
  return server;
}

function isValidUrl(url: string | undefined | null): boolean {
  if (!url) return false;

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function sanitizeOptionalUrl(url: string | undefined | null): string | undefined {
  if (!isValidUrl(url)) {
    return undefined;
  }

  return url ?? undefined;
}

function normalizeTimestamp(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const withTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const timestamp = Date.parse(withTimezone);

  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return new Date(timestamp).toISOString();
}

/**
 * Upgrade HTTP URL to HTTPS if possible
 * Uses the comprehensive httpsUpgrade utility
 */
function upgradeToHttps(url: string): string {
  if (!url) return url;
  
  // Already HTTPS
  if (url.startsWith('https://')) return url;
  
  // Check if domain supports HTTPS and upgrade
  if (canUpgradeToHttps(url)) {
    return upgradeUrlToHttps(url);
  }
  
  return url;
}

function normalizeStation(raw: z.infer<typeof RadioBrowserStationSchema>): Station {
  const tags = raw.tags ? raw.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  
  // Prefer urlResolved (direct stream), upgrade to HTTPS when possible
  const rawUrl = raw.url_resolved || raw.url;
  const upgradedUrl = upgradeToHttps(rawUrl);

  const favicon = sanitizeOptionalUrl(raw.favicon ? upgradeToHttps(raw.favicon) : undefined);
  const homepage = sanitizeOptionalUrl(raw.homepage);
  const urlResolved = sanitizeOptionalUrl(raw.url_resolved ? upgradeToHttps(raw.url_resolved) : undefined);
  
  return {
    id: raw.stationuuid,
    name: raw.name,
    url: upgradedUrl,
    urlResolved,
    homepage,
    favicon,
    country: raw.country,
    countryCode: raw.countrycode || undefined,
    state: raw.state || undefined,
    language: raw.language || undefined,
    tags,
    bitrate: raw.bitrate || undefined,
    codec: raw.codec || undefined,
    votes: raw.votes || 0,
    clickCount: raw.clickcount || 0,
    clickTrend: raw.clicktrend || 0,
    lastCheckOk: raw.lastcheckok === 1,
    lastCheckTime: normalizeTimestamp(raw.lastchecktime),
    geo: raw.geo_lat != null && raw.geo_long != null
      ? { lat: raw.geo_lat, lon: raw.geo_long }
      : undefined,
  };
}

export function dedupeStations(stations: Station[]): Station[] {
  const unique = new Map<string, Station>();

  for (const station of stations) {
    if (!station.id) {
      continue;
    }

    const previous = unique.get(station.id);
    if (!previous) {
      unique.set(station.id, station);
      continue;
    }

    const previousPopularity = (previous.clickCount ?? 0) + (previous.votes ?? 0);
    const nextPopularity = (station.clickCount ?? 0) + (station.votes ?? 0);
    if (nextPopularity >= previousPopularity) {
      unique.set(station.id, station);
    }
  }

  return Array.from(unique.values()).sort((left, right) => left.id.localeCompare(right.id));
}

export interface RadioBrowserSearchParams {
  countrycode?: string;
  name?: string;
  tag?: string;
  limit?: number;
  offset?: number;
  order?: 'clickcount' | 'votes' | 'name' | 'clicktrend';
  reverse?: boolean;
  hidebroken?: boolean;
}

async function fetchWithRetry<T>(
  endpoint: string,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const server = getNextServer();
    const url = `https://${server}${endpoint}`;
    
    try {
      logger.debug('RadioBrowser', `Fetching ${url}`);
      
      // Use throttler to respect rate limits
      const response = await radioBrowserThrottler.throttle(() =>
        fetch(url, {
          headers: {
            'User-Agent': 'GlobeRadioEngine/1.0',
          },
        })
      );
      
      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        logger.warn('RadioBrowser', `Rate limited, waiting ${retryAfter}s`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json() as T;
    } catch (error) {
      lastError = error as Error;
      logger.warn('RadioBrowser', `Attempt ${attempt + 1} failed: ${lastError.message}`);
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}

export async function fetchStationsByCountry(
  countryCode: string,
  limit: number = 100
): Promise<Station[]> {
  const endpoint = `/json/stations/bycountrycode/${countryCode.toUpperCase()}?limit=${limit}&hidebroken=true&order=clickcount&reverse=true`;
  
  try {
    const raw = await fetchWithRetry<unknown[]>(endpoint);
    const stations: Station[] = [];
    
    for (const item of raw) {
      try {
        const parsed = RadioBrowserStationSchema.parse(item);
        const station = normalizeStation(parsed);
        const validated = StationSchema.safeParse(station);
        if (validated.success) {
          stations.push(validated.data);
        }
      } catch (e) {
        // Skip invalid stations
        logger.debug('RadioBrowser', `Skipping invalid station: ${e}`);
      }
    }
    
    const deduped = dedupeStations(stations);
    logger.info('RadioBrowser', `Fetched ${deduped.length} stations for ${countryCode}`);
    return deduped;
  } catch (error) {
    logger.error('RadioBrowser', `Failed to fetch stations for ${countryCode}: ${error}`);
    return [];
  }
}

export async function searchStations(
  params: RadioBrowserSearchParams
): Promise<Station[]> {
  const queryParams = new URLSearchParams();
  
  if (params.countrycode) queryParams.set('countrycode', params.countrycode);
  if (params.name) queryParams.set('name', params.name);
  if (params.tag) queryParams.set('tag', params.tag);
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.offset) queryParams.set('offset', params.offset.toString());
  if (params.order) queryParams.set('order', params.order);
  if (params.reverse) queryParams.set('reverse', 'true');
  if (params.hidebroken !== false) queryParams.set('hidebroken', 'true');
  
  const endpoint = `/json/stations/search?${queryParams.toString()}`;
  
  try {
    const raw = await fetchWithRetry<unknown[]>(endpoint);
    const stations: Station[] = [];
    
    for (const item of raw) {
      try {
        const parsed = RadioBrowserStationSchema.parse(item);
        const station = normalizeStation(parsed);
        const validated = StationSchema.safeParse(station);
        if (validated.success) {
          stations.push(validated.data);
        }
      } catch (e) {
        logger.debug('RadioBrowser', `Skipping invalid station: ${e}`);
      }
    }
    
    const deduped = dedupeStations(stations);
    logger.info('RadioBrowser', `Search returned ${deduped.length} stations`);
    return deduped;
  } catch (error) {
    logger.error('RadioBrowser', `Search failed: ${error}`);
    return [];
  }
}

export async function fetchAllStations(options?: {
  pageSize?: number;
  hidebroken?: boolean;
  maxOffset?: number;
}): Promise<Station[]> {
  const pageSize = options?.pageSize ?? 10000;
  const hidebroken = options?.hidebroken ?? true;
  const maxOffset = options?.maxOffset ?? 5_000_000;
  const stations: Station[] = [];

  let offset = 0;

  for (;;) {
    const params = new URLSearchParams({
      hidebroken: hidebroken ? 'true' : 'false',
      order: 'stationuuid',
      reverse: 'false',
      limit: pageSize.toString(),
      offset: offset.toString(),
    });

    const endpoint = `/json/stations?${params.toString()}`;

    try {
      const raw = await fetchWithRetry<unknown[]>(endpoint);
      if (!Array.isArray(raw) || raw.length === 0) break;

      for (const item of raw) {
        try {
          const parsed = RadioBrowserStationSchema.parse(item);
          const station = normalizeStation(parsed);
          const validated = StationSchema.safeParse(station);
          if (validated.success) {
            stations.push(validated.data);
          }
        } catch (e) {
          logger.debug('RadioBrowser', `Skipping invalid station: ${e}`);
        }
      }

      logger.info('RadioBrowser', `Fetched ${stations.length} stations (offset ${offset})`);
      offset += pageSize;

      if (offset > maxOffset) {
        logger.warn('RadioBrowser', 'Offset limit reached, stopping fetch');
        break;
      }
    } catch (error) {
      logger.error('RadioBrowser', `Failed to fetch stations batch: ${error}`);
      break;
    }
  }

  const deduped = dedupeStations(stations);
  logger.info('RadioBrowser', `Total stations fetched: ${deduped.length}`);
  return deduped;
}

export async function getStationById(id: string): Promise<Station | null> {
  const endpoint = `/json/stations/byuuid/${id}`;
  
  try {
    const raw = await fetchWithRetry<unknown[]>(endpoint);
    if (raw.length === 0) return null;
    
    const parsed = RadioBrowserStationSchema.parse(raw[0]);
    const station = normalizeStation(parsed);
    const validated = StationSchema.parse(station);
    return validated;
  } catch (error) {
    logger.error('RadioBrowser', `Failed to fetch station ${id}: ${error}`);
    return null;
  }
}

// Report station click to RadioBrowser (helps ranking)
export async function reportStationClick(id: string): Promise<void> {
  const endpoint = `/json/url/${id}`;
  try {
    await fetchWithRetry<unknown>(endpoint);
    logger.debug('RadioBrowser', `Reported click for station ${id}`);
  } catch (error) {
    logger.warn('RadioBrowser', `Failed to report click: ${error}`);
  }
}
