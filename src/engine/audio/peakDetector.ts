// Engine - Peak Detector: Stable beat/peak detection using EMA

export interface PeakState {
  isPeak: boolean;        // True when peak detected this frame
  energy: number;         // Current energy level (0-1)
  threshold: number;      // Current adaptive threshold
  confidence: number;     // Peak confidence (0-1)
  beatCount: number;      // Total beats detected
  bpm: number;            // Estimated BPM (if enough data)
}

interface PeakConfig {
  sensitivity: number;    // Peak sensitivity (0-1), higher = more peaks
  minInterval: number;    // Minimum ms between peaks
  emaAlpha: number;       // EMA smoothing factor
  thresholdMultiplier: number; // How much above average to trigger
}

const DEFAULT_CONFIG: PeakConfig = {
  sensitivity: 0.5,
  minInterval: 150,      // 400 BPM max
  emaAlpha: 0.15,        // Fairly slow decay
  thresholdMultiplier: 1.3,
};

class PeakDetector {
  private config: PeakConfig;
  
  // State
  private energyEMA = 0;
  private thresholdEMA = 0;
  private lastPeakTime = 0;
  private beatCount = 0;
  private beatTimes: number[] = [];

  constructor(config: Partial<PeakConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process audio data and detect peaks
   */
  process(volume: number, timestamp: number = Date.now()): PeakState {
    const { sensitivity, minInterval, emaAlpha, thresholdMultiplier } = this.config;
    
    // Update energy EMA
    this.energyEMA = this.energyEMA * (1 - emaAlpha) + volume * emaAlpha;
    
    // Calculate adaptive threshold
    const baseThreshold = this.energyEMA * thresholdMultiplier;
    const sensitivityFactor = 1 + (1 - sensitivity) * 0.5;
    this.thresholdEMA = baseThreshold * sensitivityFactor;
    
    // Check for peak
    const timeSinceLastPeak = timestamp - this.lastPeakTime;
    const isAboveThreshold = volume > this.thresholdEMA;
    const isMinIntervalPassed = timeSinceLastPeak >= minInterval;
    
    const isPeak = isAboveThreshold && isMinIntervalPassed && volume > 0.05;
    
    if (isPeak) {
      this.lastPeakTime = timestamp;
      this.beatCount++;
      
      // Track beat times for BPM calculation
      this.beatTimes.push(timestamp);
      if (this.beatTimes.length > 20) {
        this.beatTimes.shift();
      }
    }
    
    // Calculate confidence based on how much above threshold
    const confidence = isAboveThreshold 
      ? Math.min(1, (volume - this.thresholdEMA) / this.thresholdEMA + 0.5)
      : 0;
    
    return {
      isPeak,
      energy: this.energyEMA,
      threshold: this.thresholdEMA,
      confidence,
      beatCount: this.beatCount,
      bpm: this.calculateBPM(),
    };
  }

  /**
   * Calculate estimated BPM from beat times
   */
  private calculateBPM(): number {
    if (this.beatTimes.length < 4) return 0;
    
    // Calculate average interval between last beats
    const intervals: number[] = [];
    for (let i = 1; i < this.beatTimes.length; i++) {
      intervals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
    }
    
    // Remove outliers (intervals > 2x or < 0.5x median)
    intervals.sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)];
    const filtered = intervals.filter(i => i > median * 0.5 && i < median * 2);
    
    if (filtered.length < 3) return 0;
    
    const avgInterval = filtered.reduce((a, b) => a + b, 0) / filtered.length;
    return Math.round(60000 / avgInterval);
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<PeakConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.energyEMA = 0;
    this.thresholdEMA = 0;
    this.lastPeakTime = 0;
    this.beatCount = 0;
    this.beatTimes = [];
  }

  /**
   * Get current sensitivity
   */
  getSensitivity(): number {
    return this.config.sensitivity;
  }

  /**
   * Set sensitivity (0-1)
   */
  setSensitivity(value: number): void {
    this.config.sensitivity = Math.max(0, Math.min(1, value));
  }
}

// Singleton for global use
export const peakDetector = new PeakDetector();

// Factory for custom instances
export function createPeakDetector(config?: Partial<PeakConfig>): PeakDetector {
  return new PeakDetector(config);
}
