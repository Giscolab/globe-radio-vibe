// Engine - Health Monitor: periodic health checks with event system
import { checkStationHealth, StationHealth, getHealthTier } from './healthChecker';
import { logger } from '../../core/logger';

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
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start periodic health monitoring
   */
  start(intervalMs = 60000): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('HealthMonitor', `Starting with ${intervalMs}ms interval`);
    
    // Initial check
    this.checkAll();
    
    // Periodic checks
    this.intervalId = setInterval(() => {
      this.checkAll();
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
    logger.info('HealthMonitor', 'Stopped');
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

    const health = await checkStationHealth(station.url);
    this.updateHealth(stationId, health);
    
    return health;
  }

  /**
   * Check a URL directly (for stations not yet registered)
   */
  async checkUrl(url: string, stationId?: string): Promise<StationHealth> {
    const health = await checkStationHealth(url);
    
    if (stationId) {
      this.updateHealth(stationId, health);
    }
    
    return health;
  }

  /**
   * Check all monitored stations
   */
  private async checkAll(): Promise<void> {
    const stations = Array.from(this.monitoredStations.values());
    
    // Check in parallel with concurrency limit
    const CONCURRENCY = 5;
    for (let i = 0; i < stations.length; i += CONCURRENCY) {
      const batch = stations.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (station) => {
          try {
            const health = await checkStationHealth(station.url);
            this.updateHealth(station.id, health);
          } catch (error) {
            logger.warn('HealthMonitor', `Check failed for ${station.id}: ${error}`);
          }
        })
      );
    }
  }

  /**
   * Update health and notify listeners
   */
  private updateHealth(stationId: string, health: StationHealth): void {
    const previousHealth = this.healthCache.get(stationId);
    this.healthCache.set(stationId, health);

    // Log status changes
    if (previousHealth?.ok !== health.ok) {
      const tier = getHealthTier(health);
      logger.info('HealthMonitor', `${stationId}: ${tier} (${health.latency}ms)`);
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(stationId, health);
      } catch (error) {
        logger.warn('HealthMonitor', `Listener error: ${error}`);
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
