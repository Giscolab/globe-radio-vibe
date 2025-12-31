// Hook - useEnrichedStation: Enrich station data on demand
import { useState, useEffect, useMemo } from 'react';
import type { Station, EnrichedStation } from '@/engine/types/radio';
import { 
  enrichStation, 
  enrichStationSync, 
  enrichStations,
  getCachedEnrichment 
} from '@/engine/radio/enrichment/stationEnricher';

/**
 * Hook to enrich a single station with async color extraction
 */
export function useEnrichedStation(station: Station | null) {
  const [enriched, setEnriched] = useState<EnrichedStation | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  
  useEffect(() => {
    if (!station) {
      setEnriched(null);
      return;
    }
    
    // Check cache first
    const cached = getCachedEnrichment(station.id);
    if (cached) {
      setEnriched(cached);
      return;
    }
    
    // Start with sync enrichment for immediate display
    setEnriched(enrichStationSync(station));
    
    // Then do async enrichment for colors
    setIsEnriching(true);
    enrichStation(station)
      .then(setEnriched)
      .finally(() => setIsEnriching(false));
  }, [station?.id]);
  
  return { enriched, isEnriching };
}

/**
 * Hook to enrich multiple stations with sync data immediately
 * Color extraction happens in background
 */
export function useEnrichedStations(stations: Station[]) {
  const [enrichedStations, setEnrichedStations] = useState<EnrichedStation[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  
  // Memoize station IDs to detect changes
  const stationIds = useMemo(
    () => stations.map(s => s.id).join(','),
    [stations]
  );
  
  useEffect(() => {
    if (stations.length === 0) {
      setEnrichedStations([]);
      return;
    }
    
    // Immediate sync enrichment
    const syncEnriched = stations.map(station => {
      const cached = getCachedEnrichment(station.id);
      return cached || enrichStationSync(station);
    });
    setEnrichedStations(syncEnriched);
    
    // Background async enrichment for colors
    setIsEnriching(true);
    setProgress({ done: 0, total: stations.length });
    
    enrichStations(
      stations,
      { extractColors: true },
      (done, total) => setProgress({ done, total })
    )
      .then(setEnrichedStations)
      .finally(() => setIsEnriching(false));
  }, [stationIds]);
  
  return { 
    enrichedStations, 
    isEnriching, 
    progress 
  };
}

/**
 * Hook for sync-only enrichment (no color extraction)
 * Useful for lists where colors aren't needed
 */
export function useEnrichedStationsSync(stations: Station[]): EnrichedStation[] {
  return useMemo(
    () => stations.map(station => {
      const cached = getCachedEnrichment(station.id);
      return cached || enrichStationSync(station);
    }),
    [stations.map(s => s.id).join(',')]
  );
}
