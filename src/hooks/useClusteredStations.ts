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
  const stationsMapRef = useRef<Map<string, Station>>(new Map());

  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Recreate cluster when options change
  useEffect(() => {
    if (!enabled) {
      clusterRef.current = null;
      setClusters([]);
      setIsLoaded(false);
      return;
    }

    clusterRef.current = new StationCluster(clusterOptions);
    setClusters([]);
    setIsLoaded(false);

    return () => {
      clusterRef.current?.clear();
      clusterRef.current = null;
    };
  }, [enabled, JSON.stringify(clusterOptions)]);

  const loadStations = useCallback((stations: Station[]) => {
    if (!clusterRef.current) return;

    stationsMapRef.current.clear();
    stations.forEach(s => stationsMapRef.current.set(s.id, s));

    clusterRef.current.loadStations(stations);
    setIsLoaded(true);
  }, []);

  const getClustersForView = useCallback(
    (bbox: [number, number, number, number], zoom: number): Cluster[] => {
      if (!clusterRef.current || !isLoaded) return [];

      const result = clusterRef.current.getClusters(bbox, zoom);
      setClusters(result);
      return result;
    },
    [isLoaded]
  );

  const getClusterLeaves = useCallback((clusterId: number): Station[] => {
    if (!clusterRef.current) return [];

    return clusterRef.current
      .getClusterLeaves(clusterId)
      .map(p => stationsMapRef.current.get(p.id))
      .filter((s): s is Station => Boolean(s));
  }, []);

  const getExpansionZoom = useCallback((clusterId: number): number => {
    return clusterRef.current?.getClusterExpansionZoom(clusterId) ?? 16;
  }, []);

  const clear = useCallback(() => {
    clusterRef.current?.clear();
    clusterRef.current = null;
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
