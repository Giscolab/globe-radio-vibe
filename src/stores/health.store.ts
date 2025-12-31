// Store - Health: Station health monitoring state
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { StationHealth } from '@/engine/radio/health';

interface HealthStats {
  total: number;
  healthy: number;
  slow: number;
  unstable: number;
  offline: number;
}

interface HealthState {
  // Health data
  stationHealth: Record<string, StationHealth>;
  stats: HealthStats;
  
  // Monitoring state
  isMonitoring: boolean;
  lastCheckTime: number | null;
  
  // Actions
  setStationHealth: (id: string, health: StationHealth) => void;
  setMultipleHealth: (updates: Array<{ id: string; health: StationHealth }>) => void;
  removeStationHealth: (id: string) => void;
  clearAllHealth: () => void;
  
  // Monitoring control
  setIsMonitoring: (monitoring: boolean) => void;
  setLastCheckTime: (time: number) => void;
  
  // Selectors
  getStationHealth: (id: string) => StationHealth | null;
  
  // Stats update
  updateStats: () => void;
}

const initialStats: HealthStats = {
  total: 0,
  healthy: 0,
  slow: 0,
  unstable: 0,
  offline: 0,
};

export const useHealthStore = create<HealthState>()(
  subscribeWithSelector((set, get) => ({
    stationHealth: {},
    stats: { ...initialStats },
    isMonitoring: false,
    lastCheckTime: null,
    
    setStationHealth: (id, health) => {
      set((state) => ({
        stationHealth: { ...state.stationHealth, [id]: health }
      }));
      // Debounce stats update
      get().updateStats();
    },
    
    setMultipleHealth: (updates) => {
      set((state) => {
        const newHealth = { ...state.stationHealth };
        for (const { id, health } of updates) {
          newHealth[id] = health;
        }
        return { stationHealth: newHealth };
      });
      get().updateStats();
    },
    
    removeStationHealth: (id) => {
      set((state) => {
        const newHealth = { ...state.stationHealth };
        delete newHealth[id];
        return { stationHealth: newHealth };
      });
      get().updateStats();
    },
    
    clearAllHealth: () => {
      set({ stationHealth: {}, stats: { ...initialStats } });
    },
    
    setIsMonitoring: (monitoring) => set({ isMonitoring: monitoring }),
    setLastCheckTime: (time) => set({ lastCheckTime: time }),
    
    getStationHealth: (id) => get().stationHealth[id] || null,
    
    updateStats: () => {
      const { stationHealth } = get();
      const stats: HealthStats = {
        total: 0,
        healthy: 0,
        slow: 0,
        unstable: 0,
        offline: 0,
      };
      
      for (const health of Object.values(stationHealth)) {
        stats.total++;
        if (!health.ok) {
          stats.offline++;
        } else if (health.latency === null) {
          stats.unstable++;
        } else if (health.latency < 200) {
          stats.healthy++;
        } else if (health.latency < 800) {
          stats.slow++;
        } else {
          stats.unstable++;
        }
      }
      
      set({ stats });
    },
  }))
);

// Selectors
export const selectStationHealth = (id: string) => (state: HealthState) => 
  state.stationHealth[id] || null;

export const selectHealthStats = (state: HealthState) => state.stats;
export const selectIsMonitoring = (state: HealthState) => state.isMonitoring;
