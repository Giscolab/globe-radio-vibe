// Geo module - TopoJSON to GeoJSON conversion
import type { FeatureCollection, Geometry } from 'geojson';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { createLogger } from '../../core/logger';

const log = createLogger('geo:topo');

export interface TopoJsonData extends Topology {
  objects: {
    countries?: GeometryCollection;
    land?: GeometryCollection;
    [key: string]: GeometryCollection | undefined;
  };
}

/**
 * Convert TopoJSON to GeoJSON FeatureCollection
 */
export function topoToGeoJson(
  topo: TopoJsonData, 
  objectKey: string = 'countries'
): FeatureCollection {
  const object = topo.objects[objectKey];
  
  if (!object) {
    log.error(`Object key "${objectKey}" not found in TopoJSON`, { 
      availableKeys: Object.keys(topo.objects) 
    });
    throw new Error(`Object key "${objectKey}" not found in TopoJSON`);
  }

  const features = topojson.feature(topo, object) as FeatureCollection;
  log.info(`Converted TopoJSON to GeoJSON`, { 
    featureCount: features.features.length,
    objectKey 
  });
  
  return features;
}

/**
 * Extract mesh (borders) from TopoJSON
 */
export function extractMesh(
  topo: TopoJsonData, 
  objectKey: string = 'countries'
): Geometry {
  const object = topo.objects[objectKey];
  
  if (!object) {
    throw new Error(`Object key "${objectKey}" not found in TopoJSON`);
  }

  return topojson.mesh(topo, object);
}

/**
 * Extract external mesh (coastlines only)
 */
export function extractExternalMesh(
  topo: TopoJsonData,
  objectKey: string = 'countries'
): Geometry {
  const object = topo.objects[objectKey];
  
  if (!object) {
    throw new Error(`Object key "${objectKey}" not found in TopoJSON`);
  }

  return topojson.mesh(topo, object, (a, b) => a === b);
}

/**
 * Extract internal mesh (shared borders only)
 */
export function extractInternalMesh(
  topo: TopoJsonData,
  objectKey: string = 'countries'
): Geometry {
  const object = topo.objects[objectKey];
  
  if (!object) {
    throw new Error(`Object key "${objectKey}" not found in TopoJSON`);
  }

  return topojson.mesh(topo, object, (a, b) => a !== b);
}
