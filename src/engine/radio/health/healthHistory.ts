// Engine - Health History: track health events over time

export interface HealthEvent {
  stationId: string;
  timestamp: number;
  ok: boolean;
  latency: number | null;
  error?: string;
}

const MAX_HISTORY_SIZE = 1000;
const MAX_STATION_HISTORY = 50;
const STORAGE_KEY = 'radio_health_history';

class HealthHistory {
  private events: HealthEvent[] = [];
  private stationEvents: Map<string, HealthEvent[]> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Record a health event
   */
  record(event: Omit<HealthEvent, 'timestamp'>): void {
    const fullEvent: HealthEvent = {
      ...event,
      timestamp: Date.now(),
    };

    // Add to global history
    this.events.push(fullEvent);
    if (this.events.length > MAX_HISTORY_SIZE) {
      this.events = this.events.slice(-MAX_HISTORY_SIZE);
    }

    // Add to station-specific history
    let stationHistory = this.stationEvents.get(event.stationId);
    if (!stationHistory) {
      stationHistory = [];
      this.stationEvents.set(event.stationId, stationHistory);
    }
    stationHistory.push(fullEvent);
    if (stationHistory.length > MAX_STATION_HISTORY) {
      this.stationEvents.set(
        event.stationId, 
        stationHistory.slice(-MAX_STATION_HISTORY)
      );
    }

    // Persist (debounced would be better in production)
    this.saveToStorage();
  }

  /**
   * Get all events for a station
   */
  getStationHistory(stationId: string): HealthEvent[] {
    return this.stationEvents.get(stationId) || [];
  }

  /**
   * Get recent events (last N)
   */
  getRecentEvents(limit = 50): HealthEvent[] {
    return this.events.slice(-limit).reverse();
  }

  /**
   * Get outage events (ok === false)
   */
  getOutages(limit = 20): HealthEvent[] {
    return this.events
      .filter(e => !e.ok)
      .slice(-limit)
      .reverse();
  }

  /**
   * Calculate uptime percentage for a station
   */
  getUptimePercentage(stationId: string, periodMs = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - periodMs;
    const history = this.getStationHistory(stationId).filter(e => e.timestamp >= cutoff);
    
    if (history.length === 0) return 100;
    
    const okCount = history.filter(e => e.ok).length;
    return Math.round((okCount / history.length) * 100);
  }

  /**
   * Calculate average latency for a station
   */
  getAverageLatency(stationId: string, periodMs = 60 * 60 * 1000): number | null {
    const cutoff = Date.now() - periodMs;
    const history = this.getStationHistory(stationId)
      .filter(e => e.timestamp >= cutoff && e.ok && e.latency !== null);
    
    if (history.length === 0) return null;
    
    const sum = history.reduce((acc, e) => acc + (e.latency || 0), 0);
    return Math.round(sum / history.length);
  }

  /**
   * Get stations with most outages
   */
  getProblematicStations(limit = 10): Array<{ stationId: string; outageCount: number }> {
    const outageCount = new Map<string, number>();
    
    for (const event of this.events) {
      if (!event.ok) {
        outageCount.set(event.stationId, (outageCount.get(event.stationId) || 0) + 1);
      }
    }
    
    return Array.from(outageCount.entries())
      .map(([stationId, count]) => ({ stationId, outageCount: count }))
      .sort((a, b) => b.outageCount - a.outageCount)
      .slice(0, limit);
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.events = [];
    this.stationEvents.clear();
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Load history from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.events = data.events || [];
        
        // Rebuild station map
        for (const event of this.events) {
          let stationHistory = this.stationEvents.get(event.stationId);
          if (!stationHistory) {
            stationHistory = [];
            this.stationEvents.set(event.stationId, stationHistory);
          }
          stationHistory.push(event);
        }
      }
    } catch (error) {
      console.warn('HealthHistory: Failed to load from storage', error);
    }
  }

  /**
   * Save history to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = {
        events: this.events.slice(-500), // Only persist recent events
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('HealthHistory: Failed to save to storage', error);
    }
  }
}

// Singleton instance
export const healthHistory = new HealthHistory();
