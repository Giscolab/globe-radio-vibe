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
  const clusterOptionsKey = useMemo(() => JSON.stringify(clusterOptions), [clusterOptions]);

  const clusterRef = useRef<StationCluster | null>(null);
  const stationsMapRef = useRef<Map<string, Station>>(new Map());

  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Init / reset cluster
  useEffect(() => {
    if (!enabled) {
      clusterRef.current = null;
      setClusters([]);
      setIsLoaded(false);
      return;
    }

    const parsedOptions = JSON.parse(clusterOptionsKey) as ClusterOptions;
    clusterRef.current = new StationCluster(parsedOptions);
    setClusters([]);
    setIsLoaded(false);

    return () => {
      clusterRef.current?.clear();
      clusterRef.current = null;
    };
  }, [enabled, clusterOptionsKey]);

  // Load stations ONCE
  const loadStations = useCallback((stations: Station[]) => {
    if (!clusterRef.current) return;

    stationsMapRef.current.clear();
    stations.forEach(s => stationsMapRef.current.set(s.id, s));

    clusterRef.current.loadStations(stations);

    // ← C’EST ICI qu’on met à jour le state
    setClusters(clusterRef.current.getClusters([-180, -85, 180, 85], 0));
    setIsLoaded(true);
  }, []);

  // PURE function
  const getClustersForView = useCallback(
    (bbox: [number, number, number, number], zoom: number): Cluster[] => {
      if (!clusterRef.current || !isLoaded) return [];
      return clusterRef.current.getClusters(bbox, zoom);
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

  const getExpansionZoom = useCallback(
    (clusterId: number): number =>
      clusterRef.current?.getClusterExpansionZoom(clusterId) ?? 16,
    []
  );

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
