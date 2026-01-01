import { useMemo } from 'react';
import { useRadioStore, selectFilteredStations } from '@/stores/radio';
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
    searchQuery,
    selectedGenre,
    selectedBitrate,
    onlineOnly,
  } = useRadioStore();

  const hasSearch = Boolean(searchQuery);
  const hasFilters = Boolean(selectedGenre || selectedBitrate || onlineOnly);
  const isFiltered = hasSearch || hasFilters;

  const filteredStations = useMemo(
    () =>
      selectFilteredStations(
        stations,
        searchQuery,
        selectedGenre,
        selectedBitrate,
        onlineOnly
      ),
    [stations, searchQuery, selectedGenre, selectedBitrate, onlineOnly]
  );

  const results = isFiltered ? filteredStations : stations;

  return {
    results,
    totalCount: stations.length,
    filteredCount: results.length,
    hasSearch,
    hasFilters,
    isFiltered,
  };
}
