// Geo module - Country spatial index using rbush
import RBush from 'rbush';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { CountryData, SpatialIndexItem, GeoBounds, GeoPoint } from '../../types';
import { calculateBounds, boundsCenter } from '../../core/math';
import { createLogger } from '../../core/logger';
import { getAlpha2Code } from './isoMapping';

const log = createLogger('geo:countryIndex');

/**
 * Extract all coordinates from a polygon or multipolygon
 */
function extractCoordinates(geometry: Polygon | MultiPolygon): [number, number][] {
  const coords: [number, number][] = [];
  
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      for (const coord of ring) {
        coords.push([coord[0], coord[1]]);
      }
    }
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const coord of ring) {
          coords.push([coord[0], coord[1]]);
        }
      }
    }
  }
  
  return coords;
}

/**
 * Country spatial index for fast lookup
 */
export class CountryIndex {
  private tree: RBush<SpatialIndexItem>;
  private countries: Map<string, CountryData> = new Map();

  constructor() {
    this.tree = new RBush();
  }

  /**
   * Build index from GeoJSON features
   */
  buildFromFeatures(features: Feature<Polygon | MultiPolygon>[]): void {
    log.info('Building country index', { featureCount: features.length });
    
    const items: SpatialIndexItem[] = [];
    
    for (const feature of features) {
      const id = String(feature.id ?? feature.properties?.name ?? Math.random());
      const name = String(feature.properties?.name ?? 'Unknown');
      const coords = extractCoordinates(feature.geometry);
      
      if (coords.length === 0) continue;
      
      const bounds = calculateBounds(coords);
      const centroid = boundsCenter(bounds);
      
      // Try to get iso2 from properties first, then from numeric ID mapping
      const iso2 = feature.properties?.iso_a2 || getAlpha2Code(id);
      
      const countryData: CountryData = {
        id,
        name,
        iso2,
        iso3: feature.properties?.iso_a3,
        continent: feature.properties?.continent,
        bounds,
        centroid,
        feature: feature as CountryData['feature'],
      };
      
      log.debug('Country indexed', { id, name, iso2 });
      
      this.countries.set(id, countryData);
      
      items.push({
        minX: bounds.minLon,
        minY: bounds.minLat,
        maxX: bounds.maxLon,
        maxY: bounds.maxLat,
        countryId: id,
      });
    }
    
    this.tree.load(items);
    log.info('Country index built', { indexedCountries: this.countries.size });
  }

  /**
   * Get countries whose bounding box contains the point
   */
  getCandidates(point: GeoPoint): CountryData[] {
    const results = this.tree.search({
      minX: point.lon,
      minY: point.lat,
      maxX: point.lon,
      maxY: point.lat,
    });
    
    return results
      .map(item => this.countries.get(item.countryId))
      .filter((c): c is CountryData => c !== undefined);
  }

  /**
   * Get country by ID
   */
  getCountry(id: string): CountryData | undefined {
    return this.countries.get(id);
  }

  /**
   * Get all countries
   */
  getAllCountries(): CountryData[] {
    return Array.from(this.countries.values());
  }

  /**
   * Get country by ISO2 code (e.g., 'FR', 'US')
   */
  getCountryByIso2(iso2: string): CountryData | undefined {
    const upperIso2 = iso2.toUpperCase();
    return Array.from(this.countries.values()).find(c => c.iso2?.toUpperCase() === upperIso2);
  }

  /**
   * Get countries within bounds
   */
  getCountriesInBounds(bounds: GeoBounds): CountryData[] {
    const results = this.tree.search({
      minX: bounds.minLon,
      minY: bounds.minLat,
      maxX: bounds.maxLon,
      maxY: bounds.maxLat,
    });
    
    return results
      .map(item => this.countries.get(item.countryId))
      .filter((c): c is CountryData => c !== undefined);
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.tree.clear();
    this.countries.clear();
  }
}
