import { useQuery } from '@tanstack/react-query';
import { getStationsByCountry } from '@/engine/radio/stationService';
import { useRadioStore } from '@/stores/radio';
import { useEffect, useRef } from 'react';

export function useStations(countryCode: string | null) {
  const { setStations, setLoading } = useRadioStore();
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

  // Set loading only for initial load
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

  // Sync store only when data actually changes
  useEffect(() => {
    if (query.data) {
      setStations(query.data);
    }
  }, [query.data, setStations]);

  return {
    stations: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
