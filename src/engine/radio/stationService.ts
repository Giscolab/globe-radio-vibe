// Engine - Station Service via Edge Function Proxy
import { Station } from "../types/radio";
import { logger } from "../core/logger";

// Cache simple en mémoire
type CacheEntry = {
  timestamp: number;
  data: Station[];
};

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function isCacheValid(key: string): boolean {
  const entry = cache.get(key);
  return !!entry && Date.now() - entry.timestamp < CACHE_TTL;
}

// ----------------------------------
// Validate URL helper
// ----------------------------------
function isValidUrl(url: string | undefined | null): boolean {
  if (!url || url === 'null' || url === 'undefined') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ----------------------------------
// Mapping RadioBrowser → Station
// ----------------------------------
function mapStation(rb: any): Station {
  return {
    id: rb.stationuuid,
    name: rb.name,
    url: rb.url_resolved || rb.url,
    urlResolved: rb.url_resolved || undefined,
    homepage: rb.homepage || undefined,
    favicon: isValidUrl(rb.favicon) ? rb.favicon : undefined,
    country: rb.country || "",
    countryCode: rb.countrycode || "",
    state: rb.state || undefined,
    language: rb.language || undefined,
    tags: rb.tags ? rb.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    bitrate: Number(rb.bitrate) || undefined,
    codec: rb.codec || undefined,
    votes: Number(rb.votes) || 0,
    clickCount: Number(rb.clickcount) || 0,
    clickTrend: Number(rb.clicktrend) || 0,
    lastCheckOk: rb.lastcheckok === 1,
    lastCheckTime: rb.lastchecktime || undefined,
    geo:
      rb.geo_lat != null && rb.geo_long != null
        ? { lat: Number(rb.geo_lat), lon: Number(rb.geo_long) }
        : undefined,
  };
}

// ----------------------------------
// Call Edge Function Proxy
// ----------------------------------
async function callRadioProxy(params: Record<string, string>): Promise<any[]> {
  const searchParams = new URLSearchParams(params);
  
  const projectUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  if (!projectUrl || !anonKey) {
    logger.error("StationService", "Missing Supabase config");
    throw new Error("Missing Supabase configuration");
  }
  
  const url = `${projectUrl}/functions/v1/radio-proxy?${searchParams.toString()}`;
  
  logger.info("StationService", `Calling proxy: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("StationService", `Proxy error: ${response.status} - ${errorText}`);
    throw new Error(`Proxy error: ${response.status}`);
  }

  const result = await response.json();
  
  if (result.error) {
    throw new Error(result.error);
  }
  
  return Array.isArray(result) ? result : [];
}

// ----------------------------------
// GET BY COUNTRY
// ----------------------------------
export async function getStationsByCountry(
  countryCode: string,
  forceRefresh = false
): Promise<Station[]> {
  const key = `country:${countryCode.toUpperCase()}`;

  if (!forceRefresh && isCacheValid(key)) {
    logger.debug("StationService", `Cache hit for ${countryCode}`);
    return cache.get(key)!.data;
  }

  logger.info("StationService", `Fetching stations for ${countryCode}`);

  try {
    const result = await callRadioProxy({
      action: 'bycountry',
      countrycode: countryCode.toUpperCase(),
      limit: '100',
    });

    const stations = result.map(mapStation);
    
    logger.info("StationService", `Got ${stations.length} stations for ${countryCode}`);

    cache.set(key, { timestamp: Date.now(), data: stations });
    return stations;
  } catch (error) {
    logger.error("StationService", `Failed to fetch ${countryCode}: ${error}`);
    return [];
  }
}

// ----------------------------------
// SEARCH
// ----------------------------------
export async function searchStations(query: string): Promise<Station[]> {
  const key = `search:${query}`;

  if (isCacheValid(key)) return cache.get(key)!.data;

  logger.info("StationService", `Searching: ${query}`);

  try {
    const result = await callRadioProxy({
      action: 'search',
      name: query,
      limit: '100',
    });

    const stations = result.map(mapStation);
    cache.set(key, { timestamp: Date.now(), data: stations });

    return stations;
  } catch (error) {
    logger.error("StationService", `Search failed: ${error}`);
    return [];
  }
}

// ----------------------------------
// GET TOP STATIONS
// ----------------------------------
export async function getTopStations(limit = 100): Promise<Station[]> {
  const key = `top:${limit}`;

  if (isCacheValid(key)) return cache.get(key)!.data;

  logger.info("StationService", `Fetching top ${limit} stations`);

  try {
    const result = await callRadioProxy({
      action: 'topclick',
      limit: limit.toString(),
    });

    const stations = result.map(mapStation);
    cache.set(key, { timestamp: Date.now(), data: stations });

    return stations;
  } catch (error) {
    logger.error("StationService", `Failed to fetch top stations: ${error}`);
    return [];
  }
}

// ----------------------------------
// CLICK REPORT (not proxied, silent fail OK)
// ----------------------------------
export async function onStationPlay(stationId: string): Promise<void> {
  // Optional: could proxy this too, but not critical
  logger.debug("StationService", `Station play: ${stationId}`);
}

// ----------------------------------
// CACHE CONTROL
// ----------------------------------
export function clearCache() {
  cache.clear();
  logger.info("StationService", "Cache cleared");
}

// alias compat
export const searchStationsByQuery = searchStations;
