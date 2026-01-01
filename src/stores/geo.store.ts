// Store - Geo: Globe and country selection state (optimized)
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { CountryData } from '@/engine/types';

// Default country code to select on startup
export const DEFAULT_COUNTRY_CODE = 'FR';

// ============= Types =============
interface GeoState {
  selectedCountry: CountryData | null;
  hoveredCountry: CountryData | null;
  isLoading: boolean;
  error: string | null;
  defaultCountryInitialized: boolean;
}

interface GeoActions {
  setSelectedCountry: (country: CountryData | null) => void;
  setHoveredCountry: (country: CountryData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setDefaultCountryInitialized: (initialized: boolean) => void;
  reset: () => void;
}

// ============= Initial State =============
const initialState: GeoState = {
  selectedCountry: null,
  hoveredCountry: null,
  isLoading: false,
  error: null,
  defaultCountryInitialized: false,
};

// ============= Store =============
export const useGeoStore = create<GeoState & GeoActions>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    setSelectedCountry: (country) => set({ selectedCountry: country }),
    setHoveredCountry: (country) => set({ hoveredCountry: country }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    setDefaultCountryInitialized: (initialized) => set({ defaultCountryInitialized: initialized }),

    reset: () => set({ ...initialState }),
  }))
);

// ============= Selectors =============
export const selectSelectedCountry = (s: GeoState) => s.selectedCountry;
export const selectHoveredCountry = (s: GeoState) => s.hoveredCountry;
export const selectGeoLoading = (s: GeoState) => s.isLoading;
export const selectGeoError = (s: GeoState) => s.error;
export const selectIsGeoReady = (s: GeoState) =>
  s.defaultCountryInitialized && !s.isLoading;
