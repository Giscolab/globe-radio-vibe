import { useInfiniteQuery } from '@tanstack/react-query';
import { getByCountry } from '@/engine/radio/stationService';
import { useRadioStore } from '@/stores/radio';
import { useEffect, useMemo, useRef } from 'react';
import type { Station } from '@/engine/types/radio';   // ← IMPORT CRITIQUE

const DEFAULT_PAGE_SIZE = 50;

export function useStations(countryCode: string | null, pageSize = DEFAULT_PAGE_SIZE) {
  const { setStations, setLoading } = useRadioStore();
  const stableStationsRef = useRef<Station[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    stableStationsRef.current = [];
    initializedRef.current = false;
    setStations([]);
  }, [countryCode, setStations]);

  const query = useInfiniteQuery({
    queryKey: ['stations', countryCode, pageSize],
    queryFn: ({ pageParam = 0 }) => {
      if (!countryCode) throw new Error('No country code');
      return getByCountry(countryCode, { limit: pageSize, offset: pageParam });
    },
    enabled: Boolean(countryCode),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < pageSize ? undefined : allPages.length * pageSize,
  });

  const pagedStations = useMemo(
    () => query.data?.pages.flat() ?? [],
    [query.data?.pages]
  );

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
    const data = pagedStations;

    // ❌ 1) Pas de données → on ne touche à rien
    if (!data || data.length === 0) return;

    // ✅ Mise à jour stable
    stableStationsRef.current = data;
    setStations(data);
  }, [pagedStations, setStations]);

  return {
    stations: stableStationsRef.current,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    error: query.error,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
  };
}
