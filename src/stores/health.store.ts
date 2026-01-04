// Store - Health: Station health monitoring state (atomic updates)
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
  stationHealth: Record<string, StationHealth>;
  stats: HealthStats;
  isMonitoring: boolean;
  lastCheckTime: number | null;
}

interface HealthActions {
  setStationHealth: (id: string, health: StationHealth) => void;
  setMultipleHealth: (updates: Array<{ id: string; health: StationHealth }>) => void;
  removeStationHealth: (id: string) => void;
  clearAllHealth: () => void;
  setIsMonitoring: (v: boolean) => void;
  setLastCheckTime: (t: number) => void;
  getStationHealth: (id: string) => StationHealth | null;
}

// ============= Constants =============
const emptyStats: HealthStats = {
  total: 0,
  healthy: 0,
  slow: 0,
  unstable: 0,
  offline: 0,
};

// ============= Pure function: compute stats from health map =============
function computeStats(healthMap: Record<string, StationHealth>): HealthStats {
  const stats: HealthStats = { total: 0, healthy: 0, slow: 0, unstable: 0, offline: 0 };

  for (const h of Object.values(healthMap)) {
    stats.total++;
    if (!h.ok) stats.offline++;
    else if (h.latency == null) stats.unstable++;
    else if (h.latency < 200) stats.healthy++;
    else if (h.latency < 800) stats.slow++;
    else stats.unstable++;
  }

  return stats;
}

// ============= Store =============
export const useHealthStore = create<HealthState & HealthActions>()(
  subscribeWithSelector((set, get) => ({
    stationHealth: {},
    stats: emptyStats,
    isMonitoring: false,
    lastCheckTime: null,

    // Single atomic set with inline stats computation
    setStationHealth: (id, health) =>
      set((state) => {
        const next = { ...state.stationHealth, [id]: health };
        return { stationHealth: next, stats: computeStats(next) };
      }),

    // Batch update in single set
    setMultipleHealth: (updates) => {
      if (updates.length === 0) return;
      set((state) => {
        const next = { ...state.stationHealth };
        for (const { id, health } of updates) {
          next[id] = health;
        }
        return { stationHealth: next, stats: computeStats(next) };
      });
    },

    removeStationHealth: (id) =>
      set((state) => {
        const { [id]: _, ...rest } = state.stationHealth;
        return { stationHealth: rest, stats: computeStats(rest) };
      }),

    clearAllHealth: () =>
      set({ stationHealth: {}, stats: { ...emptyStats } }),

    setIsMonitoring: (v) => set({ isMonitoring: v }),
    setLastCheckTime: (t) => set({ lastCheckTime: t }),

    getStationHealth: (id) => get().stationHealth[id] ?? null,
  }))
);

// ============= Selectors =============
export const selectStationHealth = (id: string) => (s: HealthState) =>
  s.stationHealth[id] ?? null;

export const selectHealthStats = (s: HealthState) => s.stats;
export const selectIsMonitoring = (s: HealthState) => s.isMonitoring;
export const selectLastCheckTime = (s: HealthState) => s.lastCheckTime;
