// Engine - Global Configuration: Centralized engine settings

export interface EngineConfig {
  // Audio
  audio: {
    fftSize: 256 | 512 | 1024 | 2048;
    smoothingTimeConstant: number;   // 0-1, higher = smoother
    targetFps: number;               // Target updates per second
    silenceThreshold: number;        // Volume below this = silence
    silenceDurationMs: number;       // Duration before silence detected
  };
  
  // Health monitoring
  health: {
    enabled: boolean;
    intervalMs: number;              // Check interval
    timeoutMs: number;               // Request timeout
    maxConcurrency: number;          // Parallel checks
    checkOnPlay: boolean;            // Check before playing
    checkFavorites: boolean;         // Monitor favorites
    checkHistory: boolean;           // Monitor recently played
    historyLimit: number;            // How many recent to monitor
  };
  
  // Enrichment
  enrichment: {
    extractColors: boolean;
    calculatePopularity: boolean;
    mapGenres: boolean;
    parseLocation: boolean;
    cacheColors: boolean;            // Use persistent color cache
    colorCacheTTLDays: number;
    batchSize: number;               // Parallel color extractions
  };
  
  // AI Search
  ai: {
    enabled: boolean;
    cacheResults: boolean;
    cacheTTLMs: number;
    syncOnLoad: boolean;             // Sync embeddings on station load
    syncBatchSize: number;
  };
  
  // Globe visualization
  globe: {
    targetFps: number;               // Animation FPS limit
    audioReactive: boolean;          // Enable audio reactivity
    audioSmoothingFactor: number;    // 0-1, audio response smoothing
    maxVisibleStations: number;      // Performance limit
    clusterAtZoom: number;           // Zoom level for clustering
  };
  
  // Debug
  debug: {
    logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
    showFPS: boolean;
    showHealthOverlay: boolean;
  };
}

// Default configuration
const defaultConfig: EngineConfig = {
  audio: {
    fftSize: 256,
    smoothingTimeConstant: 0.8,
    targetFps: 30,
    silenceThreshold: 0.01,
    silenceDurationMs: 3000,
  },
  
  health: {
    enabled: true,
    intervalMs: 60000,
    timeoutMs: 3000,
    maxConcurrency: 5,
    checkOnPlay: true,
    checkFavorites: true,
    checkHistory: true,
    historyLimit: 10,
  },
  
  enrichment: {
    extractColors: true,
    calculatePopularity: true,
    mapGenres: true,
    parseLocation: true,
    cacheColors: true,
    colorCacheTTLDays: 7,
    batchSize: 10,
  },
  
  ai: {
    enabled: true,
    cacheResults: true,
    cacheTTLMs: 5 * 60 * 1000, // 5 minutes
    syncOnLoad: true,
    syncBatchSize: 200,
  },
  
  globe: {
    targetFps: 30,
    audioReactive: true,
    audioSmoothingFactor: 0.3,
    maxVisibleStations: 5000,
    clusterAtZoom: 3,
  },
  
  debug: {
    logLevel: 'warn',
    showFPS: false,
    showHealthOverlay: false,
  },
};

// Current configuration (mutable singleton)
let currentConfig: EngineConfig = { ...defaultConfig };

/**
 * Get current engine configuration
 */
export function getEngineConfig(): Readonly<EngineConfig> {
  return currentConfig;
}

/**
 * Update engine configuration (partial update)
 */
export function setEngineConfig(config: DeepPartial<EngineConfig>): void {
  currentConfig = deepMerge(currentConfig, config);
}

/**
 * Reset to default configuration
 */
export function resetEngineConfig(): void {
  currentConfig = { ...defaultConfig };
}

/**
 * Get default configuration (immutable)
 */
export function getDefaultConfig(): Readonly<EngineConfig> {
  return defaultConfig;
}

// Helper types
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Helper function for deep merge
function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target } as T;
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (sourceValue === undefined) continue;

    if (isRecord(sourceValue) && isRecord(targetValue)) {
      result[key] = deepMerge(targetValue, sourceValue as DeepPartial<typeof targetValue>);
    } else {
      result[key] = sourceValue as T[typeof key];
    }
  }

  return result;
}
