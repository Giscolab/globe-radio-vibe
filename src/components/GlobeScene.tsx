import { useEffect, useMemo, useRef, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { loadWorldAtlas, topoToGeoJson, CountryIndex } from '@/engine';
import { useGeoStore, DEFAULT_COUNTRY_CODE } from '@/stores/geo.store';
import { useRadioStore } from '@/stores/radio';
import { usePlayer } from '@/hooks/usePlayer';
import { StationsLayer } from './StationsLayer';
import { CountryMeshes } from './CountryMeshes';
import { CountryPicker } from './CountryPicker';
import { CountryHighlight } from './CountryHighlight';
import { CameraAnimator } from './CameraAnimator';
import { Skybox } from './Skybox';
import { Borders } from './Borders';

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

export function GlobeScene() {
  const [features, setFeatures] = useState<Feature<Polygon | MultiPolygon>[]>([]);
  const [countryIndex, setCountryIndex] = useState<CountryIndex | null>(null);
  const [countryMeshes, setCountryMeshes] = useState<THREE.Mesh[]>([]);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const {
    setLoading,
    setError,
    selectedCountry,
    setSelectedCountry,
    defaultCountryInitialized,
    setDefaultCountryInitialized,
  } = useGeoStore();

  const { stations: countryStations, topStations } = useRadioStore();
  const { currentStation, status } = usePlayer();
  const isPlaying = status === 'playing';

  const allStations = selectedCountry ? countryStations : topStations;

  useEffect(() => {
    async function loadGeo() {
      setLoading(true);
      try {
        const topo = await loadWorldAtlas('countries50m').catch(() => loadWorldAtlas('countries110m'));
        const geoJson = topoToGeoJson(topo, 'countries');

        const index = new CountryIndex();
        index.buildFromFeatures(geoJson.features as Feature<Polygon | MultiPolygon>[]);

        setFeatures(geoJson.features as Feature<Polygon | MultiPolygon>[]);
        setCountryIndex(index);

        if (!defaultCountryInitialized) {
          const defaultCountry = index.getCountryByIso2(DEFAULT_COUNTRY_CODE);
          if (defaultCountry) {
            setSelectedCountry(defaultCountry);
          }
          setDefaultCountryInitialized(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load geo data');
      } finally {
        setLoading(false);
      }
    }
    loadGeo();
  }, [setLoading, setError, setSelectedCountry, defaultCountryInitialized, setDefaultCountryInitialized]);

  const borderRadius = useMemo(() => GLOBE_RADIUS * 1.006, []);
  const countryRadius = useMemo(() => GLOBE_RADIUS * 1.003, []);

  return (
    <>
      <Skybox />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={1} />

      <GlobeSphere />
      <Atmosphere />

      {features.length > 0 && (
        <CountryMeshes
          features={features}
          radius={countryRadius}
          onMeshesReady={setCountryMeshes}
        />
      )}

      {features.length > 0 && <Borders features={features} radius={borderRadius} />}

      <StationsLayer
        stations={allStations}
        currentStationId={currentStation?.id}
        isPlaying={isPlaying}
        globeRadius={GLOBE_RADIUS}
      />

      {countryIndex && (
        <CountryPicker countryIndex={countryIndex} countryMeshes={countryMeshes} />
      )}
      <CountryHighlight meshes={countryMeshes} />
      <CameraAnimator controlsRef={controlsRef} globeRadius={GLOBE_RADIUS} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={3}
        maxDistance={10}
        rotateSpeed={0.5}
      />
    </>
  );
}
