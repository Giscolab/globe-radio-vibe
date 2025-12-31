// Engine - Player Metrics
import { logger } from '../core/logger';

export interface PlayerMetricsData {
  playCount: number;
  errorCount: number;
  retryCount: number;
  totalPlayTimeMs: number;
  stationsPlayed: Set<string>;
  lastPlayedStationId: string | null;
  lastPlayedAt: Date | null;
}

class PlayerMetrics {
  private data: PlayerMetricsData = {
    playCount: 0,
    errorCount: 0,
    retryCount: 0,
    totalPlayTimeMs: 0,
    stationsPlayed: new Set(),
    lastPlayedStationId: null,
    lastPlayedAt: null,
  };

  recordPlay(stationId: string): void {
    this.data.playCount++;
    this.data.stationsPlayed.add(stationId);
    this.data.lastPlayedStationId = stationId;
    this.data.lastPlayedAt = new Date();
    logger.debug('PlayerMetrics', `Play recorded for ${stationId}, total: ${this.data.playCount}`);
  }

  recordError(stationId: string): void {
    this.data.errorCount++;
    logger.debug('PlayerMetrics', `Error recorded for ${stationId}, total: ${this.data.errorCount}`);
  }

  recordRetry(): void {
    this.data.retryCount++;
    logger.debug('PlayerMetrics', `Retry recorded, total: ${this.data.retryCount}`);
  }

  recordPlayTime(stationId: string, durationMs: number): void {
    this.data.totalPlayTimeMs += durationMs;
    logger.debug('PlayerMetrics', `Play time recorded for ${stationId}: ${durationMs}ms`);
  }

  getMetrics(): {
    playCount: number;
    errorCount: number;
    retryCount: number;
    totalPlayTimeMs: number;
    uniqueStationsCount: number;
    lastPlayedStationId: string | null;
    lastPlayedAt: string | null;
  } {
    return {
      playCount: this.data.playCount,
      errorCount: this.data.errorCount,
      retryCount: this.data.retryCount,
      totalPlayTimeMs: this.data.totalPlayTimeMs,
      uniqueStationsCount: this.data.stationsPlayed.size,
      lastPlayedStationId: this.data.lastPlayedStationId,
      lastPlayedAt: this.data.lastPlayedAt?.toISOString() || null,
    };
  }

  reset(): void {
    this.data = {
      playCount: 0,
      errorCount: 0,
      retryCount: 0,
      totalPlayTimeMs: 0,
      stationsPlayed: new Set(),
      lastPlayedStationId: null,
      lastPlayedAt: null,
    };
    logger.info('PlayerMetrics', 'Metrics reset');
  }
}

export const playerMetrics = new PlayerMetrics();
