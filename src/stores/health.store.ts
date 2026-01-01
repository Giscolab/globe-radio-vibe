// Store - Health: Station health monitoring state (optimized)
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { StationHealth } from '@/engine/radio/health';

// ============= Types =============
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
}

interface HealthActions {
  // Single station update
  setStationHealth: (id: string, health: StationHealth) => void;
  // Batch update (efficient for bulk operations)
  setMultipleHealth: (updates: Array<{ id: string; health: StationHealth }>) => void;
  // Removal
  removeStationHealth: (id: string) => void;
  clearAllHealth: () => void;
  
  // Monitoring control
  setIsMonitoring: (monitoring: boolean) => void;
  setLastCheckTime: (time: number) => void;
  
  // Getter (for imperative access)
  getStationHealth: (id: string) => StationHealth | null;
}

// ============= Initial State =============
const initialStats: HealthStats = {
  total: 0,
  healthy: 0,
  slow: 0,
  unstable: 0,
  offline: 0,
};

// ============= Pure Selectors (outside store) =============
function computeStats(stationHealth: Record<string, StationHealth>): HealthStats {
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
  
  return stats;
}

// ============= Debounced Stats Update =============
let statsUpdateTimer: ReturnType<typeof setTimeout> | null = null;
const STATS_DEBOUNCE_MS = 100;

function debouncedStatsUpdate(get: () => HealthState & HealthActions, set: (partial: Partial<HealthState>) => void) {
  if (statsUpdateTimer) {
    clearTimeout(statsUpdateTimer);
  }
  statsUpdateTimer = setTimeout(() => {
    const { stationHealth } = get();
    const stats = computeStats(stationHealth);
    set({ stats });
    statsUpdateTimer = null;
  }, STATS_DEBOUNCE_MS);
}

// ============= Store =============
export const useHealthStore = create<HealthState & HealthActions>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    stationHealth: {},
    stats: { ...initialStats },
    isMonitoring: false,
    lastCheckTime: null,
    
    // Single update with debounced stats
    setStationHealth: (id, health) => {
      set((state) => ({
        stationHealth: { ...state.stationHealth, [id]: health }
      }));
      debouncedStatsUpdate(get, set);
    },
    
    // Batch update (more efficient for bulk operations)
    setMultipleHealth: (updates) => {
      if (updates.length === 0) return;
      
      set((state) => {
        const newHealth = { ...state.stationHealth };
        for (const { id, health } of updates) {
          newHealth[id] = health;
        }
        return { stationHealth: newHealth };
      });
      debouncedStatsUpdate(get, set);
    },
    
    removeStationHealth: (id) => {
      set((state) => {
        const { [id]: _, ...rest } = state.stationHealth;
        return { stationHealth: rest };
      });
      debouncedStatsUpdate(get, set);
    },
    
    clearAllHealth: () => {
      if (statsUpdateTimer) {
        clearTimeout(statsUpdateTimer);
        statsUpdateTimer = null;
      }
      set({ stationHealth: {}, stats: { ...initialStats } });
    },
    
    setIsMonitoring: (monitoring) => set({ isMonitoring: monitoring }),
    setLastCheckTime: (time) => set({ lastCheckTime: time }),
    
    getStationHealth: (id) => get().stationHealth[id] || null,
  }))
);

// ============= Exported Selectors =============
export const selectStationHealth = (id: string) => (state: HealthState) => 
  state.stationHealth[id] || null;

export const selectHealthStats = (state: HealthState) => state.stats;
export const selectIsMonitoring = (state: HealthState) => state.isMonitoring;
export const selectLastCheckTime = (state: HealthState) => state.lastCheckTime;
