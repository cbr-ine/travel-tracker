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

// ─── Camera controller that smoothly zooms to a trajectory using useFrame ───

function CameraController({
  focusTrajectoryId,
  trajectories,
  radius,
}: {
  focusTrajectoryId: string | null;
  trajectories: Trajectory[];
  radius: number;
}) {
  const { camera } = useThree();
  const targetPosRef = useRef(new THREE.Vector3(0, 0, 5.5));
  const targetLookAtRef = useRef(new THREE.Vector3(0, 0, 0));
  // Store computed targets (non-ref state that triggers useEffect)
  const computedTargetRef = useRef<{ pos: THREE.Vector3; lookAt: THREE.Vector3 }>({
    pos: new THREE.Vector3(0, 0, 5.5),
    lookAt: new THREE.Vector3(0, 0, 0),
  });

  // Compute target position when focus changes
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
        const zoomDistance = 4.2;
        computedTargetRef.current = {
          pos: direction.multiplyScalar(zoomDistance),
          lookAt: centerPos,
        };
      }
    } else {
      computedTargetRef.current = {
        pos: new THREE.Vector3(0, 0, 5.5),
        lookAt: new THREE.Vector3(0, 0, 0),
      };
    }

    targetPosRef.current.copy(computedTargetRef.current.pos);
    targetLookAtRef.current.copy(computedTargetRef.current.lookAt);
  }, [focusTrajectoryId, trajectories, radius]);

  // Smooth interpolation each frame
  useFrame(() => {
    camera.position.lerp(targetPosRef.current, 0.04);

    // Gradually rotate camera to look at target
    const currentLookDir = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camera.quaternion);
    const desiredDir = targetLookAtRef.current.clone()
      .sub(camera.position)
      .normalize();

    const dot = currentLookDir.dot(desiredDir);
    if (dot < 0.9999) {
      const q = new THREE.Quaternion().setFromUnitVectors(
        currentLookDir,
        desiredDir
      );
      // Gentle rotation via slerp
      q.slerp(new THREE.Quaternion(), 0.92);
      camera.quaternion.premultiply(q);
    }
  });

  return null;
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
