// Component - StationsLayer: instanced rendering of station points on globe
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Station, normalizeGenre } from '@/engine/types/radio';
import { geoToSphere } from '@/engine/geo/projection/lonLat';

interface StationsLayerProps {
  stations: Station[];
  currentStationId?: string | null;
  globeRadius?: number;
}

const GENRE_COLORS: Record<string, THREE.Color> = {
  pop: new THREE.Color(0xff6b9d),
  rock: new THREE.Color(0xff4444),
  jazz: new THREE.Color(0x9b59b6),
  classical: new THREE.Color(0x3498db),
  electronic: new THREE.Color(0x00ff88),
  hiphop: new THREE.Color(0xf39c12),
  country: new THREE.Color(0x8b4513),
  other: new THREE.Color(0x95a5a6),
};

const POINT_SIZE = 0.015;
const ACTIVE_SCALE = 2.5;

export function StationsLayer({ stations, currentStationId, globeRadius = 1 }: StationsLayerProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const activeIndexRef = useRef<number>(-1);
  const timeRef = useRef(0);

  // Filter stations with valid geo coordinates
  const geoStations = useMemo(() => {
    return stations.filter(s => s.geo?.lat != null && s.geo?.lon != null);
  }, [stations]);

  // Create geometry and material
  const geometry = useMemo(() => new THREE.SphereGeometry(POINT_SIZE, 8, 8), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.9,
  }), []);

  // Update instance matrices and colors
  useEffect(() => {
    if (!meshRef.current || geoStations.length === 0) return;

    const mesh = meshRef.current;
    activeIndexRef.current = -1;

    geoStations.forEach((station, i) => {
      if (!station.geo) return;

      // Position on sphere surface
      const pos = geoToSphere({ lon: station.geo.lon, lat: station.geo.lat }, globeRadius + 0.005);
      dummy.position.set(pos[0], pos[1], pos[2]);
      
      // Scale based on active state
      const isActive = station.id === currentStationId;
      if (isActive) {
        activeIndexRef.current = i;
        dummy.scale.setScalar(ACTIVE_SCALE);
      } else {
        dummy.scale.setScalar(1);
      }
      
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Color based on genre
      const genre = normalizeGenre(station.tags);
      const color = GENRE_COLORS[genre] || GENRE_COLORS.other;
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [geoStations, currentStationId, globeRadius, dummy]);

  // Animate active station
  useFrame((_, delta) => {
    if (!meshRef.current || activeIndexRef.current < 0) return;

    timeRef.current += delta;
    const pulse = 1 + Math.sin(timeRef.current * 4) * 0.3;
    const scale = ACTIVE_SCALE * pulse;

    const station = geoStations[activeIndexRef.current];
    if (!station?.geo) return;

    const pos = geoToSphere({ lon: station.geo.lon, lat: station.geo.lat }, globeRadius + 0.005);
    dummy.position.set(pos[0], pos[1], pos[2]);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    meshRef.current.setMatrixAt(activeIndexRef.current, dummy.matrix);
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (geoStations.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, geoStations.length]}
      frustumCulled={false}
    />
  );
}
