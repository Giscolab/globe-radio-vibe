import { useMemo } from 'react';
import * as THREE from 'three';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { latLonToXYZ } from '@/engine';

interface BordersProps {
  features: Feature<Polygon | MultiPolygon>[];
  radius: number;
}

export function Borders({ features, radius }: BordersProps) {
  const geometry = useMemo(() => {
    const positions: number[] = [];

    const pushSegment = (start: [number, number], end: [number, number]) => {
      const [x1, y1, z1] = latLonToXYZ(start[1], start[0], radius);
      const [x2, y2, z2] = latLonToXYZ(end[1], end[0], radius);
      positions.push(x1, y1, z1, x2, y2, z2);
    };

    for (const feature of features) {
      const geometry = feature.geometry;
      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

      for (const polygon of polygons) {
        for (const ring of polygon) {
          if (ring.length < 2) continue;
          for (let i = 0; i < ring.length - 1; i += 1) {
            pushSegment(ring[i], ring[i + 1]);
          }
        }
      }
    }

    const bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    bufferGeometry.computeBoundingSphere();
    return bufferGeometry;
  }, [features, radius]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="hsl(45, 20%, 75%)" transparent opacity={0.6} />
    </lineSegments>
  );
}
