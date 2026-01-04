import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGeoStore } from '@/stores/geo.store';

const HOVER_COLOR = new THREE.Color('hsl(45, 90%, 60%)');
const SELECTED_COLOR = new THREE.Color('hsl(14, 90%, 55%)');

interface CountryHighlightProps {
  meshes: THREE.Mesh[];
}

export function CountryHighlight({ meshes }: CountryHighlightProps) {
  const { hoveredCountry, selectedCountry } = useGeoStore();

  const selectedIso = useMemo(() => {
    if (!selectedCountry) return null;
    return (selectedCountry.iso2 ?? selectedCountry.id).toUpperCase();
  }, [selectedCountry]);
  const hoveredIso = useMemo(() => {
    if (!hoveredCountry) return null;
    return (hoveredCountry.iso2 ?? hoveredCountry.id).toUpperCase();
  }, [hoveredCountry]);

  useEffect(() => {
    for (const mesh of meshes) {
      const iso = String(mesh.userData.iso ?? '').toUpperCase();
      const material = mesh.material as THREE.MeshStandardMaterial;
      const baseColor = (mesh.userData.baseColor as THREE.Color) ?? material.color.clone();

      if (!mesh.userData.baseColor) {
        mesh.userData.baseColor = baseColor;
      }

      if (selectedIso && iso === selectedIso) {
        material.color.copy(SELECTED_COLOR);
      } else if (hoveredIso && iso === hoveredIso) {
        material.color.copy(HOVER_COLOR);
      } else {
        material.color.copy(baseColor);
      }
    }
  }, [meshes, hoveredIso, selectedIso]);

  return null;
}
