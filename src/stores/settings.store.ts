import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  safeAudioMode: boolean;
}

interface SettingsActions {
  setSafeAudioMode: (safe: boolean) => void;
  resetSettings: () => void;
}

const initialState: SettingsState = {
  safeAudioMode: true,
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...initialState,

      setSafeAudioMode: (safe) => set({ safeAudioMode: safe }),
      resetSettings: () => set({ ...initialState }),
    }),
    {
      name: 'radio-settings',
      version: 2,
      migrate: (persisted) => {
        const state = (persisted as Partial<SettingsState>) || {};
        return {
          safeAudioMode: state.safeAudioMode ?? true,
        };
      },
    }
  )
);

export const selectSafeAudioMode = (state: SettingsState) => state.safeAudioMode;
