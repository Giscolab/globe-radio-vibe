// Engine - Radio Enrichment: Station enrichment orchestrator
import type { Station, EnrichedStation } from '@/engine/types/radio';
import { extractColors } from '@/engine/media/colorExtractor';
import { calculatePopularityScore } from './popularityScore';
import { extractSubGenres, getPrimaryGenre } from './genreMapper';
import { getQualityTier } from './qualityBadge';
import { parseLocation } from './locationParser';

// Cache for enriched stations
const enrichmentCache = new Map<string, EnrichedStation>();

export interface EnrichmentOptions {
  extractColors?: boolean;
  calculatePopularity?: boolean;
  mapGenres?: boolean;
  parseLocation?: boolean;
  useCache?: boolean;
}

const DEFAULT_OPTIONS: EnrichmentOptions = {
  extractColors: true,
  calculatePopularity: true,
  mapGenres: true,
  parseLocation: true,
  useCache: true,
};

/**
 * Enrich a single station with additional computed fields
 * Async because color extraction requires image loading
 */
export async function enrichStation(
  station: Station,
  options: EnrichmentOptions = {}
): Promise<EnrichedStation> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Check cache
  if (opts.useCache && enrichmentCache.has(station.id)) {
    return enrichmentCache.get(station.id)!;
  }
  
  // Start with sync enrichment
  const enriched = enrichStationSync(station, opts);
  
  // Add async color extraction
  if (opts.extractColors && station.favicon) {
    try {
      const colors = await extractColors(station.favicon);
      if (colors) {
        enriched.colors = colors;
        enriched.isVerified = true;
      }
    } catch (error) {
      // Color extraction failed, continue without colors
    }
  }
  
  // Cache result
  if (opts.useCache) {
    enrichmentCache.set(station.id, enriched);
  }
  
  return enriched;
}

/**
 * Synchronous enrichment (without color extraction)
 * Faster for batch processing when colors aren't needed immediately
 */
export function enrichStationSync(
  station: Station,
  options: Omit<EnrichmentOptions, 'extractColors'> = {}
): EnrichedStation {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Check cache
  if (opts.useCache && enrichmentCache.has(station.id)) {
    return enrichmentCache.get(station.id)!;
  }
  
  const enriched: EnrichedStation = {
    ...station,
    popularityScore: 0,
    qualityTier: 'medium',
    subGenres: [],
    isVerified: false,
  };
  
  // Popularity calculation
  if (opts.calculatePopularity) {
    const popularity = calculatePopularityScore({
      votes: station.votes,
      clickCount: station.clickCount,
      clickTrend: station.clickTrend,
      lastCheckOk: station.lastCheckOk,
    });
    enriched.popularityScore = popularity.score;
    enriched.popularityTier = popularity.tier;
  }
  
  // Genre mapping
  if (opts.mapGenres && station.tags.length > 0) {
    enriched.subGenres = extractSubGenres(station.tags);
    enriched.primaryGenre = getPrimaryGenre(station.tags);
  }
  
  // Quality tier
  enriched.qualityTier = getQualityTier(station.bitrate, station.codec);
  
  // Location parsing
  if (opts.parseLocation) {
    const location = parseLocation(station.state, station.country);
    enriched.city = location.city;
    enriched.region = location.region;
    enriched.displayLocation = location.displayLocation;
  }
  
  // Verification status (basic check - has favicon and is online)
  enriched.isVerified = Boolean(station.favicon) && station.lastCheckOk;
  
  return enriched;
}

/**
 * Batch enrich multiple stations
 * Uses parallel processing for async operations
 */
export async function enrichStations(
  stations: Station[],
  options: EnrichmentOptions = {},
  onProgress?: (done: number, total: number) => void
): Promise<EnrichedStation[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const total = stations.length;
  let done = 0;
  
  // First pass: sync enrichment for all stations
  const syncEnriched = stations.map(station => enrichStationSync(station, opts));
  
  // If no color extraction needed, return sync results
  if (!opts.extractColors) {
    return syncEnriched;
  }
  
  // Second pass: async color extraction in batches
  const BATCH_SIZE = 10;
  const results: EnrichedStation[] = [...syncEnriched];
  
  for (let i = 0; i < stations.length; i += BATCH_SIZE) {
    const batch = stations.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (station, batchIndex) => {
      const index = i + batchIndex;
      
      if (station.favicon) {
        try {
          const colors = await extractColors(station.favicon);
          if (colors) {
            results[index] = {
              ...results[index],
              colors,
              isVerified: true,
            };
          }
        } catch (error) {
          // Continue without colors
        }
      }
      
      done++;
      onProgress?.(done, total);
    });
    
    await Promise.all(batchPromises);
  }
  
  // Update cache
  if (opts.useCache) {
    for (const enriched of results) {
      enrichmentCache.set(enriched.id, enriched);
    }
  }
  
  return results;
}

/**
 * Get cached enriched station if available
 */
export function getCachedEnrichment(stationId: string): EnrichedStation | undefined {
  return enrichmentCache.get(stationId);
}

/**
 * Clear enrichment cache
 */
export function clearEnrichmentCache(): void {
  enrichmentCache.clear();
}

/**
 * Get cache size
 */
export function getEnrichmentCacheSize(): number {
  return enrichmentCache.size;
}
