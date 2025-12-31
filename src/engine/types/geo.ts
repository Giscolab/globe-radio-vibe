// Engine types - Geo module
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';

export interface GeoPoint {
  lon: number;
  lat: number;
}

export interface GeoBounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

export interface CountryFeature extends Feature<Polygon | MultiPolygon> {
  properties: {
    name: string;
    iso_a2?: string;
    iso_a3?: string;
    continent?: string;
    pop_est?: number;
  };
}

export interface CountryData {
  id: string;
  name: string;
  iso2?: string;
  iso3?: string;
  continent?: string;
  bounds: GeoBounds;
  centroid: GeoPoint;
  feature: CountryFeature;
}

export interface WorldGeoData {
  countries: CountryData[];
  features: FeatureCollection;
}

export interface SpatialIndexItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  countryId: string;
}

export interface ClusterPoint {
  id: string;
  coordinates: [number, number]; // [lon, lat]
  properties: Record<string, unknown>;
}

export interface Cluster {
  id: number;
  coordinates: [number, number];
  properties: {
    cluster: boolean;
    cluster_id?: number;
    point_count?: number;
    point_count_abbreviated?: string;
  };
}
