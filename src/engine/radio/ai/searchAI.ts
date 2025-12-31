// AI Search Service - Client-side interface for AI-powered search
import { supabase } from '@/integrations/supabase/client';
import type { Station, EnrichedStation } from '@/engine/types';
import { buildAIDescriptors } from '@/engine/radio/enrichment/aiDescriptor';

export type AmbienceType = 'chill' | 'focus' | 'energetic' | 'relax' | 'night' | 'party' | 'acoustic' | 'vocal';

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

/**
 * Search stations by natural language query
 */
export async function searchByText(
  query: string,
  stations: Station[],
  limit = 20
): Promise<Station[]> {
  try {
    const { data, error } = await supabase.functions.invoke<SearchResponse>('search-stations', {
      body: { query, limit }
    });

    if (error) {
      console.error('[searchAI] Function error:', error);
      throw error;
    }

    if (data?.error) {
      console.error('[searchAI] Search error:', data.error);
      return [];
    }

    if (!data?.results || data.results.length === 0) {
      console.log('[searchAI] No results found');
      return [];
    }

    // Map results back to stations
    const stationMap = new Map(stations.map(s => [s.id, s]));
    return data.results
      .map(r => stationMap.get(r.id))
      .filter((s): s is Station => s !== undefined);

  } catch (error) {
    console.error('[searchAI] Error:', error);
    return [];
  }
}

/**
 * Find stations similar to a given station
 */
export async function searchSimilarStations(
  stationId: string,
  stations: Station[],
  limit = 10
): Promise<Station[]> {
  try {
    const { data, error } = await supabase.functions.invoke<SearchResponse>('similar-stations', {
      body: { stationId, limit }
    });

    if (error) {
      console.error('[searchAI] Similar function error:', error);
      throw error;
    }

    if (data?.error) {
      console.error('[searchAI] Similar error:', data.error);
      return [];
    }

    if (!data?.results || data.results.length === 0) {
      console.log('[searchAI] No similar stations found');
      return [];
    }

    // Map results back to stations
    const stationMap = new Map(stations.map(s => [s.id, s]));
    return data.results
      .map(r => stationMap.get(r.id))
      .filter((s): s is Station => s !== undefined);

  } catch (error) {
    console.error('[searchAI] Similar error:', error);
    return [];
  }
}

/**
 * Get recommendations based on listening history and favorites
 */
export async function getRecommendations(
  recentHistory: Station[],
  favorites: Station[],
  allStations: Station[],
  limit = 10
): Promise<Station[]> {
  // Build a query from user preferences
  const preferredGenres = new Set<string>();
  const preferredCountries = new Set<string>();
  
  [...recentHistory.slice(0, 5), ...favorites.slice(0, 5)].forEach(station => {
    if (station.genre) preferredGenres.add(station.genre);
    if (station.country) preferredCountries.add(station.country);
    station.tags?.slice(0, 3).forEach(tag => preferredGenres.add(tag));
  });
  
  if (preferredGenres.size === 0 && preferredCountries.size === 0) {
    // No preferences yet, return popular stations
    return allStations
      .filter(s => s.votes && s.votes > 10)
      .sort((a, b) => (b.votes || 0) - (a.votes || 0))
      .slice(0, limit);
  }
  
  const query = [
    ...Array.from(preferredGenres).slice(0, 5),
    ...Array.from(preferredCountries).slice(0, 2)
  ].join(' ');
  
  return searchByText(query, allStations, limit);
}

/**
 * Search by ambience/mood
 */
export async function searchByAmbience(
  ambience: AmbienceType,
  stations: Station[],
  genre?: string
): Promise<Station[]> {
  const ambienceQueries: Record<AmbienceType, string> = {
    chill: 'chill relaxing calm smooth easy listening lounge',
    focus: 'focus ambient instrumental electronic minimal concentration',
    energetic: 'energetic upbeat dance electronic house techno',
    relax: 'relaxing peaceful calm acoustic soft gentle',
    night: 'night dark ambient electronic chill downtempo',
    party: 'party dance club house edm electronic pop',
    acoustic: 'acoustic folk singer-songwriter unplugged live',
    vocal: 'vocal jazz soul r&b pop singer crooner'
  };
  
  let query = ambienceQueries[ambience] || ambience;
  if (genre) {
    query = `${genre} ${query}`;
  }
  
  return searchByText(query, stations, 20);
}

/**
 * Sync station embeddings to the database
 */
export async function syncEmbeddings(stations: EnrichedStation[]): Promise<boolean> {
  try {
    const descriptors = buildAIDescriptors(stations);
    
    // Sync in batches
    const BATCH_SIZE = 200;
    let totalSynced = 0;
    
    for (let i = 0; i < descriptors.length; i += BATCH_SIZE) {
      const batch = descriptors.slice(i, i + BATCH_SIZE);
      
      const { data, error } = await supabase.functions.invoke<SyncResponse>('sync-embeddings', {
        body: { stations: batch }
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
    
  } catch (error) {
    console.error('[searchAI] Sync error:', error);
    return false;
  }
}
