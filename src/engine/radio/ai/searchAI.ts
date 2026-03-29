// ============================================================================
// Search service - Client-side interface for Supabase descriptor search
// ============================================================================
// Responsabilités:
// - Interface vers les edge functions de recherche sémantique
// - Pas de logique de scoring (délégué au serveur ou aiEngine)
// - Gestion robuste des erreurs et retours vides
// ============================================================================

import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import type { Station, EnrichedStation } from '@/engine/types';
import { buildAIDescriptors } from '@/engine/radio/enrichment/aiDescriptor';

// ============= Types =============

export type AmbienceType =
  | 'chill'
  | 'focus'
  | 'energetic'
  | 'relax'
  | 'night'
  | 'party'
  | 'acoustic'
  | 'vocal';

interface SearchResult {
  id: string;
  score: number;
}

interface SearchResponse {
  results: SearchResult[];
  features?: Record<string, string[]>;
  error?: string;
}

interface SyncResponse {
  synced: number;
  total: number;
  existing?: number;
  error?: string;
}

// ============= Ambience Query Mapping =============

const AMBIENCE_QUERIES: Record<AmbienceType, string> = {
  chill: 'chill relaxing calm smooth easy listening lounge downtempo',
  focus: 'focus ambient instrumental electronic minimal concentration study',
  energetic: 'energetic upbeat dance electronic house techno edm',
  relax: 'relaxing peaceful calm acoustic soft gentle soothing',
  night: 'night dark ambient electronic chill downtempo late',
  party: 'party dance club house edm electronic pop upbeat',
  acoustic: 'acoustic folk singer-songwriter unplugged live stripped',
  vocal: 'vocal jazz soul r&b pop singer crooner smooth',
};

// ============= Utils =============

function mapResultsToStations(results: SearchResult[], stations: Station[]): Station[] {
  const stationMap = new Map(stations.map((s) => [s.id, s]));
  return results
    .map((r) => stationMap.get(r.id))
    .filter((s): s is Station => s !== undefined);
}

// ============= Public API =============

/**
 * Search stations by natural language query using semantic search
 */
export async function searchByText(
  query: string,
  stations: Station[],
  limit = 20
): Promise<Station[]> {
  if (!query.trim() || !isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase.functions.invoke<SearchResponse>('search-stations', {
      body: { query, limit },
    });

    if (error) {
      console.error('[searchAI] Function error:', error);
      return [];
    }

    if (data?.error) {
      console.error('[searchAI] Search error:', data.error);
      return [];
    }

    if (!data?.results?.length) {
      return [];
    }

    return mapResultsToStations(data.results, stations);
  } catch (err) {
    console.error('[searchAI] Unexpected error:', err);
    return [];
  }
}

/**
 * Find stations similar to a given station using embeddings
 */
export async function searchSimilarStations(
  stationId: string,
  stations: Station[],
  limit = 10
): Promise<Station[]> {
  if (!stationId || !isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase.functions.invoke<SearchResponse>('similar-stations', {
      body: { stationId, limit },
    });

    if (error) {
      console.error('[searchAI] Similar function error:', error);
      return [];
    }

    if (data?.error) {
      console.error('[searchAI] Similar error:', data.error);
      return [];
    }

    if (!data?.results?.length) {
      return [];
    }

    return mapResultsToStations(data.results, stations);
  } catch (err) {
    console.error('[searchAI] Similar unexpected error:', err);
    return [];
  }
}

/**
 * Get recommendations based on listening history and favorites
 * This is a lightweight fallback when aiEngine.recommend() is not suitable
 */
export async function getRecommendations(
  recentHistory: Station[],
  favorites: Station[],
  allStations: Station[],
  limit = 10
): Promise<Station[]> {
  const preferredGenres = new Set<string>();
  const preferredCountries = new Set<string>();

  // Extract preferences from recent history and favorites
  const sources = [...recentHistory.slice(0, 5), ...favorites.slice(0, 5)];
  for (const station of sources) {
    if (station.genre) preferredGenres.add(station.genre);
    if (station.country) preferredCountries.add(station.country);
    station.tags?.slice(0, 3).forEach((tag) => preferredGenres.add(tag));
  }

  // Fallback to popular stations if no preferences
  if (preferredGenres.size === 0 && preferredCountries.size === 0) {
    return allStations
      .filter((s) => s.votes && s.votes > 10)
      .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
      .slice(0, limit);
  }

  // Build query from preferences
  const queryParts = [
    ...Array.from(preferredGenres).slice(0, 5),
    ...Array.from(preferredCountries).slice(0, 2),
  ];

  return searchByText(queryParts.join(' '), allStations, limit);
}

/**
 * Search by ambience/mood using predefined query mappings
 */
export async function searchByAmbience(
  ambience: AmbienceType,
  stations: Station[],
  genre?: string
): Promise<Station[]> {
  const baseQuery = AMBIENCE_QUERIES[ambience] ?? ambience;
  const query = genre ? `${genre} ${baseQuery}` : baseQuery;

  return searchByText(query, stations, 20);
}

/**
 * Sync station embeddings to the database (batch operation)
 */
export async function syncEmbeddings(stations: EnrichedStation[]): Promise<boolean> {
  if (!stations.length) return true;
  if (!isSupabaseConfigured) return false;

  try {
    const descriptors = buildAIDescriptors(stations);
    const BATCH_SIZE = 200;
    let totalSynced = 0;

    for (let i = 0; i < descriptors.length; i += BATCH_SIZE) {
      const batch = descriptors.slice(i, i + BATCH_SIZE);

      const { data, error } = await supabase.functions.invoke<SyncResponse>('sync-embeddings', {
        body: { stations: batch },
      });

      if (error) {
        console.error('[searchAI] Sync batch error:', error);
        continue;
      }

      if (data?.synced) {
        totalSynced += data.synced;
      }
    }

    console.log(`[searchAI] Synced ${totalSynced} station embeddings`);
    return true;
  } catch (err) {
    console.error('[searchAI] Sync unexpected error:', err);
    return false;
  }
}
