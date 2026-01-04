// Engine - Health Checker: ping stations via backend proxy

import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/engine/core/logger';

const log = createLogger('HealthChecker');

export interface StationHealth {
  ok: boolean;
  latency: number | null;
  lastChecked: number;
  error?: string;
  statusCode?: number;
}

interface HealthCheckResponse {
  results: Array<{
    id: string;
    ok: boolean;
    latency: number | null;
    lastChecked: number;
    error?: string;
    statusCode?: number;
  }>;
  error?: string;
}

/**
 * Check multiple stations health via backend proxy (bypasses CORS)
 */
export async function checkStationsHealthBatch(
  stations: Array<{ id: string; url: string }>,
  timeoutMs = 5000
): Promise<Map<string, StationHealth>> {
  const results = new Map<string, StationHealth>();

  if (stations.length === 0) return results;

  try {
    const { data, error } = await supabase.functions.invoke<HealthCheckResponse>('check-station-health', {
      body: { urls: stations, timeoutMs }
    });

    if (error) {
      log.warn(`Proxy error: ${error.message}`);
      // Mark all as unknown on proxy failure
      for (const station of stations) {
        results.set(station.id, {
          ok: true, // Assume ok to not block playback
          latency: null,
          lastChecked: Date.now(),
          error: 'Health check unavailable',
        });
      }
      return results;
    }

    if (data?.results) {
      for (const result of data.results) {
        results.set(result.id, {
          ok: result.ok,
          latency: result.latency,
          lastChecked: result.lastChecked,
          error: result.error,
          statusCode: result.statusCode,
        });
      }
    }

  } catch (err) {
    log.debug(`Batch check failed: ${err}`);
    // Graceful fallback - assume stations are ok
    for (const station of stations) {
      results.set(station.id, {
        ok: true,
        latency: null,
        lastChecked: Date.now(),
        error: 'Health check unavailable',
      });
    }
  }

  return results;
}

/**
 * Check single station health (uses batch internally)
 */
export async function checkStationHealth(
  url: string,
  timeoutMs = 5000,
  stationId = 'unknown'
): Promise<StationHealth> {
  const results = await checkStationsHealthBatch([{ id: stationId, url }], timeoutMs);
  return results.get(stationId) || {
    ok: true,
    latency: null,
    lastChecked: Date.now(),
    error: 'Health check unavailable',
  };
}

/**
 * Get health status tier based on latency
 */
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

/**
 * Check multiple URLs and return the first healthy one
 */
export async function findHealthyUrl(
  urls: string[], 
  timeoutMs = 5000
): Promise<{ url: string; health: StationHealth } | null> {
  const stations = urls.map((url, i) => ({ id: `url_${i}`, url }));
  const results = await checkStationsHealthBatch(stations, timeoutMs);
  
  for (let i = 0; i < urls.length; i++) {
    const health = results.get(`url_${i}`);
    if (health?.ok) {
      return { url: urls[i], health };
    }
  }
  return null;
}
