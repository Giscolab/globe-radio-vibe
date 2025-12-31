// Component - ClusterMarker: instanced rendering for station clusters
import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { geoToSphere } from '@/engine/geo/projection/lonLat';
import type { Cluster } from '@/engine/types';

interface ClusterMarkerProps {
  clusters: Cluster[];
  globeRadius?: number;
  onClusterClick?: (clusterId: number) => void;
}

// Cluster colors based on point count
function getClusterColor(count: number): THREE.Color {
  if (count < 10) return new THREE.Color(0x3498db);      // Blue - small
  if (count < 50) return new THREE.Color(0x2ecc71);      // Green - medium
  if (count < 200) return new THREE.Color(0xf39c12);     // Orange - large
  return new THREE.Color(0xe74c3c);                       // Red - very large
}

// Cluster size based on point count (log scale)
function getClusterSize(count: number): number {
  return 0.02 + Math.log10(count + 1) * 0.015;
}

const BASE_SIZE = 0.02;

export function ClusterMarker({ 
  clusters, 
  globeRadius = 1,
  onClusterClick 
}: ClusterMarkerProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Filter to only actual clusters (not individual points)
  const clusterData = useMemo(() => {
    return clusters.filter(c => c.properties.cluster);
  }, [clusters]);

  // Create geometry and material
  const geometry = useMemo(() => new THREE.SphereGeometry(BASE_SIZE, 12, 12), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.85,
  }), []);

  // Update instance matrices and colors
  useEffect(() => {
    if (!meshRef.current || clusterData.length === 0) return;

    const mesh = meshRef.current;

    clusterData.forEach((cluster, i) => {
      const [lon, lat] = cluster.coordinates;
      const count = cluster.properties.point_count || 1;

      // Position on sphere surface
      const pos = geoToSphere({ lon, lat }, globeRadius + 0.01);
      dummy.position.set(pos[0], pos[1], pos[2]);
      
      // Scale based on cluster size
      const scale = getClusterSize(count) / BASE_SIZE;
      dummy.scale.setScalar(scale);
      
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Color based on cluster size
      const color = getClusterColor(count);
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [clusterData, globeRadius, dummy]);

  if (clusterData.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, clusterData.length]}
      frustumCulled={false}
    />
  );
}
