// Store - Settings: user preferences including proxy settings
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // Proxy settings
  forceProxy: boolean;
  setForceProxy: (force: boolean) => void;
  
  // Future settings can be added here
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      forceProxy: false,
      setForceProxy: (force) => set({ forceProxy: force }),
    }),
    {
      name: 'radio-settings',
    }
  )
);
