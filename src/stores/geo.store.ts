import { create } from 'zustand';
import type { CountryData } from '@/engine/types';

interface GeoState {
  selectedCountry: CountryData | null;
  hoveredCountry: CountryData | null;
  isLoading: boolean;
  error: string | null;
  setSelectedCountry: (country: CountryData | null) => void;
  setHoveredCountry: (country: CountryData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useGeoStore = create<GeoState>((set) => ({
  selectedCountry: null,
  hoveredCountry: null,
  isLoading: false,
  error: null,
  setSelectedCountry: (country) => set({ selectedCountry: country }),
  setHoveredCountry: (country) => set({ hoveredCountry: country }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
