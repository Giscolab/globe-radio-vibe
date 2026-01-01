import { create } from 'zustand';
import type { CountryData } from '@/engine/types';

// Default country code to select on startup
export const DEFAULT_COUNTRY_CODE = 'FR';

interface GeoState {
  selectedCountry: CountryData | null;
  hoveredCountry: CountryData | null;
  isLoading: boolean;
  error: string | null;
  defaultCountryInitialized: boolean;
  setSelectedCountry: (country: CountryData | null) => void;
  setHoveredCountry: (country: CountryData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setDefaultCountryInitialized: (initialized: boolean) => void;
}

export const useGeoStore = create<GeoState>((set) => ({
  selectedCountry: null,
  hoveredCountry: null,
  isLoading: false,
  error: null,
  defaultCountryInitialized: false,
  setSelectedCountry: (country) => set({ selectedCountry: country }),
  setHoveredCountry: (country) => set({ hoveredCountry: country }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setDefaultCountryInitialized: (initialized) => set({ defaultCountryInitialized: initialized }),
}));
