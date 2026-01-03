import { useQuery } from '@tanstack/react-query';
import { getStationsByCountry } from '@/engine/radio/stationService';
import { useRadioStore } from '@/stores/radio';
import { useEffect, useRef } from 'react';
import type { Station } from '@/engine/types/radio';   // ← IMPORT CRITIQUE

export function useStations(countryCode: string | null) {
  const { setStations, setLoading } = useRadioStore();
  const stableStationsRef = useRef<Station[]>([]);
  const initializedRef = useRef(false);

  const query = useQuery({
    queryKey: ['stations', countryCode],
    queryFn: () => {
      if (!countryCode) throw new Error('No country code');
      return getStationsByCountry(countryCode);
    },
    enabled: Boolean(countryCode),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (!countryCode) return;

    if (!initializedRef.current && query.isLoading) {
      setLoading(true);
    }

    if (query.isSuccess) {
      initializedRef.current = true;
      setLoading(false);
    }
  }, [countryCode, query.isLoading, query.isSuccess, setLoading]);

  useEffect(() => {
    const data = query.data;

    // ❌ 1) Pas de données → on ne touche à rien
    if (!data || data.length === 0) return;

    // ❌ 2) Fallback détecté → on ignore
    if (data.length <= 3) return;

    // ❌ 3) Si même taille → probablement même liste → ignorer
    if (stableStationsRef.current.length === data.length) return;

    // ✅ 4) Mise à jour stable
    stableStationsRef.current = data;
    setStations(data);
  }, [query.data, setStations]);

  return {
    stations: stableStationsRef.current,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
