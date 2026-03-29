import type { Station } from '@/engine/types/radio';

export const DEFAULT_WORLD_STATION_SAMPLE_SIZE = 500;
export const DEFAULT_WORLD_STATION_THRESHOLD_PERCENTAGE = 98;
export const DEFAULT_WORLD_STATION_TIMEOUT_MS = 10_000;
export const DEFAULT_WORLD_STATION_CONCURRENCY = 20;

const ACCEPTED_STREAM_CONTENT_TYPES = new Set([
  'application/hls+xml',
  'application/octet-stream',
  'application/ogg',
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
]);

export interface WorldStationVerificationResult {
  stationId: string;
  stationName: string;
  url: string;
  ok: boolean;
  latencyMs: number;
  statusCode: number | null;
  contentType: string | null;
  redirected: boolean;
  reason?: string;
  error?: string;
}

export interface WorldStationVerificationSummary {
  total: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  thresholdPercentage: number;
  meetsThreshold: boolean;
  failureReasons: Array<{ reason: string; count: number }>;
}

export interface VerifyWorldStationsOptions {
  sampleSize?: number;
  timeoutMs?: number;
  concurrency?: number;
  thresholdPercentage?: number;
  fetchImpl?: typeof fetch;
}

function normalizeContentType(contentType: string | null): string | null {
  if (!contentType) {
    return null;
  }

  const [rawType] = contentType.split(';', 1);
  const normalized = rawType.trim().toLowerCase();
  return normalized || null;
}

export function isAcceptedStreamContentType(contentType: string | null): boolean {
  const normalized = normalizeContentType(contentType);
  if (!normalized) {
    return false;
  }

  return normalized.startsWith('audio/') || ACCEPTED_STREAM_CONTENT_TYPES.has(normalized);
}

function isExplicitlyRejectedStreamContentType(contentType: string | null): boolean {
  const normalized = normalizeContentType(contentType);
  if (!normalized) {
    return false;
  }

  return (
    normalized.startsWith('text/') ||
    normalized === 'application/json' ||
    normalized.endsWith('+json') ||
    normalized === 'application/xml' ||
    normalized.endsWith('+xml') ||
    normalized === 'text/html'
  );
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel?.();
  } catch {
    // Ignore body cancellation failures.
  }
}

async function readFirstChunkByteLength(response: Response): Promise<number> {
  if (!response.body) {
    return 0;
  }

  const reader = response.body.getReader();
  try {
    const { done, value } = await reader.read();
    if (done || !value) {
      return 0;
    }

    return value.byteLength;
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Ignore cancellation failures after the first chunk.
    }

    try {
      reader.releaseLock();
    } catch {
      // Ignore release failures for already-cancelled readers.
    }
  }
}

function createFailureResult(
  station: Station,
  url: string,
  latencyMs: number,
  reason: string,
  details: {
    statusCode?: number | null;
    contentType?: string | null;
    redirected?: boolean;
    error?: string;
  } = {}
): WorldStationVerificationResult {
  return {
    stationId: station.id,
    stationName: station.name,
    url,
    ok: false,
    latencyMs,
    statusCode: details.statusCode ?? null,
    contentType: details.contentType ?? null,
    redirected: details.redirected ?? false,
    reason,
    error: details.error,
  };
}

function createSuccessResult(
  station: Station,
  url: string,
  latencyMs: number,
  response: Response
): WorldStationVerificationResult {
  return {
    stationId: station.id,
    stationName: station.name,
    url,
    ok: true,
    latencyMs,
    statusCode: response.status,
    contentType: normalizeContentType(response.headers.get('content-type')),
    redirected: response.redirected,
  };
}

export async function verifyWorldStationStream(
  station: Station,
  options?: Pick<VerifyWorldStationsOptions, 'timeoutMs' | 'fetchImpl'>
): Promise<WorldStationVerificationResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_WORLD_STATION_TIMEOUT_MS;
  const url = station.urlResolved || station.url;
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: '*/*',
      },
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    const contentType = normalizeContentType(response.headers.get('content-type'));

    if (!response.ok) {
      await cancelResponseBody(response);
      return createFailureResult(station, url, latencyMs, 'http_error', {
        statusCode: response.status,
        contentType,
        redirected: response.redirected,
        error: `HTTP ${response.status}`,
      });
    }

    if (isAcceptedStreamContentType(contentType)) {
      await cancelResponseBody(response);
      return createSuccessResult(station, url, latencyMs, response);
    }

    if (isExplicitlyRejectedStreamContentType(contentType)) {
      await cancelResponseBody(response);
      return createFailureResult(station, url, latencyMs, 'content_type_rejected', {
        statusCode: response.status,
        contentType,
        redirected: response.redirected,
        error: `Rejected content type: ${contentType}`,
      });
    }

    const firstChunkByteLength = await readFirstChunkByteLength(response);
    if (firstChunkByteLength > 0) {
      return createSuccessResult(station, url, latencyMs, response);
    }

    return createFailureResult(station, url, latencyMs, 'empty_body', {
      statusCode: response.status,
      contentType,
      redirected: response.redirected,
      error: 'Response body did not yield a readable first chunk.',
    });
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startedAt);

    if (error instanceof DOMException && error.name === 'AbortError') {
      return createFailureResult(station, url, latencyMs, 'timeout', {
        error: `Timed out after ${timeoutMs}ms`,
      });
    }

    return createFailureResult(station, url, latencyMs, 'network_error', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function selectWorldStationVerificationSample(
  stations: Station[],
  sampleSize = DEFAULT_WORLD_STATION_SAMPLE_SIZE
): Station[] {
  if (sampleSize <= 0 || stations.length === 0) {
    return [];
  }

  if (stations.length <= sampleSize) {
    return [...stations];
  }

  const selected: Station[] = [];

  for (let index = 0; index < sampleSize; index += 1) {
    const stationIndex = Math.floor(((index + 0.5) * stations.length) / sampleSize);
    selected.push(stations[Math.min(stations.length - 1, stationIndex)]);
  }

  return selected;
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<TResult>
): Promise<TResult[]> {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export function summarizeWorldStationVerification(
  results: WorldStationVerificationResult[],
  thresholdPercentage = DEFAULT_WORLD_STATION_THRESHOLD_PERCENTAGE
): WorldStationVerificationSummary {
  const successCount = results.filter((result) => result.ok).length;
  const failureCount = results.length - successCount;
  const successRate = results.length === 0 ? 0 : Number(((successCount / results.length) * 100).toFixed(2));
  const failureReasonCounts = new Map<string, number>();

  for (const result of results) {
    if (!result.ok) {
      const key = result.reason ?? 'unknown';
      failureReasonCounts.set(key, (failureReasonCounts.get(key) ?? 0) + 1);
    }
  }

  const failureReasons = Array.from(failureReasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));

  return {
    total: results.length,
    successCount,
    failureCount,
    successRate,
    thresholdPercentage,
    meetsThreshold: successRate >= thresholdPercentage,
    failureReasons,
  };
}

export async function verifyWorldStations(
  stations: Station[],
  options?: VerifyWorldStationsOptions
): Promise<{
  sample: Station[];
  results: WorldStationVerificationResult[];
  summary: WorldStationVerificationSummary;
}> {
  const sampleSize = options?.sampleSize ?? DEFAULT_WORLD_STATION_SAMPLE_SIZE;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_WORLD_STATION_TIMEOUT_MS;
  const concurrency = options?.concurrency ?? DEFAULT_WORLD_STATION_CONCURRENCY;
  const thresholdPercentage =
    options?.thresholdPercentage ?? DEFAULT_WORLD_STATION_THRESHOLD_PERCENTAGE;

  const sample = selectWorldStationVerificationSample(stations, sampleSize);
  const results = await mapWithConcurrency(sample, concurrency, (station) =>
    verifyWorldStationStream(station, {
      timeoutMs,
      fetchImpl: options?.fetchImpl,
    })
  );

  return {
    sample,
    results,
    summary: summarizeWorldStationVerification(results, thresholdPercentage),
  };
}
