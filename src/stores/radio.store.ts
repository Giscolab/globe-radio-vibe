import { create } from 'zustand';
import type { Station } from '@/engine/types';

interface RadioState {
  stations: Station[];
  filteredStations: Station[];
  currentStation: Station | null;
  isPlaying: boolean;
  volume: number;
  searchQuery: string;
  selectedGenre: string | null;
  setStations: (stations: Station[]) => void;
  setCurrentStation: (station: Station | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setSearchQuery: (query: string) => void;
  setSelectedGenre: (genre: string | null) => void;
}

export const useRadioStore = create<RadioState>((set, get) => ({
  stations: [],
  filteredStations: [],
  currentStation: null,
  isPlaying: false,
  volume: 0.8,
  searchQuery: '',
  selectedGenre: null,
  setStations: (stations) => set({ stations, filteredStations: stations }),
  setCurrentStation: (station) => set({ currentStation: station }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  setSearchQuery: (query) => {
    const stations = get().stations;
    const filtered = query 
      ? stations.filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
      : stations;
    set({ searchQuery: query, filteredStations: filtered });
  },
  setSelectedGenre: (genre) => set({ selectedGenre: genre }),
}));
