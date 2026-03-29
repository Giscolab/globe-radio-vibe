import { describe, expect, it, vi } from 'vitest';
import {
  selectWorldStationVerificationSample,
  summarizeWorldStationVerification,
  verifyWorldStationStream,
} from '@/engine/radio/dataset/worldStationVerification';

function createStation(index = 1) {
  return {
    id: `station-${index}`,
    name: `Station ${index}`,
    url: `https://stream.test.example/${index}`,
    country: 'France',
    countryCode: 'FR',
    tags: ['pop'],
  };
}

describe('worldStationVerification', () => {
  it('uses GET with redirect follow and succeeds on accepted stream content types', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          'content-type': 'audio/mpeg',
        },
      })
    );

    const result = await verifyWorldStationStream(createStation(), {
      fetchImpl,
      timeoutMs: 100,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://stream.test.example/1',
      expect.objectContaining({
        method: 'GET',
        redirect: 'follow',
      })
    );
    expect(result.ok).toBe(true);
    expect(result.contentType).toBe('audio/mpeg');
  });

  it('accepts common HLS content types', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('#EXTM3U', {
        status: 200,
        headers: {
          'content-type': 'application/hls+xml',
        },
      })
    );

    const result = await verifyWorldStationStream(createStation(), {
      fetchImpl,
      timeoutMs: 100,
    });

    expect(result.ok).toBe(true);
    expect(result.contentType).toBe('application/hls+xml');
  });

  it('fails on explicitly rejected content types', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('not a stream', {
        status: 200,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
        },
      })
    );

    const result = await verifyWorldStationStream(createStation(), {
      fetchImpl,
      timeoutMs: 100,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('content_type_rejected');
  });

  it('falls back to the first readable chunk when the content type is not explicit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
      })
    );

    const result = await verifyWorldStationStream(createStation(), {
      fetchImpl,
      timeoutMs: 100,
    });

    expect(result.ok).toBe(true);
  });

  it('reports timeouts', async () => {
    const fetchImpl: typeof fetch = ((_, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true }
        );
      })) as typeof fetch;

    const result = await verifyWorldStationStream(createStation(), {
      fetchImpl,
      timeoutMs: 10,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('timeout');
  });

  it('applies the 98 percent threshold correctly', () => {
    const ninetyEightPercent = summarizeWorldStationVerification(
      Array.from({ length: 100 }, (_, index) => ({
        stationId: `station-${index}`,
        stationName: `Station ${index}`,
        url: `https://stream.test.example/${index}`,
        ok: index < 98,
        latencyMs: 50,
        statusCode: 200,
        contentType: 'audio/mpeg',
        redirected: false,
        reason: index < 98 ? undefined : 'network_error',
      })),
      98
    );
    const underThreshold = summarizeWorldStationVerification(
      Array.from({ length: 100 }, (_, index) => ({
        stationId: `station-${index}`,
        stationName: `Station ${index}`,
        url: `https://stream.test.example/${index}`,
        ok: index < 97,
        latencyMs: 50,
        statusCode: 200,
        contentType: 'audio/mpeg',
        redirected: false,
        reason: index < 97 ? undefined : 'network_error',
      })),
      98
    );

    expect(ninetyEightPercent.meetsThreshold).toBe(true);
    expect(underThreshold.meetsThreshold).toBe(false);
  });

  it('selects a deterministic 500-station sample', () => {
    const stations = Array.from({ length: 1000 }, (_, index) => createStation(index));

    const firstSample = selectWorldStationVerificationSample(stations, 500);
    const secondSample = selectWorldStationVerificationSample(stations, 500);

    expect(firstSample).toHaveLength(500);
    expect(new Set(firstSample.map((station) => station.id)).size).toBe(500);
    expect(firstSample.map((station) => station.id)).toEqual(
      secondSample.map((station) => station.id)
    );
    expect(firstSample[0].id).toBe('station-1');
    expect(firstSample.at(-1)?.id).toBe('station-999');
  });
});
