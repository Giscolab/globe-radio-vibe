// Store - Settings: user preferences including proxy settings
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // Proxy settings
  forceProxy: boolean;
  setForceProxy: (force: boolean) => void;
  
  // Safe audio mode - disables WebAudio analyzer for maximum compatibility
  safeAudioMode: boolean;
  setSafeAudioMode: (safe: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      forceProxy: false,
      setForceProxy: (force) => set({ forceProxy: force }),
      safeAudioMode: true, // Default ON for maximum compatibility
      setSafeAudioMode: (safe) => set({ safeAudioMode: safe }),
    }),
    {
      name: 'radio-settings',
    }
  )
);
