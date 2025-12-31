import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { loadWorldAtlas, topoToGeoJson, CountryIndex, findCountryAtPoint, latLonToXYZ, xyzToLatLon } from '@/engine';
import { useGeoStore } from '@/stores/geo.store';
import { useRadioStore } from '@/stores/radio.store';
import { usePlayer } from '@/hooks/usePlayer';
import { StationsLayer } from './StationsLayer';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

const GLOBE_RADIUS = 2;

function GlobeSphere() {
  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS * 0.99, 64, 64]} />
      <meshStandardMaterial color="hsl(210, 70%, 25%)" roughness={0.8} metalness={0.1} />
    </mesh>
  );
}

function Atmosphere() {
  return (
    <mesh scale={1.15}>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
      <meshBasicMaterial color="hsl(200, 80%, 60%)" transparent opacity={0.1} side={THREE.BackSide} />
    </mesh>
  );
}

interface BordersProps {
  features: Feature<Polygon | MultiPolygon>[];
  countryIndex: CountryIndex;
}

function Borders({ features, countryIndex }: BordersProps) {
  const { setSelectedCountry, selectedCountry } = useGeoStore();
  const meshRef = useRef<THREE.Group>(null);

  const countryMeshes = useMemo(() => {
    return features.map((feature, idx) => {
      const coordinates: [number, number][][] = [];
      
      if (feature.geometry.type === 'Polygon') {
        coordinates.push(...feature.geometry.coordinates as [number, number][][]);
      } else if (feature.geometry.type === 'MultiPolygon') {
        for (const polygon of feature.geometry.coordinates) {
          coordinates.push(...(polygon as [number, number][][]));
        }
      }

      const lines: THREE.Vector3[][] = [];
      for (const ring of coordinates) {
        const linePoints: THREE.Vector3[] = [];
        for (const [lon, lat] of ring) {
          const [x, y, z] = latLonToXYZ(lat, lon, GLOBE_RADIUS * 1.001);
          linePoints.push(new THREE.Vector3(x, y, z));
        }
        lines.push(linePoints);
      }

      return { id: String(feature.id ?? idx), name: feature.properties?.name ?? 'Unknown', lines };
    });
  }, [features]);

  return (
    <group ref={meshRef}>
      {countryMeshes.map((country) => (
        <group key={country.id}>
          {country.lines.map((linePoints, lineIdx) => (
            <line key={lineIdx}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={linePoints.length}
                  array={new Float32Array(linePoints.flatMap(p => [p.x, p.y, p.z]))}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="hsl(45, 20%, 75%)" linewidth={1} transparent opacity={0.6} />
            </line>
          ))}
        </group>
      ))}
    </group>
  );
}

interface GlobePickerProps {
  countryIndex: CountryIndex | null;
}

function GlobePicker({ countryIndex }: GlobePickerProps) {
  const { camera, gl } = useThree();
  const { setSelectedCountry, setHoveredCountry } = useGeoStore();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!countryIndex) return;
      
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), GLOBE_RADIUS);
      const intersection = new THREE.Vector3();
      
      if (raycaster.ray.intersectSphere(sphere, intersection)) {
        const { lat, lon } = xyzToLatLon(intersection.x, intersection.y, intersection.z);
        const country = findCountryAtPoint({ lat, lon }, countryIndex);
        setSelectedCountry(country);
      }
    };

    gl.domElement.addEventListener('click', handleClick);
    return () => gl.domElement.removeEventListener('click', handleClick);
  }, [camera, gl, countryIndex, setSelectedCountry]);

  return null;
}

function GlobeScene() {
  const [features, setFeatures] = useState<Feature<Polygon | MultiPolygon>[]>([]);
  const [countryIndex, setCountryIndex] = useState<CountryIndex | null>(null);
  const { setLoading, setError, selectedCountry } = useGeoStore();
  
  // Get stations from the store (both top and country-specific)
  const { stations: countryStations, topStations } = useRadioStore();
  const { currentStation, status } = usePlayer();
  const isPlaying = status === 'playing';
  
  // Combine stations for globe display
  const allStations = selectedCountry ? countryStations : topStations;

  useEffect(() => {
    async function loadGeo() {
      setLoading(true);
      try {
        const topo = await loadWorldAtlas('countries110m');
        const geoJson = topoToGeoJson(topo, 'countries');
        
        const index = new CountryIndex();
        index.buildFromFeatures(geoJson.features as Feature<Polygon | MultiPolygon>[]);
        
        setFeatures(geoJson.features as Feature<Polygon | MultiPolygon>[]);
        setCountryIndex(index);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load geo data');
      } finally {
        setLoading(false);
      }
    }
    loadGeo();
  }, [setLoading, setError]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={1} />
      <GlobeSphere />
      <Atmosphere />
      {features.length > 0 && countryIndex && (
        <Borders features={features} countryIndex={countryIndex} />
      )}
      
      {/* Stations layer with audio-reactive pulsing */}
      <StationsLayer 
        stations={allStations}
        currentStationId={currentStation?.id}
        isPlaying={isPlaying}
        globeRadius={GLOBE_RADIUS}
      />
      
      <GlobePicker countryIndex={countryIndex} />
      <OrbitControls enablePan={false} minDistance={3} maxDistance={10} rotateSpeed={0.5} />
    </>
  );
}

export function GlobeCanvas() {
  return (
    <div className="w-full h-full globe-container">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <GlobeScene />
      </Canvas>
    </div>
  );
}
