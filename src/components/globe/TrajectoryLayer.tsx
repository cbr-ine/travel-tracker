'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Types ───

export interface TrajectoryPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
}

export interface Trajectory {
  id: string;
  name: string;
  color: string;
  locations: TrajectoryPoint[];
}

interface TrajectoryLayerProps {
  trajectories: Trajectory[];
  globeRadius: number;
  onTrajectoryClick?: (trajectory: Trajectory) => void;
}

// ─── Palette of warm trajectory colors ───

const DEFAULT_PALETTE = [
  '#E85D4A', // warm red
  '#F4A261', // sandy orange
  '#E9C46A', // golden yellow
  '#2A9D8F', // teal
  '#264653', // dark teal
  '#D4A5A5', // dusty rose
  '#9B5DE5', // purple
  '#00BBF9', // sky blue
];

// ─── Helper: lat/lng → sphere XYZ ───

function latLngToVec3(lat: number, lng: number, r: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return [
    -(r * Math.sin(phi) * Math.cos(theta)),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ];
}

// ─── Helper: compute outward-facing quaternion for a position on a sphere ───

function outwardRotation(x: number, y: number, z: number): THREE.Euler {
  const normal = new THREE.Vector3(x, y, z).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
  const euler = new THREE.Euler().setFromQuaternion(quat);
  return euler;
}

// ─── Component ───

export default function TrajectoryLayer({
  trajectories,
  globeRadius,
  onTrajectoryClick,
}: TrajectoryLayerProps) {
  if (!trajectories.length) return null;

  return (
    <group>
      {trajectories.map((trajectory, idx) => (
        <SingleTrajectory
          key={trajectory.id}
          trajectory={trajectory}
          globeRadius={globeRadius}
          color={trajectory.color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]}
          onClick={onTrajectoryClick}
        />
      ))}
    </group>
  );
}

// ─── Single trajectory: points + connecting line ───

function SingleTrajectory({
  trajectory,
  globeRadius,
  color,
  onClick,
}: {
  trajectory: Trajectory;
  globeRadius: number;
  color: string;
  onClick?: (t: Trajectory) => void;
}) {
  const glowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  const sortedLocations = useMemo(
    () => [...trajectory.locations].sort((a, b) => a.order - b.order),
    [trajectory.locations]
  );

  const pointData = useMemo(
    () =>
      sortedLocations.map((loc) => {
        const pos = latLngToVec3(loc.lat, loc.lng, globeRadius * 1.005);
        return {
          id: loc.id,
          position: pos,
          rotation: outwardRotation(...pos),
        };
      }),
    [sortedLocations, globeRadius]
  );

  // Pulse animation
  useFrame(({ clock }) => {
    if (glowMaterialRef.current) {
      const t = clock.getElapsedTime();
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.0);
      glowMaterialRef.current.opacity = 0.15 + 0.35 * pulse;
    }
  });

  if (!pointData.length) return null;

  return (
    <group>
      {/* Connecting line with arc */}
      {pointData.length >= 2 && (
        <TrajectoryLine
          positions={pointData.map((p) => p.position)}
          color={color}
        />
      )}

      {/* Pulsing glow dots (larger, transparent) */}
      {pointData.map((pt, i) => (
        <mesh
          key={pt.id ?? `glow-${i}`}
          position={pt.position}
          rotation={pt.rotation}
        >
          <circleGeometry args={[0.06, 16]} />
          <meshBasicMaterial
            ref={i === 0 ? glowMaterialRef : undefined}
            color={color}
            transparent
            opacity={0.3}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Solid trajectory dots */}
      {pointData.map((pt, i) => {
        const isFirst = i === 0;
        const isLast = i === pointData.length - 1;
        const dotRadius = isFirst || isLast ? 0.04 : 0.025;

        return (
          <mesh
            key={pt.id ?? `dot-${i}`}
            position={pt.position}
            rotation={pt.rotation}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.(trajectory);
            }}
          >
            <circleGeometry args={[dotRadius, 16]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.95}
              depthWrite={false}
            />
          </mesh>
        );
      })}

      {/* Start/End markers: rings */}
      {pointData.map((pt, i) => {
        if (i !== 0 && i !== pointData.length - 1) return null;
        return (
          <mesh
            key={`ring-${i}`}
            position={pt.position}
            rotation={pt.rotation}
          >
            <ringGeometry args={[0.05, 0.065, 24]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── Trajectory arc line ───

function TrajectoryLine({
  positions,
  color,
}: {
  positions: [number, number, number][];
  color: string;
}) {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];

    for (let i = 0; i < positions.length - 1; i++) {
      const start = new THREE.Vector3(...positions[i]);
      const end = new THREE.Vector3(...positions[i + 1]);
      const segments = 32;

      for (let j = 0; j < segments; j++) {
        const t = j / segments;
        const point = new THREE.Vector3().lerpVectors(start, end, t);
        // Lift midpoint above sphere surface for arc effect
        const lift = Math.sin(t * Math.PI) * 0.08 * start.length();
        point.normalize().multiplyScalar(point.length() + lift);
        points.push(point);
      }
    }
    // Final point
    points.push(new THREE.Vector3(...positions[positions.length - 1]));

    return new THREE.BufferGeometry().setFromPoints(points);
  }, [positions]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </line>
  );
}
