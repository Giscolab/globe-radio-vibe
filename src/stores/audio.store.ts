// Store - Audio: Isolated audio state for minimal rerenders
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface AudioState {
  // Real-time audio data (updates frequently)
  volume: number;
  peak: boolean;
  bassLevel: number;
  trebleLevel: number;
  isSilent: boolean;
  
  // Beat detection
  bpm: number;
  beatCount: number;
  
  // Connection state
  isConnected: boolean;
  
  // Actions
  setVolume: (volume: number) => void;
  setPeak: (peak: boolean) => void;
  setBassLevel: (level: number) => void;
  setTrebleLevel: (level: number) => void;
  setIsSilent: (silent: boolean) => void;
  setBpm: (bpm: number) => void;
  setBeatCount: (count: number) => void;
  setIsConnected: (connected: boolean) => void;
  
  // Batch update for performance
  updateAudioData: (data: Partial<Pick<AudioState, 
    'volume' | 'peak' | 'bassLevel' | 'trebleLevel' | 'isSilent' | 'bpm' | 'beatCount'
  >>) => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  volume: 0,
  peak: false,
  bassLevel: 0,
  trebleLevel: 0,
  isSilent: false,
  bpm: 0,
  beatCount: 0,
  isConnected: false,
};

export const useAudioStore = create<AudioState>()(
  subscribeWithSelector((set) => ({
    ...initialState,
    
    setVolume: (volume) => set({ volume }),
    setPeak: (peak) => set({ peak }),
    setBassLevel: (level) => set({ bassLevel: level }),
    setTrebleLevel: (level) => set({ trebleLevel: level }),
    setIsSilent: (silent) => set({ isSilent: silent }),
    setBpm: (bpm) => set({ bpm }),
    setBeatCount: (count) => set({ beatCount: count }),
    setIsConnected: (connected) => set({ isConnected: connected }),
    
    // Optimized batch update - only triggers rerender if values changed
    updateAudioData: (data) =>
      set((state) => {
        let changed = false;
        for (const key in data) {
          if (state[key as keyof typeof data] !== data[key as keyof typeof data]) {
            changed = true;
            break;
          }
        }
        return changed ? { ...state, ...data } : state;
      }),
    
    // Clone initialState to avoid shared reference
    reset: () => set(() => ({ ...initialState })),
  }))
);

// Selectors for optimized subscriptions
export const selectVolume = (state: AudioState) => state.volume;
export const selectPeak = (state: AudioState) => state.peak;
export const selectBassLevel = (state: AudioState) => state.bassLevel;
export const selectIsSilent = (state: AudioState) => state.isSilent;
export const selectBpm = (state: AudioState) => state.bpm;
export const selectIsConnected = (state: AudioState) => state.isConnected;

// Audio snapshot for visualizations
export const selectAudioSnapshot = (state: AudioState) => ({
  volume: state.volume,
  peak: state.peak,
  bassLevel: state.bassLevel,
  trebleLevel: state.trebleLevel,
  bpm: state.bpm,
});
