// Geo module - Projection utilities
import type { GeoPoint } from '../../types';
import { latLonToXYZ, xyzToLatLon } from '../../core/math';

/**
 * Convert lat/lon to 3D position on sphere
 */
export function geoToSphere(point: GeoPoint, radius: number = 1): [number, number, number] {
  return latLonToXYZ(point.lat, point.lon, radius);
}

/**
 * Convert 3D position on sphere to lat/lon
 */
export function sphereToGeo(x: number, y: number, z: number): GeoPoint {
  return xyzToLatLon(x, y, z);
}

/**
 * Project an array of coordinates onto sphere surface
 */
export function projectCoordinatesToSphere(
  coordinates: [number, number][],
  radius: number = 1
): Float32Array {
  const positions = new Float32Array(coordinates.length * 3);
  
  for (let i = 0; i < coordinates.length; i++) {
    const [lon, lat] = coordinates[i];
    const [x, y, z] = latLonToXYZ(lat, lon, radius);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  
  return positions;
}

/**
 * Convert screen coordinates to ray direction for picking
 */
export function screenToRay(
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  fov: number = 75
): [number, number, number] {
  const aspect = width / height;
  const fovRad = (fov * Math.PI) / 180;
  const tanFov = Math.tan(fovRad / 2);
  
  const x = ((2 * screenX) / width - 1) * aspect * tanFov;
  const y = (1 - (2 * screenY) / height) * tanFov;
  const z = -1;
  
  const len = Math.sqrt(x * x + y * y + z * z);
  return [x / len, y / len, z / len];
}
