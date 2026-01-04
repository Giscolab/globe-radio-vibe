import { useMemo } from 'react';
import * as THREE from 'three';

interface SkyboxProps {
  radius?: number;
}

function createStarfieldTexture(size: number, stars: number): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return new THREE.Texture();
  }

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < stars; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = Math.random() * 1.2 + 0.2;
    const alpha = Math.random() * 0.8 + 0.2;

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

export function Skybox({ radius = 50 }: SkyboxProps) {
  const texture = useMemo(() => createStarfieldTexture(1024, 1200), []);

  return (
    <mesh>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
}
