import { useMemo } from 'react';
import { useRadioStore } from '@/stores/radio.store';
import type { Station } from '@/engine/types';

interface UseStationSearchResult {
  results: Station[];
  totalCount: number;
  filteredCount: number;
  hasFilters: boolean;
  hasSearch: boolean;
  isFiltered: boolean;
}

export function useStationSearch(): UseStationSearchResult {
  const {
    stations,
    filteredStations,
    searchQuery,
    selectedGenre,
    selectedBitrate,
    onlineOnly,
  } = useRadioStore();

  const hasSearch = Boolean(searchQuery);
  const hasFilters = Boolean(selectedGenre || selectedBitrate || onlineOnly);

  const isFiltered = hasSearch || hasFilters;

  const results = useMemo(() => {
    return isFiltered ? filteredStations : stations;
  }, [isFiltered, filteredStations, stations]);

  return {
    results,
    totalCount: stations.length,
    filteredCount: results.length,
    hasSearch,
    hasFilters,
    isFiltered,
  };
}
