import { useEffect, useCallback, useRef } from 'react';
import { useRadioStore } from '@/stores/radio';
import { getSqliteRepository } from '@/engine/storage/sqlite/stationRepository';
import type { Station } from '@/engine/types';

export function useFavorites() {
  const {
    favorites,
    setFavorites,
    toggleFavorite: storeToggle,
    isFavorite
  } = useRadioStore();

  const isInitialized = useRef(false);
  const pendingToggle = useRef<Set<string>>(new Set());

  // Load favorites from SQLite once
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const loadFavorites = async () => {
      try {
        const repo = getSqliteRepository();
        const stored = repo.getFavorites();
        setFavorites(stored);
      } catch (error) {
        console.warn('Failed to load favorites from SQLite:', error);
      }
    };

    loadFavorites();
  }, [setFavorites]);

  const toggleFavorite = useCallback(
    async (station: Station) => {
      const id = station.id;

      // Prevent concurrent toggles on same station
      if (pendingToggle.current.has(id)) return;
      pendingToggle.current.add(id);

      const wasFavorite = isFavorite(id);

      // Optimistic UI update
      storeToggle(station);

      try {
        const repo = getSqliteRepository();

        if (wasFavorite) {
          repo.removeFavorite(id);
        } else {
          repo.upsert(station);
          repo.addFavorite(id);
        }
      } catch (error) {
        console.error('Failed to persist favorite:', error);
        // rollback
        storeToggle(station);
      } finally {
        pendingToggle.current.delete(id);
      }
    },
    [storeToggle, isFavorite]
  );

  return {
    favorites,
    toggleFavorite,
    isFavorite,
    count: favorites.length,
  };
}
