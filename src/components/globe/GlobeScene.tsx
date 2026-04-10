'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import DotMatrixGlobe from './DotMatrixGlobe';
import TrajectoryLayer, { Trajectory } from './TrajectoryLayer';

interface GlobeSceneProps {
  trajectories?: Trajectory[];
  onTrajectoryClick?: (trajectory: Trajectory) => void;
  radius?: number;
  autoRotate?: boolean;
}

function GlobeLoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[2, 16, 16]} />
      <meshBasicMaterial color="#f5f5f5" wireframe />
    </mesh>
  );
}

export default function GlobeScene({
  trajectories = [],
  onTrajectoryClick,
  radius = 2,
  autoRotate = true,
}: GlobeSceneProps) {
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
      <color attach="background" args={['#ffffff']} />
      <ambientLight intensity={1} />

      <Suspense fallback={<GlobeLoadingFallback />}>
        <DotMatrixGlobe
          radius={radius}
          autoRotateSpeed={autoRotate ? 0.15 : 0}
        />
        <TrajectoryLayer
          trajectories={trajectories}
          globeRadius={radius}
          onTrajectoryClick={onTrajectoryClick}
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
