// Engine core - Math utilities
import type { GeoPoint, GeoBounds } from '../types';

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;
export const EARTH_RADIUS = 6371; // km

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * DEG_TO_RAD;
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return radians * RAD_TO_DEG;
}

/**
 * Convert lat/lon to 3D cartesian coordinates on unit sphere
 */
export function latLonToXYZ(lat: number, lon: number, radius: number = 1): [number, number, number] {
  const phi = toRadians(90 - lat);
  const theta = toRadians(lon + 180);
  
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  
  return [x, y, z];
}

/**
 * Convert 3D cartesian coordinates to lat/lon
 */
export function xyzToLatLon(x: number, y: number, z: number): GeoPoint {
  const radius = Math.sqrt(x * x + y * y + z * z);
  const lat = toDegrees(Math.asin(y / radius));
  const lon = toDegrees(Math.atan2(-z, -x)) - 180;
  
  return { lat, lon: ((lon + 540) % 360) - 180 };
}

/**
 * Calculate haversine distance between two points (km)
 */
export function haversineDistance(p1: GeoPoint, p2: GeoPoint): number {
  const dLat = toRadians(p2.lat - p1.lat);
  const dLon = toRadians(p2.lon - p1.lon);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(p1.lat)) * Math.cos(toRadians(p2.lat)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
}

/**
 * Check if a point is within bounds
 */
export function isPointInBounds(point: GeoPoint, bounds: GeoBounds): boolean {
  return (
    point.lon >= bounds.minLon &&
    point.lon <= bounds.maxLon &&
    point.lat >= bounds.minLat &&
    point.lat <= bounds.maxLat
  );
}

/**
 * Calculate bounds from an array of coordinates
 */
export function calculateBounds(coordinates: [number, number][]): GeoBounds {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  
  for (const [lon, lat] of coordinates) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  
  return { minLon, maxLon, minLat, maxLat };
}

/**
 * Calculate centroid from bounds
 */
export function boundsCenter(bounds: GeoBounds): GeoPoint {
  return {
    lon: (bounds.minLon + bounds.maxLon) / 2,
    lat: (bounds.minLat + bounds.maxLat) / 2,
  };
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
