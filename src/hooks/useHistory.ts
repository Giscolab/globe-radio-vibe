import { useEffect, useCallback, useRef } from 'react';
import { useRadioStore, type PlayRecord } from '@/stores/radio';
import { initSqliteRepository } from '@/engine/storage/sqlite/stationRepository';
import { aiEngine } from '@/engine/radio/ai';
import type { Station } from '@/engine/types';

export function useHistory() {
  const {
    history,
    setHistory,
    addToHistory: storeAddToHistory,
    clearHistory: storeClearHistory,
  } = useRadioStore();

  const pendingAdds = useRef<Set<string>>(new Set());
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    let cancelled = false;

    const loadHistory = async () => {
      try {
        const repo = await initSqliteRepository({ awaitHydration: true });
        const records = repo.getPlayHistory(100);

        const mapped: PlayRecord[] = records.map((record) => ({
          station: record.station,
          playedAt: new Date(record.playedAt),
          durationSeconds: record.durationSeconds,
        }));

        if (!cancelled) {
          setHistory(mapped);
        }
      } catch (error) {
        console.warn('Failed to load history from SQLite:', error);
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [setHistory]);

  const recordPlay = useCallback(
    async (station: Station, durationSeconds?: number) => {
      const key = station.id;
      if (pendingAdds.current.has(key)) return;

      pendingAdds.current.add(key);

      try {
        const repo = await initSqliteRepository({ awaitHydration: true });
        await repo.upsert(station);
        await repo.recordPlay(station.id, durationSeconds);
        await repo.recordSignal('play', station.id, { durationSeconds });
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

  const clearHistory = useCallback(async () => {
    storeClearHistory();
    try {
      const repo = await initSqliteRepository({ awaitHydration: true });
      await repo.clearHistory();
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
