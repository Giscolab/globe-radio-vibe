// Geo module - Station clustering using supercluster
import Supercluster from 'supercluster';
import type { Station } from '../../types';
import type { Cluster, ClusterPoint } from '../../types';
import { createLogger } from '../../core/logger';

const log = createLogger('geo:clustering');

export interface ClusterOptions {
  radius?: number;
  maxZoom?: number;
  minZoom?: number;
  minPoints?: number;
}

const DEFAULT_OPTIONS: ClusterOptions = {
  radius: 60,
  maxZoom: 16,
  minZoom: 0,
  minPoints: 2,
};

/**
 * Station clustering manager
 */
export class StationCluster {
  private cluster: Supercluster;
  private points: ClusterPoint[] = [];

  constructor(options: ClusterOptions = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    this.cluster = new Supercluster({
      radius: opts.radius,
      maxZoom: opts.maxZoom,
      minZoom: opts.minZoom,
      minPoints: opts.minPoints,
    });
  }

  /**
   * Load stations into the cluster
   */
  loadStations(stations: Station[]): void {
    this.points = stations
      .filter(s => s.geo?.lat !== undefined && s.geo?.lon !== undefined)
      .map(station => ({
        id: station.id,
        coordinates: [station.geo!.lon, station.geo!.lat] as [number, number],
        properties: {
          name: station.name,
          genre: station.genre,
          country: station.country,
        },
      }));

    const geoJsonPoints = this.points.map(p => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: p.coordinates,
      },
      properties: { id: p.id, ...p.properties },
    }));

    this.cluster.load(geoJsonPoints);
    log.info('Stations loaded into cluster', { count: this.points.length });
  }

  /**
   * Get clusters for a given bounding box and zoom level
   */
  getClusters(
    bbox: [number, number, number, number], // [westLng, southLat, eastLng, northLat]
    zoom: number
  ): Cluster[] {
    const features = this.cluster.getClusters(bbox, Math.floor(zoom));
    
    return features.map(f => ({
      id: f.properties.cluster_id ?? f.properties.id,
      coordinates: f.geometry.coordinates as [number, number],
      properties: {
        cluster: !!f.properties.cluster,
        cluster_id: f.properties.cluster_id,
        point_count: f.properties.point_count,
        point_count_abbreviated: f.properties.point_count_abbreviated,
      },
    }));
  }

  /**
   * Get individual points from a cluster
   */
  getClusterLeaves(clusterId: number, limit: number = 100): ClusterPoint[] {
    const leaves = this.cluster.getLeaves(clusterId, limit);
    
    return leaves.map(f => ({
      id: f.properties.id,
      coordinates: f.geometry.coordinates as [number, number],
      properties: f.properties,
    }));
  }

  /**
   * Get zoom level at which cluster expands
   */
  getClusterExpansionZoom(clusterId: number): number {
    return this.cluster.getClusterExpansionZoom(clusterId);
  }

  /**
   * Get all points (unclustered)
   */
  getAllPoints(): ClusterPoint[] {
    return this.points;
  }

  /**
   * Clear cluster data
   */
  clear(): void {
    this.points = [];
    this.cluster.load([]);
  }
}
