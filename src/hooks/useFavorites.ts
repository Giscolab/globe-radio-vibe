// Hook - useFavorites: manage favorites with SQLite persistence
import { useEffect, useCallback } from 'react';
import { useRadioStore } from '@/stores/radio.store';
import { getSqliteRepository } from '@/engine/storage/sqlite/stationRepository';
import type { Station } from '@/engine/types';

export function useFavorites() {
  const { 
    favorites, 
    setFavorites, 
    toggleFavorite: storeToggle,
    isFavorite 
  } = useRadioStore();

  // Load favorites from SQLite on mount
  useEffect(() => {
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

  // Toggle favorite with SQLite persistence
  const toggleFavorite = useCallback(async (station: Station) => {
    const wasAlreadyFavorite = isFavorite(station.id);
    
    // Optimistic update
    storeToggle(station);
    
    // Persist to SQLite
    try {
      const repo = getSqliteRepository();
      
      if (wasAlreadyFavorite) {
        repo.removeFavorite(station.id);
      } else {
        // Ensure station exists before adding favorite
        repo.upsert(station);
        repo.addFavorite(station.id);
      }
    } catch (error) {
      console.error('Failed to persist favorite:', error);
      // Rollback on error
      storeToggle(station);
    }
  }, [storeToggle, isFavorite]);

  return {
    favorites,
    toggleFavorite,
    isFavorite,
    count: favorites.length,
  };
}
