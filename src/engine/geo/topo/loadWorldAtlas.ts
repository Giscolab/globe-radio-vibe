// Geo module - Load World Atlas TopoJSON
import { createLogger } from '../../core/logger';
import type { TopoJsonData } from './topoToGeo';

const log = createLogger('geo:loader');

// World Atlas TopoJSON CDN URLs
const WORLD_ATLAS_URLS = {
  countries110m: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
  countries50m: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json',
  countries10m: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json',
  land110m: 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json',
  land50m: 'https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json',
};

export type WorldAtlasResolution = keyof typeof WORLD_ATLAS_URLS;

async function fetchTopoJson(url: string, label: string): Promise<TopoJsonData> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load ${label}: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as TopoJsonData;
  log.info(`World Atlas loaded successfully`, {
    source: label,
    arcs: data.arcs?.length ?? 0,
  });

  return data;
}

/**
 * Load World Atlas TopoJSON from CDN with local fallback
 */
export async function loadWorldAtlas(
  resolution: WorldAtlasResolution = 'countries110m'
): Promise<TopoJsonData> {
  const url = WORLD_ATLAS_URLS[resolution];
  const localUrl = `/topojson/${resolution}.json`;
  log.info(`Loading World Atlas: ${resolution}`, { url, localUrl });

  try {
    return await fetchTopoJson(url, 'cdn');
  } catch (error) {
    log.warn('Failed to load World Atlas from CDN, trying local fallback', {
      resolution,
      error,
    });
    try {
      return await fetchTopoJson(localUrl, 'local');
    } catch (localError) {
      log.error('Failed to load World Atlas from CDN and local fallback', {
        resolution,
        error,
        localError,
      });
      throw localError;
    }
  }
}

/**
 * Load TopoJSON from a custom URL
 */
export async function loadTopoJson(url: string): Promise<TopoJsonData> {
  log.info(`Loading TopoJSON from: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load TopoJSON: ${response.status}`);
  }

  return response.json();
}
