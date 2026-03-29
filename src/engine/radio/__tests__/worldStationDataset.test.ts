import { describe, expect, it } from 'vitest';
import {
  createWorldStationDatasetPayload,
  normalizeWorldStationDatasetPayload,
} from '@/engine/radio/dataset/worldStationDataset';

function createStation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'station-1',
    name: 'Test Radio',
    url: 'https://stream.test.example/live',
    country: 'France',
    countryCode: 'FR',
    tags: ['pop', 'rock'],
    bitrate: 128,
    geo: { lat: 48.8566, lon: 2.3522 },
    ...overrides,
  };
}

describe('worldStationDataset', () => {
  it('parses a valid enveloped payload', () => {
    const payload = createWorldStationDatasetPayload(
      [createStation(), createStation({ id: 'station-2', name: 'Second Radio' })],
      {
        version: '2026-03-29T00:00:00.000Z',
        generatedAt: '2026-03-29T00:00:00.000Z',
        source: 'RadioBrowser',
      }
    );

    expect(payload.total).toBe(2);
    expect(payload.stations[1].id).toBe('station-2');
  });

  it('accepts a legacy array payload and wraps it', () => {
    const payload = normalizeWorldStationDatasetPayload([createStation()], {
      acceptLegacyArray: true,
    });

    expect(payload.version).toBe('legacy');
    expect(payload.total).toBe(1);
    expect(payload.stations[0].id).toBe('station-1');
  });

  it('rejects an enveloped payload without stations', () => {
    expect(() =>
      normalizeWorldStationDatasetPayload({
        version: '2026-03-29T00:00:00.000Z',
        generatedAt: '2026-03-29T00:00:00.000Z',
        source: 'RadioBrowser',
        total: 0,
      })
    ).toThrow();
  });

  it('rejects a total mismatch', () => {
    expect(() =>
      normalizeWorldStationDatasetPayload({
        version: '2026-03-29T00:00:00.000Z',
        generatedAt: '2026-03-29T00:00:00.000Z',
        source: 'RadioBrowser',
        total: 2,
        stations: [createStation()],
      })
    ).toThrow(/Dataset total/);
  });

  it('rejects invalid station data', () => {
    expect(() =>
      normalizeWorldStationDatasetPayload({
        version: '2026-03-29T00:00:00.000Z',
        generatedAt: '2026-03-29T00:00:00.000Z',
        source: 'RadioBrowser',
        total: 1,
        stations: [createStation({ url: 'not-a-url' })],
      })
    ).toThrow();
  });

  it('sanitizes legacy empty optional fields before validation', () => {
    const payload = normalizeWorldStationDatasetPayload({
      version: '2026-03-29T00:00:00.000Z',
      generatedAt: '2026-03-29T00:00:00.000Z',
      source: 'RadioBrowser',
      total: 1,
      stations: [createStation({ countryCode: '', homepage: '', favicon: '' })],
    });

    expect(payload.stations[0].countryCode).toBeUndefined();
    expect(payload.stations[0].homepage).toBeUndefined();
    expect(payload.stations[0].favicon).toBeUndefined();
  });
});
