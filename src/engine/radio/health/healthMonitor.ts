// Engine - Health Monitor: periodic health checks with event system
import { checkStationsHealthBatch, StationHealth, getHealthTier } from './healthChecker';
import { createLogger } from '../../../engine/core/logger';

const log = createLogger('HealthMonitor');

type HealthUpdateCallback = (stationId: string, health: StationHealth) => void;

interface MonitoredStation {
  id: string;
  url: string;
  fallbackUrls: string[];
}

class HealthMonitor {
  private healthCache: Map<string, StationHealth> = new Map();
  private monitoredStations: Map<string, MonitoredStation> = new Map();
  private listeners: Set<HealthUpdateCallback> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private isPaused = false;
  private cursor = 0;

  constructor() {
    // Pause when tab is hidden to save resources
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.isPaused = document.hidden;
        if (!document.hidden && this.isRunning) {
          log.debug('Tab visible, resuming health checks');
        }
      });
    }
  }

  /**
   * Start periodic health monitoring
   */
  start(intervalMs = 120000): void { // 2 minutes instead of 1
    if (this.isRunning) return;
    
    this.isRunning = true;
    log.info(`Starting with ${intervalMs / 1000}s interval`);
    
    // Delay initial check to not block startup
    setTimeout(() => {
      if (this.isRunning && !this.isPaused) {
        this.checkAll();
      }
    }, 3000);
    
    // Periodic checks
    this.intervalId = setInterval(() => {
      if (!this.isPaused) {
        this.checkAll();
      }
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    log.info('Stopped');
  }

  /**
   * Register a station for monitoring
   */
  registerStation(id: string, url: string, fallbackUrls: string[] = []): void {
    this.monitoredStations.set(id, { id, url, fallbackUrls });
  }

  /**
   * Unregister a station
   */
  unregisterStation(id: string): void {
    this.monitoredStations.delete(id);
    this.healthCache.delete(id);
  }

  /**
   * Get cached health for a station
   */
  getHealth(stationId: string): StationHealth | null {
    return this.healthCache.get(stationId) || null;
  }

  /**
   * Subscribe to health updates
   */
  onUpdate(callback: HealthUpdateCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Check a specific station immediately
   */
  async checkStation(stationId: string): Promise<StationHealth | null> {
    const station = this.monitoredStations.get(stationId);
    if (!station) return null;

    const results = await checkStationsHealthBatch([{ id: station.id, url: station.url }]);
    const health = results.get(stationId);
    
    if (health) {
      this.updateHealth(stationId, health);
    }
    
    return health || null;
  }

  /**
   * Check a URL directly (for stations not yet registered)
   */
  async checkUrl(url: string, stationId?: string): Promise<StationHealth> {
    const id = stationId || 'temp';
    const results = await checkStationsHealthBatch([{ id, url }]);
    const health = results.get(id);
    
    if (health && stationId) {
      this.updateHealth(stationId, health);
    }
    
    return health || {
      ok: true,
      latency: null,
      lastChecked: Date.now(),
      error: 'Check unavailable',
    };
  }

  /**
   * Check all monitored stations using batch API
   */
  private async checkAll(): Promise<void> {
    const stations = Array.from(this.monitoredStations.values());
    
    if (stations.length === 0) return;

    // Limit to prevent overwhelming the backend
    const MAX_CHECKS_PER_CYCLE = 10;
    const count = Math.min(MAX_CHECKS_PER_CYCLE, stations.length);
    const stationsToCheck: MonitoredStation[] = [];

    for (let i = 0; i < count; i++) {
      stationsToCheck.push(stations[(this.cursor + i) % stations.length]);
    }

    this.cursor = (this.cursor + stationsToCheck.length) % stations.length;
    
    log.debug(`Checking ${stationsToCheck.length} stations`);

    try {
      const results = await checkStationsHealthBatch(
        stationsToCheck.map(s => ({ id: s.id, url: s.url }))
      );

      for (const [stationId, health] of results) {
        this.updateHealth(stationId, health);
      }
    } catch (error) {
      log.debug(`Batch check failed: ${error}`);
    }
  }

  /**
   * Update health and notify listeners
   */
  private updateHealth(stationId: string, health: StationHealth): void {
    const previousHealth = this.healthCache.get(stationId);
    this.healthCache.set(stationId, health);

    // Only log significant status changes
    if (previousHealth?.ok !== health.ok) {
      const tier = getHealthTier(health);
      log.info(`${stationId}: ${tier}${health.latency ? ` (${health.latency}ms)` : ''}`);
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(stationId, health);
      } catch (error) {
        log.debug(`Listener error: ${error}`);
      }
    }
  }

  /**
   * Get health statistics
   */
  getStats(): { total: number; healthy: number; slow: number; unstable: number; offline: number } {
    let healthy = 0, slow = 0, unstable = 0, offline = 0;
    
    for (const health of this.healthCache.values()) {
      const tier = getHealthTier(health);
      switch (tier) {
        case 'healthy': healthy++; break;
        case 'slow': slow++; break;
        case 'unstable': unstable++; break;
        case 'offline': offline++; break;
      }
    }
    
    return {
      total: this.healthCache.size,
      healthy,
      slow,
      unstable,
      offline
    };
  }

  /**
   * Clear all cached health data
   */
  clearCache(): void {
    this.healthCache.clear();
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitor();
