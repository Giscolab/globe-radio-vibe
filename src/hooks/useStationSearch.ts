// Hook - useStationSearch: combined search and filter logic
import { useMemo } from 'react';
import { useRadioStore } from '@/stores/radio.store';
import type { Station } from '@/engine/types';

interface UseStationSearchResult {
  results: Station[];
  totalCount: number;
  filteredCount: number;
  isFiltered: boolean;
  hasQuery: boolean;
}

export function useStationSearch(): UseStationSearchResult {
  const { 
    stations, 
    filteredStations,
    searchQuery, 
    selectedGenre, 
    selectedBitrate,
    onlineOnly 
  } = useRadioStore();

  const isFiltered = useMemo(() => {
    return !!(searchQuery || selectedGenre || selectedBitrate || onlineOnly);
  }, [searchQuery, selectedGenre, selectedBitrate, onlineOnly]);

  return {
    results: filteredStations,
    totalCount: stations.length,
    filteredCount: filteredStations.length,
    isFiltered,
    hasQuery: !!searchQuery,
  };
}
