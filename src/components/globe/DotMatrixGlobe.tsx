'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { isLand } from '@/lib/world-data';

interface DotMatrixGlobeProps {
  radius?: number;
  dotSize?: number;
  dotColor?: string;
  dotOpacity?: number;
  autoRotateSpeed?: number;
  wireColor?: string;
  labelColor?: string;
  labelShadow?: string;
}

// ─── Continent label data: center coordinates ───
const CONTINENT_LABELS: { name: string; lat: number; lng: number }[] = [
  { name: 'North America', lat: 48, lng: -100 },
  { name: 'South America', lat: -15, lng: -55 },
  { name: 'Europe', lat: 52, lng: 15 },
  { name: 'Africa', lat: 5, lng: 22 },
  { name: 'Asia', lat: 45, lng: 85 },
  { name: 'Australia', lat: -25, lng: 135 },
  { name: 'Antarctica', lat: -75, lng: 0 },
];

export default function DotMatrixGlobe({
  radius = 2,
  dotSize = 0.012,
  dotColor = '#1a1a1a',
  dotOpacity = 0.85,
  autoRotateSpeed = 0.15,
  wireColor = '#e8e8e8',
  labelColor = '#a0a0a0',
  labelShadow = '0 0 4px rgba(255,255,255,0.8)',
}: DotMatrixGlobeProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Generate dot positions using grid-based approach for pixel effect
  // step=1.8 for denser dots
  const dotPositions = useMemo(() => {
    return computeGridDots(radius, 1.8);
  }, [radius]);

  // Auto rotation
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * autoRotateSpeed;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Land dots using InstancedMesh */}
      <InstancedDots
        positions={dotPositions}
        size={dotSize}
        color={dotColor}
        opacity={dotOpacity}
      />
      {/* Subtle wireframe sphere for depth reference */}
      <mesh>
        <sphereGeometry args={[radius * 0.998, 36, 36]} />
        <meshBasicMaterial
          color={wireColor}
          transparent
          opacity={0.025}
          wireframe
        />
      </mesh>
      {/* Continent labels */}
      {CONTINENT_LABELS.map((c) => {
        const pos = latLngToVec3(c.lat, c.lng, radius * 1.01);
        return (
          <Html
            key={c.name}
            position={pos}
            center
            distanceFactor={6}
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                color: labelColor,
                fontSize: '8px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-geist-mono), monospace',
                whiteSpace: 'nowrap',
                opacity: 0.7,
                textShadow: labelShadow,
              }}
            >
              {c.name}
            </div>
          </Html>
        );
      })}
    </group>
  );
}

// ─── InstancedDots: renders thousands of dots efficiently ───

function InstancedDots({
  positions,
  size,
  color,
  opacity,
}: {
  positions: [number, number, number][];
  size: number;
  color: string;
  opacity: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Ensure at least 1 instance to avoid NaN bounding sphere
  const count = Math.max(positions.length, 1);

  // Update instance matrices when mesh is available or positions change
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || positions.length === 0) return;

    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);

    positions.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(size);

      // Orient circle to face outward from sphere center
      const normal = new THREE.Vector3(x, y, z).normalize();
      // Handle edge case when normal is parallel/antiparallel to up (poles)
      const dot = normal.dot(up);
      if (Math.abs(dot) > 0.9999) {
        if (dot < 0) {
          dummy.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
        } else {
          dummy.quaternion.identity();
        }
      } else {
        dummy.quaternion.setFromUnitVectors(up, normal);
      }

      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;

    // Explicitly compute bounding sphere to avoid NaN
    mesh.computeBoundingSphere();
  }, [positions, size]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <circleGeometry args={[1, 8]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

// ─── Land detection uses shared isLand from world-data.ts ───

function latLngToVec3(lat: number, lng: number, r: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return [
    -(r * Math.sin(phi) * Math.cos(theta)),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ];
}

function computeGridDots(radius: number, step: number): [number, number, number][] {
  const dots: [number, number, number][] = [];
  for (let lat = -85; lat <= 85; lat += step) {
    const lngStep = step / Math.max(Math.cos((lat * Math.PI) / 180), 0.15);
    const clamped = Math.min(Math.max(lngStep, step), step * 3);
    for (let lng = -180; lng < 180; lng += clamped) {
      if (isLand(lat, lng)) {
        dots.push(latLngToVec3(lat, lng, radius));
      }
    }
  }
  return dots;
}
