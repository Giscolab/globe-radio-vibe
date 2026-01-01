import { useEffect, useCallback, useRef } from 'react';
import { useRadioStore, type PlayRecord } from '@/stores/radio';
import { getSqliteRepository } from '@/engine/storage/sqlite/stationRepository';
import { aiEngine } from '@/engine/radio/ai';
import type { Station } from '@/engine/types';

let historyInitialized = false; // GLOBAL, partagé

export function useHistory() {
  const {
    history,
    setHistory,
    addToHistory: storeAddToHistory,
    clearHistory: storeClearHistory,
  } = useRadioStore();

  const pendingAdds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (historyInitialized) return;
    historyInitialized = true;

    const loadHistory = async () => {
      try {
        const repo = getSqliteRepository();
        const records = repo.getPlayHistory(100);

        const mapped: PlayRecord[] = records.map((record) => ({
          station: record.station,
          playedAt: new Date(record.playedAt),
          durationSeconds: record.durationSeconds,
        }));

        setHistory(mapped);
      } catch (error) {
        console.warn('Failed to load history from SQLite:', error);
      }
    };

    loadHistory();
  }, [setHistory]);

  const recordPlay = useCallback(
    async (station: Station, durationSeconds?: number) => {
      const key = station.id;
      if (pendingAdds.current.has(key)) return;

      pendingAdds.current.add(key);

      try {
        const repo = getSqliteRepository();
        repo.upsert(station);
        repo.recordPlay(station.id, durationSeconds);
        repo.recordSignal('play', station.id, { durationSeconds });
        storeAddToHistory(station, durationSeconds);
        aiEngine.invalidateCache();
      } catch (error) {
        console.error('Failed to persist play history:', error);
      } finally {
        pendingAdds.current.delete(key);
      }
    },
    [storeAddToHistory]
  );

  const clearHistory = useCallback(() => {
    storeClearHistory();
    try {
      getSqliteRepository().clearHistory();
      aiEngine.invalidateCache();
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
