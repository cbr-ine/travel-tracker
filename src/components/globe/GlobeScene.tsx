'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import DotMatrixGlobe from './DotMatrixGlobe';

interface GlobeSceneProps {
  isDark?: boolean;
}

function GlobeLoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[2, 16, 16]} />
      <meshBasicMaterial color="#333333" wireframe />
    </mesh>
  );
}

export default function GlobeScene({
  isDark = false,
}: GlobeSceneProps) {
  const bgColor = isDark ? '#0a0a0a' : '#ffffff';
  const dotColor = isDark ? '#e5e5e5' : '#1a1a1a';
  const dotOpacity = isDark ? 0.7 : 0.85;
  const wireColor = isDark ? '#1a1a1a' : '#e8e8e8';
  const labelColor = isDark ? '#666666' : '#a0a0a0';
  const labelShadow = isDark ? '0 0 4px rgba(0,0,0,0.8)' : '0 0 4px rgba(255,255,255,0.8)';

  return (
    <Canvas
      camera={{
        position: [0, 0, 5.5],
        fov: 45,
        near: 0.1,
        far: 100,
      }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      style={{
        width: '100%',
        height: '100%',
        touchAction: 'none',
      }}
    >
      <color attach="background" args={[bgColor]} />
      <color attach="fog" args={[bgColor]} />
      <ambientLight intensity={1} />

      <Suspense fallback={<GlobeLoadingFallback />}>
        <DotMatrixGlobe
          radius={2}
          autoRotateSpeed={0.15}
          dotColor={dotColor}
          dotOpacity={dotOpacity}
          wireColor={wireColor}
          labelColor={labelColor}
          labelShadow={labelShadow}
        />
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={3.5}
        maxDistance={10}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
      />
    </Canvas>
  );
}
