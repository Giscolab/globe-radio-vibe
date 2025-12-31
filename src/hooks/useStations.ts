// Hook - useStations: fetch and manage radio stations
import { useQuery } from '@tanstack/react-query';
import { getStationsByCountry } from '@/engine/radio/stationService';
import { useRadioStore } from '@/stores/radio.store';
import { useEffect } from 'react';

export function useStations(countryCode: string | null) {
  const { setStations, setLoading } = useRadioStore();

  const query = useQuery({
    queryKey: ['stations', countryCode],
    queryFn: () => getStationsByCountry(countryCode!),
    enabled: !!countryCode,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  useEffect(() => {
    setLoading(query.isLoading || query.isFetching);
  }, [query.isLoading, query.isFetching, setLoading]);

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
