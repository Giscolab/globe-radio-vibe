// Store - AI Search: AI-powered search state with safe cache
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Station } from '@/engine/types';

// ============= Types =============
interface CachedResult {
  results: Station[];
  timestamp: number;
}

interface SyncState {
  synced: boolean;
  progress: number;
  lastSync: number | null;
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

  // Sync state (grouped)
  sync: SyncState;

  // Cache (immutable on updates)
  cache: Map<string, CachedResult>;
}

interface AISearchActions {
  setMode: (mode: 'text' | 'smart') => void;
  setQuery: (q: string) => void;
  setSelectedAmbience: (a: string | null) => void;

  setSearchResults: (s: Station[]) => void;
  setSimilarStations: (s: Station[]) => void;
  setRecommendations: (s: Station[]) => void;

  setIsSearching: (v: boolean) => void;
  setIsFetchingSimilar: (v: boolean) => void;
  setIsFetchingRecommendations: (v: boolean) => void;

  setSync: (sync: Partial<SyncState>) => void;

  // Cache management (safe - creates new Map on mutation)
  getCached: (key: string, ttl?: number) => Station[] | null;
  setCached: (key: string, data: Station[]) => void;
  clearCache: () => void;

  clearResults: () => void;
  reset: () => void;
}

// ============= Constants =============
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50;

const initialSync: SyncState = {
  synced: false,
  progress: 0,
  lastSync: null,
};

// ============= Store =============
export const useAIStore = create<AISearchState & AISearchActions>()(
  subscribeWithSelector((set, get) => ({
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

    sync: { ...initialSync },
    cache: new Map(),

    // Setters
    setMode: (mode) => set({ mode }),
    setQuery: (query) => set({ query }),
    setSelectedAmbience: (a) => set({ selectedAmbience: a }),

    setSearchResults: (s) => set({ searchResults: s }),
    setSimilarStations: (s) => set({ similarStations: s }),
    setRecommendations: (s) => set({ recommendations: s }),

    setIsSearching: (v) => set({ isSearching: v }),
    setIsFetchingSimilar: (v) => set({ isFetchingSimilar: v }),
    setIsFetchingRecommendations: (v) => set({ isFetchingRecommendations: v }),

    // Sync state (atomic update)
    setSync: (syncUpdate) =>
      set((state) => ({
        sync: { ...state.sync, ...syncUpdate },
      })),

    // Cache - safe read (no mutation)
    getCached: (key, ttl = CACHE_TTL) => {
      const item = get().cache.get(key);
      if (!item) return null;
      if (Date.now() - item.timestamp > ttl) return null;
      return item.results;
    },

    // Cache - safe write (creates new Map to trigger update)
    setCached: (key, data) =>
      set((state) => {
        const cache = new Map(state.cache);
        cache.set(key, { results: data, timestamp: Date.now() });

        // Limit cache size (LRU-like: remove oldest)
        if (cache.size > MAX_CACHE_SIZE) {
          const oldest = cache.keys().next().value;
          if (oldest) cache.delete(oldest);
        }

        return { cache };
      }),

    clearCache: () => set({ cache: new Map() }),

    clearResults: () =>
      set({
        searchResults: [],
        similarStations: [],
        recommendations: [],
        query: '',
        selectedAmbience: null,
      }),

    reset: () =>
      set({
        mode: 'text',
        query: '',
        selectedAmbience: null,
        searchResults: [],
        similarStations: [],
        recommendations: [],
        isSearching: false,
        isFetchingSimilar: false,
        isFetchingRecommendations: false,
        sync: { ...initialSync },
        cache: new Map(),
      }),
  }))
);

// ============= Selectors =============
export const selectSearchResults = (s: AISearchState) => s.searchResults;
export const selectSimilarStations = (s: AISearchState) => s.similarStations;
export const selectRecommendations = (s: AISearchState) => s.recommendations;
export const selectIsSearching = (s: AISearchState) => s.isSearching;
export const selectSyncProgress = (s: AISearchState) => s.sync.progress;
export const selectIsSynced = (s: AISearchState) => s.sync.synced;
export const selectSelectedAmbience = (s: AISearchState) => s.selectedAmbience;
export const selectSearchMode = (s: AISearchState) => s.mode;
