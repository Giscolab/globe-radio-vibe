// Store - Radio Types
import type { Station } from '@/engine/types';
import type { StationHealth } from '@/engine/radio/health';

export interface PlayRecord {
  station: Station;
  playedAt: Date;
  durationSeconds: number;
}

export interface RadioState {
  // Stations
  stations: Station[];
  topStations: Station[];
  currentStation: Station | null;

  // UI state
  isPlaying: boolean;
  isLoading: boolean;
  isLoadingTop: boolean;
  volume: number;

  // Filters
  searchQuery: string;
  selectedGenre: string | null;
  selectedBitrate: number | null;
  selectedQuality: string | null;
  onlineOnly: boolean;

  // AI Search
  aiSearchMode: 'text' | 'smart';
  aiSearchResults: Station[];
  similarStations: Station[];
  recommendations: Station[];
  isAISearching: boolean;

  // Data
  favorites: Station[];
  history: PlayRecord[];
  stationHealth: Record<string, StationHealth>;
}

export interface RadioActions {
  // Station actions
  setStations: (stations: Station[]) => void;
  setTopStations: (stations: Station[]) => void;
  setCurrentStation: (station: Station | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setLoading: (loading: boolean) => void;
  setLoadingTop: (loading: boolean) => void;
  setVolume: (volume: number) => void;

  // Filter actions
  setSearchQuery: (query: string) => void;
  setSelectedGenre: (genre: string | null) => void;
  setSelectedBitrate: (bitrate: number | null) => void;
  setSelectedQuality: (quality: string | null) => void;
  setOnlineOnly: (online: boolean) => void;
  clearFilters: () => void;

  // AI Search actions
  setAISearchMode: (mode: 'text' | 'smart') => void;
  setAISearchResults: (stations: Station[]) => void;
  setSimilarStations: (stations: Station[]) => void;
  setRecommendations: (stations: Station[]) => void;
  setIsAISearching: (searching: boolean) => void;

  // Favorites actions
  setFavorites: (favorites: Station[]) => void;
  toggleFavorite: (station: Station) => void;
  isFavorite: (stationId: string) => boolean;

  // History actions
  setHistory: (history: PlayRecord[]) => void;
  addToHistory: (station: Station, durationSeconds?: number) => void;
  clearHistory: () => void;

  // Health actions
  setStationHealth: (id: string, health: StationHealth) => void;
  getStationHealth: (id: string) => StationHealth | null;
}
