import { create } from 'zustand';
import type { Station } from '@/engine/types';

export interface PlayRecord {
  station: Station;
  playedAt: Date;
  durationSeconds: number;
}

interface RadioState {
  // Stations
  stations: Station[];
  filteredStations: Station[];
  currentStation: Station | null;
  isPlaying: boolean;
  isLoading: boolean;
  volume: number;
  
  // Search & Filters
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
  
  // Favorites & History
  favorites: Station[];
  history: PlayRecord[];
  
  // Station actions
  setStations: (stations: Station[]) => void;
  setCurrentStation: (station: Station | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setLoading: (loading: boolean) => void;
  setVolume: (volume: number) => void;
  
  // Search & Filter actions
  setSearchQuery: (query: string) => void;
  setSelectedGenre: (genre: string | null) => void;
  setSelectedBitrate: (bitrate: number | null) => void;
  setSelectedQuality: (quality: string | null) => void;
  setOnlineOnly: (online: boolean) => void;
  applyFilters: () => void;
  clearFilters: () => void;
  
  // AI Search actions
  setAISearchMode: (mode: 'text' | 'smart') => void;
  setAISearchResults: (stations: Station[]) => void;
  setSimilarStations: (stations: Station[]) => void;
  setRecommendations: (stations: Station[]) => void;
  setIsAISearching: (searching: boolean) => void;
  
  // Favorites actions
  toggleFavorite: (station: Station) => void;
  isFavorite: (stationId: string) => boolean;
  setFavorites: (favorites: Station[]) => void;
  
  // History actions
  addToHistory: (station: Station, durationSeconds?: number) => void;
  clearHistory: () => void;
  setHistory: (history: PlayRecord[]) => void;
}

export const useRadioStore = create<RadioState>((set, get) => ({
  // Initial state
  stations: [],
  filteredStations: [],
  currentStation: null,
  isPlaying: false,
  isLoading: false,
  volume: 0.8,
  searchQuery: '',
  selectedGenre: null,
  selectedBitrate: null,
  selectedQuality: null,
  onlineOnly: false,
  
  // AI Search state
  aiSearchMode: 'text',
  aiSearchResults: [],
  similarStations: [],
  recommendations: [],
  isAISearching: false,
  
  favorites: [],
  history: [],

  // Station actions
  setStations: (stations) => {
    set({ stations });
    get().applyFilters();
  },
  
  setCurrentStation: (station) => set({ currentStation: station }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setLoading: (loading) => set({ isLoading: loading }),
  setVolume: (volume) => set({ volume }),

  // Search & Filter actions
  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().applyFilters();
  },
  
  setSelectedGenre: (genre) => {
    set({ selectedGenre: genre });
    get().applyFilters();
  },
  
  setSelectedBitrate: (bitrate) => {
    set({ selectedBitrate: bitrate });
    get().applyFilters();
  },
  
  setOnlineOnly: (online) => {
    set({ onlineOnly: online });
    get().applyFilters();
  },
  
  setSelectedQuality: (quality) => {
    set({ selectedQuality: quality });
    get().applyFilters();
  },
  
  applyFilters: () => {
    const { stations, searchQuery, selectedGenre, selectedBitrate, onlineOnly } = get();
    
    let filtered = stations;
    
    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    
    // Genre filter
    if (selectedGenre) {
      filtered = filtered.filter(s => 
        s.genre === selectedGenre || 
        s.tags.some(t => t.toLowerCase().includes(selectedGenre.toLowerCase()))
      );
    }
    
    // Bitrate filter
    if (selectedBitrate) {
      filtered = filtered.filter(s => (s.bitrate || 0) >= selectedBitrate);
    }
    
    // Online only filter
    if (onlineOnly) {
      filtered = filtered.filter(s => s.lastCheckOk !== false);
    }
    
    set({ filteredStations: filtered });
  },
  
  clearFilters: () => {
    set({ 
      searchQuery: '', 
      selectedGenre: null, 
      selectedBitrate: null,
      selectedQuality: null,
      onlineOnly: false 
    });
    const { stations } = get();
    set({ filteredStations: stations });
  },

  // Favorites actions
  toggleFavorite: (station) => {
    const { favorites } = get();
    const exists = favorites.some(f => f.id === station.id);
    
    if (exists) {
      set({ favorites: favorites.filter(f => f.id !== station.id) });
    } else {
      set({ favorites: [...favorites, station] });
    }
  },
  
  isFavorite: (stationId) => {
    return get().favorites.some(f => f.id === stationId);
  },
  
  setFavorites: (favorites) => set({ favorites }),

  // History actions
  addToHistory: (station, durationSeconds = 0) => {
    const { history } = get();
    const record: PlayRecord = {
      station,
      playedAt: new Date(),
      durationSeconds,
    };
    
    // Keep last 100 entries, remove duplicates of same station
    const filtered = history.filter(h => h.station.id !== station.id);
    const updated = [record, ...filtered].slice(0, 100);
    
    set({ history: updated });
  },
  
  clearHistory: () => set({ history: [] }),
  
  setHistory: (history) => set({ history }),
  
  // AI Search actions
  setAISearchMode: (mode) => set({ aiSearchMode: mode }),
  setAISearchResults: (stations) => set({ aiSearchResults: stations }),
  setSimilarStations: (stations) => set({ similarStations: stations }),
  setRecommendations: (stations) => set({ recommendations: stations }),
  setIsAISearching: (searching) => set({ isAISearching: searching }),
}));
