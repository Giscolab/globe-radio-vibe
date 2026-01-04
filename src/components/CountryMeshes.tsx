import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { latLonToXYZ } from '@/engine';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';

const DEFAULT_COUNTRY_COLOR = new THREE.Color('hsl(210, 45%, 28%)');

interface CountryMeshesProps {
  features: Feature<Polygon | MultiPolygon>[];
  radius: number;
  onMeshesReady?: (meshes: THREE.Mesh[]) => void;
}

function createShapeFromRings(rings: [number, number][][]): THREE.Shape | null {
  if (!rings.length || !rings[0].length) return null;

  const [outerRing, ...holeRings] = rings;
  const shape = new THREE.Shape(outerRing.map(([lon, lat]) => new THREE.Vector2(lon, lat)));

  for (const hole of holeRings) {
    if (hole.length < 3) continue;
    const path = new THREE.Path(hole.map(([lon, lat]) => new THREE.Vector2(lon, lat)));
    shape.holes.push(path);
  }

  return shape;
}

function buildCountryGeometry(
  geometry: Polygon | MultiPolygon,
  radius: number
): THREE.BufferGeometry | null {
  const shapes: THREE.Shape[] = [];

  if (geometry.type === 'Polygon') {
    const shape = createShapeFromRings(geometry.coordinates as [number, number][][]);
    if (shape) shapes.push(shape);
  } else {
    for (const polygon of geometry.coordinates) {
      const shape = createShapeFromRings(polygon as [number, number][][]);
      if (shape) shapes.push(shape);
    }
  }

  if (!shapes.length) return null;

  const geometries = shapes.map((shape) => {
    const shapeGeometry = new THREE.ShapeGeometry(shape);
    const position = shapeGeometry.getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i < position.count; i += 1) {
      const lon = position.getX(i);
      const lat = position.getY(i);
      const [x, y, z] = latLonToXYZ(lat, lon, radius);
      position.setXYZ(i, x, y, z);
    }

    shapeGeometry.computeVertexNormals();
    return shapeGeometry;
  });

  if (geometries.length === 1) {
    return geometries[0];
  }

  return mergeGeometries(geometries, false) ?? null;
}

export function CountryMeshes({ features, radius, onMeshesReady }: CountryMeshesProps) {
  const meshRefs = useRef<THREE.Mesh[]>([]);

  const meshData = useMemo(() => {
    return features.map((feature, index) => {
      const geometry = buildCountryGeometry(feature.geometry, radius);
      const iso = feature.properties?.iso_a2 ?? String(feature.id ?? index);

      return {
        id: String(feature.id ?? index),
        name: feature.properties?.name ?? 'Unknown',
        iso,
        geometry,
      };
    });
  }, [features, radius]);

  useEffect(() => {
    if (!onMeshesReady) return;
    const meshes = meshRefs.current.filter(Boolean);
    onMeshesReady(meshes);
  }, [meshData, onMeshesReady]);

  return (
    <group>
      {meshData.map((country, index) => {
        if (!country.geometry) return null;
        return (
          <mesh
            key={country.id}
            ref={(mesh) => {
              if (mesh) {
                meshRefs.current[index] = mesh;
              }
            }}
            geometry={country.geometry}
            userData={{
              iso: country.iso,
              name: country.name,
              baseColor: DEFAULT_COUNTRY_COLOR.clone(),
            }}
          >
            <meshStandardMaterial
              color={DEFAULT_COUNTRY_COLOR}
              roughness={0.7}
              metalness={0.05}
              transparent
              opacity={0.65}
            />
          </mesh>
        );
      })}
    </group>
  );
}
