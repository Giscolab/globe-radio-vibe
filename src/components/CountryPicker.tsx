import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGeoStore } from '@/stores/geo.store';
import type { CountryIndex } from '@/engine';

interface CountryPickerProps {
  countryIndex: CountryIndex | null;
  countryMeshes: THREE.Mesh[];
}

export function CountryPicker({ countryIndex, countryMeshes }: CountryPickerProps) {
  const { camera, gl } = useThree();
  const { setSelectedCountry, setHoveredCountry, setSelectedCountryMesh } = useGeoStore();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => {
    if (!countryIndex) return;

    const dom = gl.domElement;

    const getIntersection = (event: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(countryMeshes, false);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!countryMeshes.length) {
        setHoveredCountry(null);
        return;
      }

      const intersections = getIntersection(event);
      const hit = intersections[0]?.object;
      const iso = String(hit?.userData.iso ?? '');

      if (!iso) {
        setHoveredCountry(null);
        return;
      }

      const country = countryIndex.getCountryByIso2(iso) ?? countryIndex.getCountry(iso) ?? null;
      setHoveredCountry(country);
    };

    const handlePointerLeave = () => {
      setHoveredCountry(null);
    };

    const handleClick = (event: PointerEvent) => {
      if (!countryMeshes.length) return;
      const intersections = getIntersection(event);
      const hit = intersections[0]?.object as THREE.Mesh | undefined;
      const iso = String(hit?.userData.iso ?? '');

      if (!iso) {
        setSelectedCountry(null);
        setSelectedCountryMesh(null);
        return;
      }

      const country = countryIndex.getCountryByIso2(iso) ?? countryIndex.getCountry(iso) ?? null;
      setSelectedCountry(country);
      setSelectedCountryMesh(hit ?? null);
    };

    dom.addEventListener('pointermove', handlePointerMove);
    dom.addEventListener('pointerleave', handlePointerLeave);
    dom.addEventListener('click', handleClick);

    return () => {
      dom.removeEventListener('pointermove', handlePointerMove);
      dom.removeEventListener('pointerleave', handlePointerLeave);
      dom.removeEventListener('click', handleClick);
    };
  }, [camera, countryIndex, countryMeshes, gl, pointer, raycaster, setHoveredCountry, setSelectedCountry, setSelectedCountryMesh]);

  return null;
}
