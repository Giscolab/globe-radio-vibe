import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { getByCountry } from '@/engine/radio/stationService';
import { useRadioStore } from '@/stores/radio';
import type { Station } from '@/engine/types/radio';

const DEFAULT_PAGE_SIZE = 50;

export function useStations(countryCode: string | null, pageSize = DEFAULT_PAGE_SIZE) {
  const setStations = useRadioStore((state) => state.setStations);
  const setLoading = useRadioStore((state) => state.setLoading);
  const initializedRef = useRef(false);

  useEffect(() => {
    initializedRef.current = false;
    setStations([]);
  }, [countryCode, setStations]);

  const query = useInfiniteQuery({
    queryKey: ['stations', countryCode, pageSize],
    queryFn: async ({ pageParam }) => {
      if (!countryCode) {
        throw new Error('No country code');
      }

      return getByCountry(countryCode, { limit: pageSize, offset: pageParam });
    },
    initialPageParam: 0,
    enabled: Boolean(countryCode),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    getNextPageParam: (lastPage: Station[], allPages) =>
      lastPage.length < pageSize ? undefined : allPages.length * pageSize,
  });

  const pagedStations = useMemo(() => query.data?.pages.flat() ?? [], [query.data?.pages]);

  useEffect(() => {
    if (!countryCode) {
      setLoading(false);
      return;
    }

    if (!initializedRef.current && query.isLoading) {
      setLoading(true);
    }

    if (query.isSuccess || query.isError) {
      initializedRef.current = true;
      setLoading(false);
    }
  }, [countryCode, query.isError, query.isLoading, query.isSuccess, setLoading]);

  useEffect(() => {
    if (!query.isSuccess) {
      return;
    }

    setStations(pagedStations);
  }, [pagedStations, query.isSuccess, setStations]);

  return {
    stations: pagedStations,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    error: query.error,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
  };
}
