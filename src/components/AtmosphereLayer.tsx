// Component - AtmosphereLayer: fresnel glow effect around globe
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AtmosphereLayerProps {
  radius?: number;
}

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 glowColor;
  uniform float intensity;
  uniform float power;
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), power);
    float alpha = fresnel * intensity;
    gl_FragColor = vec4(glowColor, alpha);
  }
`;

export function AtmosphereLayer({ radius = 1 }: AtmosphereLayerProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    glowColor: { value: new THREE.Color(0x4ade80) },
    intensity: { value: 0.6 },
    power: { value: 2.5 },
  }), []);

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [uniforms]);

  // Subtle animation
  useFrame((state) => {
    if (uniforms.intensity) {
      uniforms.intensity.value = 0.5 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <mesh ref={meshRef} material={material} scale={1.15}>
      <sphereGeometry args={[radius, 64, 64]} />
    </mesh>
  );
}
