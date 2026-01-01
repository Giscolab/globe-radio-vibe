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
    let cancelled = false;

    if (!station) {
      setEnriched(null);
      return;
    }

    const cached = getCachedEnrichment(station.id);
    if (cached) {
      setEnriched(cached);
    } else {
      setEnriched(enrichStationSync(station));
    }

    setIsEnriching(true);

    enrichStation(station)
      .then(result => {
        if (!cancelled) setEnriched(result);
      })
      .finally(() => {
        if (!cancelled) setIsEnriching(false);
      });

    return () => {
      cancelled = true;
    };
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

  useEffect(() => {
    let cancelled = false;

    if (!stations.length) {
      setEnrichedStations([]);
      return;
    }

    const initial = stations.map(station => {
      const cached = getCachedEnrichment(station.id);
      return cached || enrichStationSync(station);
    });

    setEnrichedStations(initial);
    setIsEnriching(true);
    setProgress({ done: 0, total: stations.length });

    enrichStations(
      stations,
      { extractColors: true },
      (done, total) => {
        if (!cancelled) setProgress({ done, total });
      }
    )
      .then(result => {
        if (!cancelled) setEnrichedStations(result);
      })
      .finally(() => {
        if (!cancelled) setIsEnriching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [stations]);

  return { enrichedStations, isEnriching, progress };
}


/**
 * Hook for sync-only enrichment (no color extraction)
 * Useful for lists where colors aren't needed
 */
export function useEnrichedStationsSync(stations: Station[]): EnrichedStation[] {
  return useMemo(() => {
    return stations.map(station => {
      const cached = getCachedEnrichment(station.id);
      return cached || enrichStationSync(station);
    });
  }, [stations]);
}
