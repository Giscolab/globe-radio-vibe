// Geo module - Point in country detection using d3-geo
import { geoContains } from 'd3-geo';
import type { GeoPoint, CountryData } from '../../types';
import type { CountryIndex } from './countryIndex';
import { createLogger } from '../../core/logger';

const log = createLogger('geo:contains');

/**
 * Check if a point is inside a country using d3.geoContains
 */
export function pointInCountry(
  point: GeoPoint,
  country: CountryData
): boolean {
  return geoContains(country.feature, [point.lon, point.lat]);
}

/**
 * Find which country contains the given point
 * Uses spatial index for fast bbox filtering, then precise polygon check
 */
export function findCountryAtPoint(
  point: GeoPoint,
  index: CountryIndex
): CountryData | null {
  // First, get candidates from spatial index (bbox check)
  const candidates = index.getCandidates(point);
  
  if (candidates.length === 0) {
    log.debug('No country candidates at point', { point });
    return null;
  }
  
  // Then do precise point-in-polygon check
  for (const country of candidates) {
    if (pointInCountry(point, country)) {
      log.debug('Found country at point', { 
        point, 
        country: country.name 
      });
      return country;
    }
  }
  
  log.debug('Point not in any country polygon', { 
    point, 
    candidateCount: candidates.length 
  });
  return null;
}

/**
 * Batch check multiple points
 */
export function findCountriesForPoints(
  points: GeoPoint[],
  index: CountryIndex
): (CountryData | null)[] {
  return points.map(point => findCountryAtPoint(point, index));
}
