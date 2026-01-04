import React from 'react';
import { Canvas } from '@react-three/fiber';
import { GlobeScene } from './GlobeScene';

export function GlobeCanvas() {
  return (
    <div className="w-full h-full globe-container">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <GlobeScene />
      </Canvas>
    </div>
  );
}
