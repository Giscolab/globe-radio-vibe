import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { latLonToXYZ } from '@/engine';
import { useGeoStore } from '@/stores/geo.store';

interface CameraAnimatorProps {
  controlsRef: React.RefObject<OrbitControlsImpl>;
  globeRadius: number;
}

export function CameraAnimator({ controlsRef, globeRadius }: CameraAnimatorProps) {
  const { camera } = useThree();
  const { selectedCountry, cameraTarget, setCameraTarget } = useGeoStore();

  const minDistance = useMemo(() => globeRadius * 1.6, [globeRadius]);
  const maxDistance = useMemo(() => globeRadius * 2.8, [globeRadius]);

  useEffect(() => {
    if (!selectedCountry) {
      setCameraTarget(null);
      return;
    }

    const { centroid, bounds } = selectedCountry;
    const [x, y, z] = latLonToXYZ(centroid.lat, centroid.lon, globeRadius * 1.02);
    const target = new THREE.Vector3(x, y, z);

    const size = Math.max(bounds.maxLat - bounds.minLat, bounds.maxLon - bounds.minLon);
    const normalized = THREE.MathUtils.clamp(size / 60, 0, 1);
    const distance = THREE.MathUtils.lerp(minDistance, maxDistance, normalized);

    setCameraTarget({ position: { x: target.x, y: target.y, z: target.z }, distance });
  }, [globeRadius, maxDistance, minDistance, selectedCountry, setCameraTarget]);

  useFrame(() => {
    if (!cameraTarget) return;

    const targetVector = new THREE.Vector3(
      cameraTarget.position.x,
      cameraTarget.position.y,
      cameraTarget.position.z
    );

    const desiredPosition = targetVector.clone().normalize().multiplyScalar(cameraTarget.distance);
    camera.position.lerp(desiredPosition, 0.08);

    const controls = controlsRef.current;
    if (controls) {
      controls.target.lerp(targetVector, 0.08);
      controls.update();
    }
  });

  return null;
}
