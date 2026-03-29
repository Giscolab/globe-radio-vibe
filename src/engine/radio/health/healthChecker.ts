import { createLogger } from '@/engine/core/logger';

const log = createLogger('HealthChecker');
const skippedProbeOrigins = new Set<string>();

export interface StationHealth {
  ok: boolean;
  latency: number | null;
  lastChecked: number;
  error?: string;
  statusCode?: number;
}

function buildUnavailableHealth(error: string): StationHealth {
  return {
    ok: true,
    latency: null,
    lastChecked: Date.now(),
    error,
  };
}

function shouldSkipProbe(url: string): boolean {
  if (typeof window === 'undefined' || !window.crossOriginIsolated) {
    return false;
  }

  try {
    const targetUrl = new URL(url, window.location.href);
    return targetUrl.origin !== window.location.origin;
  } catch {
    return false;
  }
}

async function probeStation(url: string, timeoutMs: number): Promise<StationHealth> {
  if (shouldSkipProbe(url)) {
    try {
      const origin = new URL(url, window.location.href).origin;
      if (!skippedProbeOrigins.has(origin)) {
        skippedProbeOrigins.add(origin);
        log.debug(`Skipping cross-origin probe under COEP for ${origin}`);
      }
    } catch {
      log.debug(`Skipping cross-origin probe under COEP for ${url}`);
    }

    return buildUnavailableHealth('Health check skipped under COEP');
  }

  const controller = new AbortController();
  const startedAt = performance.now();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });

    return {
      ok: true,
      latency: Math.round(performance.now() - startedAt),
      lastChecked: Date.now(),
    };
  } catch (error) {
    log.debug(`Health probe unavailable for ${url}: ${error}`);
    return buildUnavailableHealth('Health check unavailable');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkStationsHealthBatch(
  stations: Array<{ id: string; url: string }>,
  timeoutMs = 5000
): Promise<Map<string, StationHealth>> {
  const results = new Map<string, StationHealth>();

  if (stations.length === 0) {
    return results;
  }

  const checks = await Promise.all(
    stations.map(async (station) => ({
      id: station.id,
      health: await probeStation(station.url, timeoutMs),
    }))
  );

  for (const check of checks) {
    results.set(check.id, check.health);
  }

  return results;
}

export async function checkStationHealth(
  url: string,
  timeoutMs = 5000,
  stationId = 'unknown'
): Promise<StationHealth> {
  const results = await checkStationsHealthBatch([{ id: stationId, url }], timeoutMs);
  return results.get(stationId) || buildUnavailableHealth('Health check unavailable');
}

export function getHealthTier(health: StationHealth): 'healthy' | 'slow' | 'unstable' | 'offline' {
  if (!health.ok) {
    return 'offline';
  }

  if (health.latency === null) {
    return 'unstable';
  }

  if (health.latency < 200) {
    return 'healthy';
  }

  if (health.latency < 800) {
    return 'slow';
  }

  return 'unstable';
}

export async function findHealthyUrl(
  urls: string[],
  timeoutMs = 5000
): Promise<{ url: string; health: StationHealth } | null> {
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    const health = await checkStationHealth(url, timeoutMs, `url_${index}`);
    if (health.ok && health.latency !== null) {
      return { url, health };
    }
  }

  return null;
}
