// Store - Settings: user preferences with persistence and versioning
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============= Types =============
interface SettingsState {
  // Proxy settings
  forceProxy: boolean;
  // Audio safety - disables WebAudio analyzer for maximum compatibility
  safeAudioMode: boolean;
}

interface SettingsActions {
  setForceProxy: (force: boolean) => void;
  setSafeAudioMode: (safe: boolean) => void;
  resetSettings: () => void;
}

// ============= Initial State =============
const initialState: SettingsState = {
  forceProxy: false,
  safeAudioMode: true, // Default ON for maximum compatibility
};

// ============= Store =============
export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...initialState,

      setForceProxy: (force) => set({ forceProxy: force }),
      setSafeAudioMode: (safe) => set({ safeAudioMode: safe }),

      resetSettings: () => set({ ...initialState }),
    }),
    {
      name: 'radio-settings',
      version: 1,
      migrate: (persisted, version) => {
        // Handle migration from older versions
        if (version === 0) {
          return {
            ...(persisted as object),
            safeAudioMode: true,
          };
        }
        return persisted as SettingsState & SettingsActions;
      },
    }
  )
);

// ============= Selectors =============
export const selectForceProxy = (s: SettingsState) => s.forceProxy;
export const selectSafeAudioMode = (s: SettingsState) => s.safeAudioMode;
