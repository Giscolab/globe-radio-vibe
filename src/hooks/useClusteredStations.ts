// Hook - useClusteredStations: manage clustering for large station sets
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { StationCluster, type ClusterOptions } from '@/engine/geo/clustering/stationCluster';
import type { Station, Cluster } from '@/engine/types';

interface UseClusteredStationsOptions extends ClusterOptions {
  enabled?: boolean;
}

interface UseClusteredStationsResult {
  clusters: Cluster[];
  isLoaded: boolean;
  loadStations: (stations: Station[]) => void;
  getClustersForView: (bbox: [number, number, number, number], zoom: number) => Cluster[];
  getClusterLeaves: (clusterId: number) => Station[];
  getExpansionZoom: (clusterId: number) => number;
  clear: () => void;
}

export function useClusteredStations(
  options: UseClusteredStationsOptions = {}
): UseClusteredStationsResult {
  const { enabled = true, ...clusterOptions } = options;
  
  const clusterRef = useRef<StationCluster | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const stationsMapRef = useRef<Map<string, Station>>(new Map());

  // Initialize cluster instance
  useEffect(() => {
    if (enabled && !clusterRef.current) {
      clusterRef.current = new StationCluster(clusterOptions);
    }
    
    return () => {
      if (clusterRef.current) {
        clusterRef.current.clear();
      }
    };
  }, [enabled]);

  // Load stations into cluster
  const loadStations = useCallback((stations: Station[]) => {
    if (!clusterRef.current || !enabled) return;
    
    // Store stations for later lookup
    stationsMapRef.current.clear();
    stations.forEach(s => stationsMapRef.current.set(s.id, s));
    
    clusterRef.current.loadStations(stations);
    setIsLoaded(true);
  }, [enabled]);

  // Get clusters for current viewport
  const getClustersForView = useCallback((
    bbox: [number, number, number, number], 
    zoom: number
  ): Cluster[] => {
    if (!clusterRef.current || !isLoaded) return [];
    
    const result = clusterRef.current.getClusters(bbox, zoom);
    setClusters(result);
    return result;
  }, [isLoaded]);

  // Get individual stations from a cluster
  const getClusterLeaves = useCallback((clusterId: number): Station[] => {
    if (!clusterRef.current) return [];
    
    const points = clusterRef.current.getClusterLeaves(clusterId);
    return points
      .map(p => stationsMapRef.current.get(p.id))
      .filter((s): s is Station => s !== undefined);
  }, []);

  // Get zoom level for cluster expansion
  const getExpansionZoom = useCallback((clusterId: number): number => {
    if (!clusterRef.current) return 16;
    return clusterRef.current.getClusterExpansionZoom(clusterId);
  }, []);

  // Clear all data
  const clear = useCallback(() => {
    if (clusterRef.current) {
      clusterRef.current.clear();
    }
    stationsMapRef.current.clear();
    setClusters([]);
    setIsLoaded(false);
  }, []);

  return {
    clusters,
    isLoaded,
    loadStations,
    getClustersForView,
    getClusterLeaves,
    getExpansionZoom,
    clear,
  };
}
