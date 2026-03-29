import { isSupabaseConfigured } from "../../integrations/supabase/client";
import { logger } from "../core/logger";
import { initSqliteRepository } from "../storage/sqlite/stationRepository";
import { Station, type RadioBrowserStation } from "../types/radio";

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
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const cache = new Map<string, CacheEntry>();
let hasLoggedProxyFallback = false;

function isCacheValid(key: string): boolean {
  const entry = cache.get(key);
  return !!entry && Date.now() - entry.timestamp < CACHE_TTL;
}

function isValidUrl(url: string | undefined | null): boolean {
  if (!url || url === "null" || url === "undefined") return false;

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function sanitizeUrl(url: string | undefined | null): string | undefined {
  if (!isValidUrl(url)) return undefined;
  if (url.startsWith("http://")) {
    return url.replace("http://", "https://");
  }
  return url;
}

function mapStation(rb: RadioBrowserStation): Station {
  return {
    id: rb.stationuuid,
    name: rb.name,
    url: rb.url_resolved || rb.url,
    urlResolved: rb.url_resolved || undefined,
    homepage: rb.homepage || undefined,
    favicon: sanitizeUrl(rb.favicon),
    country: rb.country || "",
    countryCode: rb.countrycode || "",
    state: rb.state || undefined,
    language: rb.language || undefined,
    tags: rb.tags ? rb.tags.split(",").map((tag: string) => tag.trim()).filter(Boolean) : [],
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

function isRadioBrowserStation(value: unknown): value is RadioBrowserStation {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.stationuuid === "string" &&
    typeof record.name === "string" &&
    typeof record.url === "string"
  );
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

function logProxyFallbackOnce(): void {
  if (hasLoggedProxyFallback) return;
  hasLoggedProxyFallback = true;
  logger.info("StationService", "Supabase proxy unavailable; using local SQLite data.");
}

async function callRadioProxy(params: Record<string, string>): Promise<RadioBrowserStation[] | null> {
  if (!isSupabaseConfigured || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    logProxyFallbackOnce();
    return null;
  }

  const searchParams = new URLSearchParams(params);
  const url = `${SUPABASE_URL}/functions/v1/radio-proxy?${searchParams.toString()}`;

  logger.debug("StationService", `Calling proxy: ${url}`);

  try {
    const response = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn("StationService", `Proxy error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();

    if (!Array.isArray(result)) {
      return [];
    }

    return result.filter(isRadioBrowserStation);
  } catch (error) {
    logger.warn("StationService", `Proxy request failed: ${error}`);
    return null;
  }
}

function sortByPopularity(stations: Station[]): Station[] {
  return [...stations].sort((left, right) => {
    const popularityLeft = (left.clickCount ?? 0) + (left.votes ?? 0);
    const popularityRight = (right.clickCount ?? 0) + (right.votes ?? 0);
    return popularityRight - popularityLeft;
  });
}

export async function getByCountry(
  countryCode: string,
  options?: PaginationOptions | boolean,
  forceRefresh = false
): Promise<Station[]> {
  const resolvedOptions = typeof options === "boolean" ? undefined : options;
  const shouldForceRefresh = typeof options === "boolean" ? options : forceRefresh;
  const { limit, offset } = resolvePagination(resolvedOptions);
  const key = `country:${countryCode.toUpperCase()}:${limit}:${offset}`;

  if (!shouldForceRefresh && isCacheValid(key)) {
    return cache.get(key)!.data;
  }

  try {
    const repository = await initSqliteRepository();
    const localStations = repository.getByCountry(countryCode);

    if (localStations.length > 0 && !shouldForceRefresh) {
      const pagedLocal = localStations.slice(offset, offset + limit);
      cache.set(key, { timestamp: Date.now(), data: pagedLocal });
      return pagedLocal;
    }

    const result = await callRadioProxy({
      action: "bycountry",
      countrycode: countryCode.toUpperCase(),
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (result === null) {
      const pagedLocal = localStations.slice(offset, offset + limit);
      cache.set(key, { timestamp: Date.now(), data: pagedLocal });
      return pagedLocal;
    }

    const stations = result.map(mapStation);

    if (stations.length > 0) {
      repository.syncStations(stations);
    }

    cache.set(key, { timestamp: Date.now(), data: stations });
    return stations;
  } catch (error) {
    logger.error("StationService", `Failed to fetch ${countryCode}: ${error}`);
    return [];
  }
}

export async function getAll(): Promise<Station[]> {
  const key = "all";

  if (isCacheValid(key)) {
    return cache.get(key)!.data;
  }

  try {
    const repository = await initSqliteRepository();
    const stations = repository.getAll();
    cache.set(key, { timestamp: Date.now(), data: stations });
    return stations;
  } catch (error) {
    logger.error("StationService", `Failed to fetch all stations: ${error}`);
    return [];
  }
}

export async function searchStations(
  query: string,
  options?: PaginationOptions
): Promise<Station[]> {
  const { limit, offset } = resolvePagination(options);
  const key = `search:${query}:${limit}:${offset}`;

  if (isCacheValid(key)) {
    return cache.get(key)!.data;
  }

  try {
    const repository = await initSqliteRepository();
    const result = await callRadioProxy({
      action: "search",
      name: query,
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (result === null) {
      const localStations = repository.search(query).slice(offset, offset + limit);
      cache.set(key, { timestamp: Date.now(), data: localStations });
      return localStations;
    }

    const stations = result.map(mapStation);
    cache.set(key, { timestamp: Date.now(), data: stations });
    return stations;
  } catch (error) {
    logger.error("StationService", `Search failed: ${error}`);
    return [];
  }
}

export async function getTopStations(
  limitOrOptions: number | PaginationOptions = DEFAULT_LIMIT
): Promise<Station[]> {
  const options = typeof limitOrOptions === "number" ? { limit: limitOrOptions } : limitOrOptions;
  const { limit, offset } = resolvePagination(options);
  const key = `top:${limit}:${offset}`;

  if (isCacheValid(key)) {
    return cache.get(key)!.data;
  }

  try {
    const repository = await initSqliteRepository();
    const result = await callRadioProxy(
      offset > 0
        ? {
            action: "search",
            limit: limit.toString(),
            offset: offset.toString(),
          }
        : {
            action: "topclick",
            limit: limit.toString(),
          }
    );

    if (result === null) {
      const localStations = sortByPopularity(repository.getAll()).slice(offset, offset + limit);
      cache.set(key, { timestamp: Date.now(), data: localStations });
      return localStations;
    }

    const stations = result.map(mapStation);
    cache.set(key, { timestamp: Date.now(), data: stations });
    return stations;
  } catch (error) {
    logger.error("StationService", `Failed to fetch top stations: ${error}`);
    return [];
  }
}

export async function onStationPlay(stationId: string): Promise<void> {
  logger.debug("StationService", `Station play: ${stationId}`);
}

export function clearCache(): void {
  cache.clear();
  logger.info("StationService", "Cache cleared");
}

export const searchStationsByQuery = searchStations;
export const getStationsByCountry = getByCountry;
