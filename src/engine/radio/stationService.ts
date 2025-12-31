import * as RadioBrowser from "radio-browser";
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
// Mapping RadioBrowser → Station
// ----------------------------------
function mapStation(rb: any): Station {
  return {
    id: rb.stationuuid,
    name: rb.name,
    url: rb.url_resolved || rb.url,
    homepage: rb.homepage || null,
    favicon: rb.favicon || null,
    country: rb.country || "",
    countryCode: rb.countrycode || "",
    state: rb.state || null,
    tags: rb.tags ? rb.tags.split(",").map((t: string) => t.trim()) : [],
    bitrate: Number(rb.bitrate) || 0,
    codec: rb.codec || null,
    votes: Number(rb.votes) || 0,
    geo:
      rb.geo_lat && rb.geo_long
        ? { lat: Number(rb.geo_lat), lon: Number(rb.geo_long) }
        : null,
  };
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
    return cache.get(key)!.data;
  }

  logger.info("StationService", `Fetching stations for ${countryCode}`);

  const result = await RadioBrowser.searchStations({
    countrycode: countryCode,
    limit: 500,
  });

  const stations = result.map(mapStation);

  cache.set(key, { timestamp: Date.now(), data: stations });
  return stations;
}

// ----------------------------------
// SEARCH
// ----------------------------------
export async function searchStations(query: string): Promise<Station[]> {
  const key = `search:${query}`;

  if (isCacheValid(key)) return cache.get(key)!.data;

  const result = await RadioBrowser.searchStations({
    searchterm: query,
    limit: 100,
  });

  const stations = result.map(mapStation);
  cache.set(key, { timestamp: Date.now(), data: stations });

  return stations;
}

// ----------------------------------
// CLICK REPORT
// ----------------------------------
export async function onStationPlay(stationId: string): Promise<void> {
  try {
    await RadioBrowser.clickStation(stationId);
  } catch {
    // ignore
  }
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
