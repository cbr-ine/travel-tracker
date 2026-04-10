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
  highlightTrajectoryId?: string | null;
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

// ─── Helper: compute outward-facing euler for a position on a sphere ───

function outwardRotation(x: number, y: number, z: number): THREE.Euler {
  const normal = new THREE.Vector3(x, y, z);
  if (normal.lengthSq() < 1e-8) return new THREE.Euler();
  normal.normalize();
  const up = new THREE.Vector3(0, 1, 0);
  // Handle edge case when normal is parallel to up
  if (Math.abs(normal.dot(up)) > 0.9999) {
    const altUp = new THREE.Vector3(0, 0, 1);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, altUp);
    if (normal.y < 0) {
      quat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
    }
    return new THREE.Euler().setFromQuaternion(quat);
  }
  const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
  const euler = new THREE.Euler().setFromQuaternion(quat);
  return euler;
}

// ─── Component ───

export default function TrajectoryLayer({
  trajectories,
  globeRadius,
  onTrajectoryClick,
  highlightTrajectoryId,
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
          isHighlighted={trajectory.id === highlightTrajectoryId}
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
  isHighlighted,
}: {
  trajectory: Trajectory;
  globeRadius: number;
  color: string;
  onClick?: (t: Trajectory) => void;
  isHighlighted?: boolean;
}) {
  const glowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const highlightRef = useRef<THREE.MeshBasicMaterial>(null);

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
      const baseOpacity = isHighlighted ? 0.25 : 0.15;
      const pulseAmp = isHighlighted ? 0.45 : 0.35;
      glowMaterialRef.current.opacity = baseOpacity + pulseAmp * pulse;
    }
    // Highlight pulse (larger glow ring)
    if (highlightRef.current) {
      const t = clock.getElapsedTime();
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.0);
      highlightRef.current.opacity = isHighlighted ? 0.15 + 0.25 * pulse : 0;
    }
  });

  // Skip rendering if no valid positions
  const validPoints = pointData.filter(
    (p) => isFinite(p.position[0]) && isFinite(p.position[1]) && isFinite(p.position[2])
  );

  if (!validPoints.length) return null;

  const baseOpacity = isHighlighted ? 1.0 : 0.6;
  const dotScale = isHighlighted ? 1.3 : 1.0;
  const lineOpacity = isHighlighted ? 0.9 : 0.5;

  return (
    <group>
      {/* Connecting line with arc */}
      {validPoints.length >= 2 && (
        <TrajectoryLine
          positions={validPoints.map((p) => p.position)}
          color={color}
          opacity={lineOpacity}
        />
      )}

      {/* Highlight ring around all points when focused */}
      {validPoints.map((pt, i) => (
        <mesh
          key={pt.id ?? `highlight-${i}`}
          position={pt.position}
          rotation={pt.rotation}
        >
          <circleGeometry args={[0.09, 16]} />
          <meshBasicMaterial
            ref={i === 0 ? highlightRef : undefined}
            color={color}
            transparent
            opacity={isHighlighted ? 0.2 : 0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Pulsing glow dots (larger, transparent) */}
      {validPoints.map((pt, i) => (
        <mesh
          key={pt.id ?? `glow-${i}`}
          position={pt.position}
          rotation={pt.rotation}
        >
          <circleGeometry args={[0.05 * dotScale, 16]} />
          <meshBasicMaterial
            ref={i === 0 ? glowMaterialRef : undefined}
            color={color}
            transparent
            opacity={0.3}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Solid trajectory dots */}
      {validPoints.map((pt, i) => {
        const isFirst = i === 0;
        const isLast = i === validPoints.length - 1;
        const dotRadius = (isFirst || isLast ? 0.03 : 0.018) * dotScale;

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
              opacity={baseOpacity}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}

      {/* Start/End markers: rings */}
      {validPoints.map((pt, i) => {
        if (i !== 0 && i !== validPoints.length - 1) return null;
        return (
          <mesh
            key={`ring-${i}`}
            position={pt.position}
            rotation={pt.rotation}
          >
            <ringGeometry args={[0.04 * dotScale, 0.052 * dotScale, 24]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={isHighlighted ? 0.8 : 0.6}
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
  opacity,
}: {
  positions: [number, number, number][];
  color: string;
  opacity: number;
}) {
  const geometry = useMemo(() => {
    if (positions.length < 2) return null;

    const points: THREE.Vector3[] = [];

    for (let i = 0; i < positions.length - 1; i++) {
      const start = new THREE.Vector3(...positions[i]);
      const end = new THREE.Vector3(...positions[i + 1]);

      // Skip if either point is invalid
      if (!start.length() || !end.length()) continue;

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
    if (positions.length > 0) {
      const lastPos = positions[positions.length - 1];
      const last = new THREE.Vector3(...lastPos);
      if (last.length()) {
        points.push(last);
      }
    }

    if (points.length < 2) return null;

    const geom = new THREE.BufferGeometry().setFromPoints(points);
    geom.computeBoundingSphere();
    return geom;
  }, [positions]);

  if (!geometry) return null;

  return (
    <line geometry={geometry}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </line>
  );
}
