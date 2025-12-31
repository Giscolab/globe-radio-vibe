// Store - AI Search: AI-powered search state with caching
import { create } from 'zustand';
import type { Station } from '@/engine/types';

interface CachedResult {
  results: Station[];
  timestamp: number;
}

interface AISearchState {
  // Search state
  mode: 'text' | 'smart';
  query: string;
  selectedAmbience: string | null;
  
  // Results
  searchResults: Station[];
  similarStations: Station[];
  recommendations: Station[];
  
  // Loading states
  isSearching: boolean;
  isFetchingSimilar: boolean;
  isFetchingRecommendations: boolean;
  
  // Sync state
  hasSynced: boolean;
  syncProgress: number; // 0-100
  lastSyncTime: number | null;
  
  // Cache (in-memory)
  resultCache: Map<string, CachedResult>;
  
  // Actions
  setMode: (mode: 'text' | 'smart') => void;
  setQuery: (query: string) => void;
  setSelectedAmbience: (ambience: string | null) => void;
  
  setSearchResults: (results: Station[]) => void;
  setSimilarStations: (stations: Station[]) => void;
  setRecommendations: (stations: Station[]) => void;
  
  setIsSearching: (searching: boolean) => void;
  setIsFetchingSimilar: (fetching: boolean) => void;
  setIsFetchingRecommendations: (fetching: boolean) => void;
  
  setHasSynced: (synced: boolean) => void;
  setSyncProgress: (progress: number) => void;
  setLastSyncTime: (time: number) => void;
  
  // Cache management
  getCachedResult: (key: string, ttlMs?: number) => Station[] | null;
  setCachedResult: (key: string, results: Station[]) => void;
  clearCache: () => void;
  
  // Clear
  clearResults: () => void;
  reset: () => void;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const useAIStore = create<AISearchState>((set, get) => ({
  // Initial state
  mode: 'text',
  query: '',
  selectedAmbience: null,
  
  searchResults: [],
  similarStations: [],
  recommendations: [],
  
  isSearching: false,
  isFetchingSimilar: false,
  isFetchingRecommendations: false,
  
  hasSynced: false,
  syncProgress: 0,
  lastSyncTime: null,
  
  resultCache: new Map(),
  
  // Actions
  setMode: (mode) => set({ mode }),
  setQuery: (query) => set({ query }),
  setSelectedAmbience: (ambience) => set({ selectedAmbience: ambience }),
  
  setSearchResults: (results) => set({ searchResults: results }),
  setSimilarStations: (stations) => set({ similarStations: stations }),
  setRecommendations: (stations) => set({ recommendations: stations }),
  
  setIsSearching: (searching) => set({ isSearching: searching }),
  setIsFetchingSimilar: (fetching) => set({ isFetchingSimilar: fetching }),
  setIsFetchingRecommendations: (fetching) => set({ isFetchingRecommendations: fetching }),
  
  setHasSynced: (synced) => set({ hasSynced: synced }),
  setSyncProgress: (progress) => set({ syncProgress: progress }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),
  
  // Cache management
  getCachedResult: (key, ttlMs = CACHE_TTL_MS) => {
    const cached = get().resultCache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > ttlMs) {
      // Expired
      get().resultCache.delete(key);
      return null;
    }
    
    return cached.results;
  },
  
  setCachedResult: (key, results) => {
    const cache = get().resultCache;
    cache.set(key, { results, timestamp: Date.now() });
    
    // Limit cache size
    if (cache.size > 50) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
  },
  
  clearCache: () => {
    set((state) => {
      state.resultCache.clear();
      return { resultCache: new Map() };
    });
  },
  
  clearResults: () => set({
    searchResults: [],
    similarStations: [],
    recommendations: [],
    query: '',
    selectedAmbience: null,
  }),
  
  reset: () => set({
    mode: 'text',
    query: '',
    selectedAmbience: null,
    searchResults: [],
    similarStations: [],
    recommendations: [],
    isSearching: false,
    isFetchingSimilar: false,
    isFetchingRecommendations: false,
    hasSynced: false,
    syncProgress: 0,
    lastSyncTime: null,
    resultCache: new Map(),
  }),
}));

// Selectors
export const selectAISearchResults = (state: AISearchState) => state.searchResults;
export const selectIsSearching = (state: AISearchState) => state.isSearching;
export const selectHasSynced = (state: AISearchState) => state.hasSynced;
export const selectSelectedAmbience = (state: AISearchState) => state.selectedAmbience;
