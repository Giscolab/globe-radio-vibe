// Hook - useHistory: manage play history with SQLite persistence
import { useEffect, useCallback } from 'react';
import { useRadioStore, PlayRecord } from '@/stores/radio.store';
import { getSqliteRepository } from '@/engine/storage/sqlite/stationRepository';
import type { Station } from '@/engine/types';

export function useHistory() {
  const { 
    history, 
    setHistory, 
    addToHistory: storeAddToHistory,
    clearHistory: storeClearHistory 
  } = useRadioStore();

  // Load history from SQLite on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const repo = getSqliteRepository();
        const stations = repo.getPlayHistory(100);
        
        // Convert to PlayRecord format (SQLite doesn't store full record)
        const records: PlayRecord[] = stations.map(s => ({
          station: s,
          playedAt: new Date(), // Approximation, could store actual date
          durationSeconds: 0,
        }));
        
        setHistory(records);
      } catch (error) {
        console.warn('Failed to load history from SQLite:', error);
      }
    };
    
    loadHistory();
  }, [setHistory]);

  // Record play with SQLite persistence
  const recordPlay = useCallback(async (station: Station, durationSeconds?: number) => {
    // Optimistic update
    storeAddToHistory(station, durationSeconds);
    
    // Persist to SQLite
    try {
      const repo = getSqliteRepository();
      repo.upsert(station);
      repo.recordPlay(station.id, durationSeconds);
    } catch (error) {
      console.error('Failed to persist play history:', error);
    }
  }, [storeAddToHistory]);

  // Clear history with SQLite persistence
  const clearHistory = useCallback(async () => {
    storeClearHistory();
    
    try {
      const repo = getSqliteRepository();
      repo.clearHistory();
    } catch (error) {
      console.error('Failed to clear history in SQLite:', error);
    }
  }, [storeClearHistory]);

  return {
    history,
    recordPlay,
    clearHistory,
    count: history.length,
  };
}
