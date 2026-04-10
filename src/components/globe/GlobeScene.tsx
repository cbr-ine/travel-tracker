'use client';

import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import DotMatrixGlobe from './DotMatrixGlobe';
import TrajectoryLayer, { Trajectory } from './TrajectoryLayer';

interface GlobeSceneProps {
  trajectories?: Trajectory[];
  onTrajectoryClick?: (trajectory: Trajectory) => void;
  radius?: number;
  autoRotate?: boolean;
  focusTrajectoryId?: string | null;
}

function GlobeLoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[2, 16, 16]} />
      <meshBasicMaterial color="#f5f5f5" wireframe />
    </mesh>
  );
}

// ─── Camera controller that smoothly zooms to a trajectory ───

function CameraController({
  focusTrajectoryId,
  trajectories,
  radius,
}: {
  focusTrajectoryId: string | null;
  trajectories: Trajectory[];
  radius: number;
}) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  const targetPosRef = useRef(new THREE.Vector3(0, 0, 5.5));
  const isAnimating = useRef(false);
  const animationProgress = useRef(0);

  // Compute target when focus changes
  useEffect(() => {
    if (focusTrajectoryId) {
      const traj = trajectories.find((t) => t.id === focusTrajectoryId);
      if (traj && traj.locations.length > 0) {
        let sumLat = 0, sumLng = 0;
        for (const loc of traj.locations) {
          sumLat += loc.lat;
          sumLng += loc.lng;
        }
        const centerLat = sumLat / traj.locations.length;
        const centerLng = sumLng / traj.locations.length;

        const phi = (90 - centerLat) * (Math.PI / 180);
        const theta = (centerLng + 180) * (Math.PI / 180);
        const centerPos = new THREE.Vector3(
          -(radius * Math.sin(phi) * Math.cos(theta)),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta)
        );

        const direction = centerPos.clone().normalize();
        targetPosRef.current = direction.multiplyScalar(4.2);
        isAnimating.current = true;
        animationProgress.current = 0;
      }
    } else {
      // Smoothly return to default position
      targetPosRef.current = new THREE.Vector3(0, 0, 5.5);
      isAnimating.current = true;
      animationProgress.current = 0;
    }
  }, [focusTrajectoryId, trajectories, radius]);

  // Smooth camera movement each frame
  useFrame((_, delta) => {
    if (!isAnimating.current) return;

    animationProgress.current += delta * 1.5; // ~0.67s animation
    if (animationProgress.current >= 1) {
      animationProgress.current = 1;
      isAnimating.current = false;
    }

    const t = easeInOutCubic(animationProgress.current);
    camera.position.lerp(targetPosRef.current, t * 0.12);

    // Check if close enough to stop
    if (camera.position.distanceTo(targetPosRef.current) < 0.05) {
      isAnimating.current = false;
    }
  });

  return null;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function GlobeScene({
  trajectories = [],
  onTrajectoryClick,
  radius = 2,
  autoRotate = true,
  focusTrajectoryId,
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
          highlightTrajectoryId={focusTrajectoryId}
        />
        <CameraController
          focusTrajectoryId={focusTrajectoryId}
          trajectories={trajectories}
          radius={radius}
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
