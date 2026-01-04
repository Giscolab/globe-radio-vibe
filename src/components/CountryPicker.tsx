import { useEffect, useMemo, useRef } from 'react';
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
  const rectRef = useRef<DOMRect | null>(null);
  const frameRef = useRef<number | null>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!countryIndex) return;

    const dom = gl.domElement;

    const updateRect = () => {
      rectRef.current = dom.getBoundingClientRect();
    };

    const getIntersection = (clientX: number, clientY: number) => {
      const rect = rectRef.current ?? dom.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(countryMeshes, false);
    };

    const handlePointerMove = (clientX: number, clientY: number) => {
      if (!countryMeshes.length) {
        setHoveredCountry(null);
        return;
      }

      const intersections = getIntersection(clientX, clientY);
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
      const intersections = getIntersection(event.clientX, event.clientY);
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

    const schedulePointerMove = (event: PointerEvent) => {
      latestPointerRef.current = { x: event.clientX, y: event.clientY };
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const latest = latestPointerRef.current;
        if (!latest) return;
        handlePointerMove(latest.x, latest.y);
      });
    };

    updateRect();
    const resizeObserver = new ResizeObserver(updateRect);
    resizeObserver.observe(dom);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    dom.addEventListener('pointermove', schedulePointerMove);
    dom.addEventListener('pointerleave', handlePointerLeave);
    dom.addEventListener('click', handleClick);

    return () => {
      dom.removeEventListener('pointermove', schedulePointerMove);
      dom.removeEventListener('pointerleave', handlePointerLeave);
      dom.removeEventListener('click', handleClick);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [camera, countryIndex, countryMeshes, gl, pointer, raycaster, setHoveredCountry, setSelectedCountry, setSelectedCountryMesh]);

  return null;
}
