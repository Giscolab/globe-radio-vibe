// Component - StationsLayer: instanced rendering of station points on globe
// Supports audio-reactive pulsing for active station
// OPTIMIZED: Uses refs for audio data to avoid rerenders
import { useRef, useMemo, useEffect, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Station, normalizeGenre } from '@/engine/types/radio';
import { geoToSphere } from '@/engine/geo/projection/lonLat';
import { useAudioVolume } from '@/hooks/useAudioAnalysis';

interface StationsLayerProps {
  stations: Station[];
  currentStationId?: string | null;
  isPlaying?: boolean;
  globeRadius?: number;
  zoom?: number;
}

// Extended genre colors matching the full taxonomy
export const GENRE_COLORS: Record<string, THREE.Color> = {
  pop: new THREE.Color(0xff6b9d),      // Pink
  rock: new THREE.Color(0xff4444),      // Red
  jazz: new THREE.Color(0x9b59b6),      // Purple
  classical: new THREE.Color(0x3498db), // Blue
  electronic: new THREE.Color(0x00ff88),// Green neon
  hiphop: new THREE.Color(0xf39c12),    // Orange
  country: new THREE.Color(0xcd853f),   // Peru/Brown
  world: new THREE.Color(0x1abc9c),     // Teal
  news: new THREE.Color(0x7f8c8d),      // Gray
  sports: new THREE.Color(0x27ae60),    // Green
  religious: new THREE.Color(0xe8d5b7), // Beige
  oldies: new THREE.Color(0xd4a574),    // Tan/Vintage
  other: new THREE.Color(0x95a5a6),     // Light gray
};

// For UI legend display
export const GENRE_COLOR_HEX: Record<string, string> = {
  pop: '#ff6b9d',
  rock: '#ff4444',
  jazz: '#9b59b6',
  classical: '#3498db',
  electronic: '#00ff88',
  hiphop: '#f39c12',
  country: '#cd853f',
  world: '#1abc9c',
  news: '#7f8c8d',
  sports: '#27ae60',
  religious: '#e8d5b7',
  oldies: '#d4a574',
  other: '#95a5a6',
};

const POINT_SIZE = 0.015;
const ACTIVE_SCALE = 2.5;
const PEAK_SCALE_BOOST = 1.5;
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

// Memoized component to prevent unnecessary rerenders
export const StationsLayer = memo(function StationsLayer({ 
  stations, 
  currentStationId, 
  isPlaying = false,
  globeRadius = 1,
  zoom = 1 
}: StationsLayerProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowMeshRef = useRef<THREE.Mesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const activeIndexRef = useRef<number>(-1);
  const timeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  
  // Get audio volume refs for reactive animations (no rerenders)
  const { volumeRef, peakRef } = useAudioVolume(isPlaying);

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
  
  // Glow geometry for active station
  const glowGeometry = useMemo(() => new THREE.SphereGeometry(POINT_SIZE * 4, 16, 16), []);
  const glowMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x00ff88),
    transparent: true,
    opacity: 0,
  }), []);

  // Find active station position for glow
  const activeStationPos = useMemo(() => {
    if (!currentStationId) return null;
    const station = geoStations.find(s => s.id === currentStationId);
    if (!station?.geo) return null;
    return geoToSphere({ lon: station.geo.lon, lat: station.geo.lat }, globeRadius + 0.01);
  }, [geoStations, currentStationId, globeRadius]);

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

  // Animate active station with audio reactivity (throttled to 30 FPS)
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Throttle updates to target FPS
    const now = state.clock.elapsedTime * 1000;
    if (now - lastFrameTimeRef.current < FRAME_INTERVAL) return;
    lastFrameTimeRef.current = now;

    timeRef.current += delta;
    
    // Read audio values from refs (no rerender needed)
    const audioVolume = volumeRef.current;
    const peak = peakRef.current;
    
    // Animate active station marker
    if (activeIndexRef.current >= 0) {
      const station = geoStations[activeIndexRef.current];
      if (!station?.geo) return;

      // Base pulse animation
      const basePulse = 1 + Math.sin(timeRef.current * 4) * 0.2;
      
      // Audio-reactive scaling (smoothed)
      const audioScale = isPlaying ? 1 + audioVolume * 0.5 : 1;
      const peakBoost = peak ? PEAK_SCALE_BOOST : 1;
      
      const scale = ACTIVE_SCALE * basePulse * audioScale * peakBoost;

      const pos = geoToSphere({ lon: station.geo.lon, lat: station.geo.lat }, globeRadius + 0.005);
      dummy.position.set(pos[0], pos[1], pos[2]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(activeIndexRef.current, dummy.matrix);
      meshRef.current.instanceMatrix.needsUpdate = true;
      
      // Update active color based on peak
      if (peak && meshRef.current.instanceColor) {
        meshRef.current.setColorAt(activeIndexRef.current, new THREE.Color(0xff6b00));
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
    
    // Animate glow mesh
    if (glowMeshRef.current && activeStationPos && isPlaying) {
      glowMeshRef.current.position.set(activeStationPos[0], activeStationPos[1], activeStationPos[2]);
      
      // Scale and opacity based on audio
      const glowScale = 1 + audioVolume * 2;
      glowMeshRef.current.scale.setScalar(glowScale);
      
      const glowOpacity = 0.1 + audioVolume * 0.4 + (peak ? 0.3 : 0);
      (glowMeshRef.current.material as THREE.MeshBasicMaterial).opacity = glowOpacity;
      
      // Color shift on peak
      const glowColor = peak 
        ? new THREE.Color(0xff6b00) 
        : new THREE.Color(0x00ff88);
      (glowMeshRef.current.material as THREE.MeshBasicMaterial).color = glowColor;
    }
  });

  if (geoStations.length === 0) return null;

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, geoStations.length]}
        frustumCulled={false}
      />
      
      {/* Glow effect for active station */}
      {activeStationPos && isPlaying && (
        <mesh
          ref={glowMeshRef}
          geometry={glowGeometry}
          material={glowMaterial}
          position={activeStationPos}
        />
      )}
    </>
  );
});

