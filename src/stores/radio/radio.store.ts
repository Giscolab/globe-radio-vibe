// Store - Radio State (projection of engine state; never a playback source of truth)
import { create } from 'zustand';
import type { Station } from '@/engine/types';
import type { StationHealth } from '@/engine/radio/health';
import type { RadioState, RadioActions, PlayRecord } from './radio.types';

type RadioStore = RadioState & RadioActions;

export const useRadioStore = create<RadioStore>((set, get) => ({
  // Initial state
  stations: [],
  topStations: [],
  currentStation: null,

  isPlaying: false,
  isLoading: false,
  isLoadingTop: false,
  volume: 0.8,

  searchQuery: '',
  selectedGenre: null,
  selectedBitrate: null,
  selectedQuality: null,
  onlineOnly: false,

  aiSearchMode: 'text',
  aiSearchResults: [],
  similarStations: [],
  recommendations: [],
  isAISearching: false,

  favorites: [],
  history: [],
  stationHealth: {},

  // Station actions
  setStations: (stations) => set({ stations }),
  setTopStations: (stations) => set({ topStations: stations }),
  setCurrentStation: (station) => set({ currentStation: station }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setLoading: (loading) => set({ isLoading: loading }),
  setLoadingTop: (loading) => set({ isLoadingTop: loading }),
  setVolume: (volume) => set({ volume }),

  // Filter actions
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedGenre: (genre) => set({ selectedGenre: genre }),
  setSelectedBitrate: (bitrate) => set({ selectedBitrate: bitrate }),
  setSelectedQuality: (quality) => set({ selectedQuality: quality }),
  setOnlineOnly: (online) => set({ onlineOnly: online }),

  clearFilters: () =>
    set({
      searchQuery: '',
      selectedGenre: null,
      selectedBitrate: null,
      selectedQuality: null,
      onlineOnly: false,
    }),

  // AI Search actions
  setAISearchMode: (mode) => set({ aiSearchMode: mode }),
  setAISearchResults: (stations) => set({ aiSearchResults: stations }),
  setSimilarStations: (stations) => set({ similarStations: stations }),
  setRecommendations: (stations) => set({ recommendations: stations }),
  setIsAISearching: (searching) => set({ isAISearching: searching }),

  // Favorites actions
  setFavorites: (favorites) => set({ favorites }),
  
  toggleFavorite: (station) => {
    const { favorites } = get();
    const exists = favorites.some((f) => f.id === station.id);
    if (exists) {
      set({ favorites: favorites.filter((f) => f.id !== station.id) });
    } else {
      set({ favorites: [...favorites, station] });
    }
  },

  isFavorite: (stationId) => get().favorites.some((f) => f.id === stationId),

  // History actions
  setHistory: (history) => set({ history }),

  addToHistory: (station, durationSeconds = 0) => {
    const { history } = get();
    const record: PlayRecord = {
      station,
      playedAt: new Date(),
      durationSeconds,
    };
    // Keep last 100 entries, remove duplicates of same station
    const filtered = history.filter((h) => h.station.id !== station.id);
    const updated = [record, ...filtered].slice(0, 100);
    set({ history: updated });
  },

  clearHistory: () => set({ history: [] }),

  // Health actions
  setStationHealth: (id, health) =>
    set((state) => ({
      stationHealth: { ...state.stationHealth, [id]: health },
    })),

  getStationHealth: (id) => get().stationHealth[id] || null,
}));

// Re-export types for convenience
export type { PlayRecord, RadioState, RadioActions } from './radio.types';
