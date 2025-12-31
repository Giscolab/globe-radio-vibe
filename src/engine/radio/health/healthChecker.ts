// Engine - Health Checker: ping stations and measure latency

export interface StationHealth {
  ok: boolean;
  latency: number | null;
  lastChecked: number;
  error?: string;
  statusCode?: number;
}

/**
 * Check station stream health by pinging the URL
 * Uses HEAD request first, falls back to GET if not supported
 */
export async function checkStationHealth(
  url: string, 
  timeoutMs = 3000
): Promise<StationHealth> {
  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Try HEAD first (lighter)
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors', // Many streaming servers don't allow CORS
      });
    } catch {
      // HEAD might not be supported, try GET with range
      response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        mode: 'no-cors',
        headers: {
          'Range': 'bytes=0-0' // Request minimal data
        }
      });
    }

    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - startTime);

    // In no-cors mode, we can't read status, but if we get here it's "ok"
    return {
      ok: true,
      latency,
      lastChecked: Date.now(),
      statusCode: response.status || 0,
    };

  } catch (error) {
    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - startTime);
    
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      ok: false,
      latency: latency < timeoutMs ? latency : null,
      lastChecked: Date.now(),
      error: errorMessage,
    };
  }
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
  timeoutMs = 3000
): Promise<{ url: string; health: StationHealth } | null> {
  for (const url of urls) {
    const health = await checkStationHealth(url, timeoutMs);
    if (health.ok) {
      return { url, health };
    }
  }
  return null;
}
