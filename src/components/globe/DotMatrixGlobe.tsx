'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DotMatrixGlobeProps {
  radius?: number;
  dotSize?: number;
  dotColor?: string;
  dotOpacity?: number;
  autoRotateSpeed?: number;
}

export default function DotMatrixGlobe({
  radius = 2,
  dotSize = 0.025,
  dotColor = '#1a1a1a',
  dotOpacity = 0.85,
  autoRotateSpeed = 0.15,
}: DotMatrixGlobeProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Generate dot positions using grid-based approach for pixel effect
  const dotPositions = useMemo(() => {
    // We'll compute dots inline to avoid import issues
    return computeGridDots(radius, 3.2);
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
          color="#f0f0f0"
          transparent
          opacity={0.03}
          wireframe
        />
      </mesh>
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

  const count = positions.length;

  // Update instance matrices when mesh is available or positions change
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);

    positions.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(size);

      // Orient circle to face outward from sphere center
      const normal = new THREE.Vector3(x, y, z).normalize();
      dummy.quaternion.setFromUnitVectors(up, normal);

      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
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
      />
    </instancedMesh>
  );
}

// ─── Inline land detection (simplified continent polygons) ───

interface Polygon {
  name: string;
  vertices: [number, number][];
}

const CONTINENTS: Polygon[] = [
  // North America
  {
    name: 'North America',
    vertices: [
      [70, -168], [72, -140], [74, -100], [72, -80], [70, -65],
      [60, -65], [50, -55], [45, -65], [43, -70],
      [40, -74], [35, -75], [30, -82], [25, -80], [25, -90],
      [20, -87], [15, -83], [10, -84], [8, -77],
      [18, -88], [20, -105], [25, -110], [30, -115],
      [32, -117], [35, -120], [40, -124], [48, -125],
      [55, -132], [60, -140], [60, -148], [65, -168],
    ],
  },
  // Greenland
  {
    name: 'Greenland',
    vertices: [
      [60, -45], [65, -40], [70, -22], [75, -18], [80, -20],
      [83, -30], [82, -50], [78, -68], [72, -55], [65, -54],
    ],
  },
  // South America
  {
    name: 'South America',
    vertices: [
      [12, -72], [10, -75], [7, -77], [2, -80], [-5, -81],
      [-15, -75], [-18, -70], [-23, -70], [-30, -72],
      [-40, -73], [-50, -75], [-55, -68], [-55, -65],
      [-52, -70], [-47, -66], [-42, -64], [-35, -57],
      [-23, -43], [-15, -39], [-5, -35], [0, -50],
      [5, -60], [8, -62], [10, -67], [12, -72],
    ],
  },
  // Europe
  {
    name: 'Europe',
    vertices: [
      [36, -9], [38, -5], [43, -9], [44, -1], [46, -1],
      [48, -5], [51, -5], [54, -10], [58, -5], [62, -7],
      [65, -14], [70, -20], [71, -28], [70, -40], [65, -42],
      [60, -30], [56, -28], [55, -20], [54, -14], [58, -10],
      [60, -5], [62, 5], [65, 12], [70, 15], [70, 28],
      [67, 30], [60, 30], [56, 28], [55, 22], [50, 20],
      [47, 18], [45, 14], [42, 12], [40, 15], [38, 20],
      [36, 22], [38, 26], [40, 28], [42, 30], [44, 28],
      [42, 25], [40, 20], [38, 15], [36, 10], [37, 0],
    ],
  },
  // Africa
  {
    name: 'Africa',
    vertices: [
      [37, -10], [37, 0], [37, 10], [33, 12], [32, 25],
      [30, 32], [22, 36], [12, 44], [10, 50], [5, 42],
      [0, 42], [-5, 40], [-12, 40], [-15, 38],
      [-25, 35], [-30, 30], [-35, 20], [-34, 18],
      [-30, 16], [-22, 14], [-15, 12], [-5, 8],
      [0, 5], [5, 0], [5, -5], [4, -8],
      [8, -13], [12, -17], [15, -17], [20, -17],
      [25, -15], [30, -10], [35, -5], [37, -10],
    ],
  },
  // Madagascar
  {
    name: 'Madagascar',
    vertices: [
      [-12, 49], [-15, 50], [-20, 44], [-25, 44], [-24, 47],
      [-18, 50], [-14, 50], [-12, 49],
    ],
  },
  // Asia (simplified)
  {
    name: 'Asia',
    vertices: [
      [70, 28], [72, 40], [75, 60], [75, 80], [73, 90],
      [70, 130], [72, 140], [68, 170], [65, 178],
      [60, 165], [55, 155], [50, 143], [45, 142],
      [40, 130], [35, 130], [30, 122], [25, 120],
      [22, 114], [20, 110], [15, 108], [10, 106],
      [1, 104], [-5, 105], [-8, 115], [-8, 120],
      [5, 120], [10, 120], [15, 118], [20, 116],
      [22, 110], [25, 105], [22, 100], [20, 95],
      [15, 100], [10, 98], [5, 95], [0, 95],
      [5, 90], [8, 80], [10, 78], [15, 75],
      [20, 73], [25, 68], [25, 62], [28, 57],
      [30, 52], [28, 48], [30, 48], [35, 45],
      [37, 36], [40, 28], [42, 30], [42, 35],
      [40, 44], [37, 40], [35, 36], [33, 36],
      [30, 35], [28, 34], [25, 35], [20, 40],
      [15, 42], [12, 45], [14, 48], [16, 52],
      [22, 56], [25, 55], [25, 50], [28, 48],
      [32, 48], [37, 42], [40, 42], [42, 44],
      [40, 50], [38, 55], [42, 60], [45, 65],
      [50, 68], [55, 70], [58, 75], [55, 80],
      [50, 80], [45, 78], [42, 75], [40, 70],
      [42, 65], [48, 58], [50, 55], [55, 58],
      [60, 55], [65, 50], [68, 48], [70, 42],
    ],
  },
  // Japan
  {
    name: 'Japan',
    vertices: [
      [31, 131], [33, 132], [35, 135], [37, 137],
      [39, 140], [41, 140], [43, 145], [45, 145],
      [43, 142], [41, 140], [39, 138], [37, 136],
      [35, 134], [33, 132], [31, 131],
    ],
  },
  // British Isles
  {
    name: 'British Isles',
    vertices: [
      [50, -6], [51, -5], [52, -4], [53, -3], [54, -3],
      [55, -2], [56, -3], [57, -5], [58, -5], [58, -3],
      [57, -2], [56, -1], [55, 0], [54, 0], [53, 0],
      [52, 1], [51, 1], [50, 0], [50, -5],
    ],
  },
  // Australia
  {
    name: 'Australia',
    vertices: [
      [-12, 130], [-14, 127], [-15, 124], [-18, 122],
      [-22, 114], [-28, 114], [-32, 115], [-35, 118],
      [-37, 140], [-38, 145], [-37, 150], [-35, 153],
      [-30, 153], [-25, 152], [-20, 149], [-17, 146],
      [-15, 145], [-12, 142], [-12, 136], [-14, 133],
    ],
  },
  // New Zealand
  {
    name: 'New Zealand',
    vertices: [
      [-35, 173], [-37, 174], [-39, 175], [-42, 174],
      [-46, 167], [-44, 168], [-42, 172], [-39, 177],
      [-37, 176], [-35, 174],
    ],
  },
  // Indonesia
  {
    name: 'Indonesia',
    vertices: [
      [-2, 98], [-5, 105], [-8, 112], [-8, 118],
      [-6, 120], [-8, 125], [-5, 130], [-8, 135],
      [-6, 140], [-8, 138], [-10, 130], [-10, 120],
      [-8, 110], [-5, 100], [-2, 98],
    ],
  },
  // Iceland
  {
    name: 'Iceland',
    vertices: [
      [63, -24], [64, -22], [66, -18], [66, -14],
      [65, -14], [64, -18], [63, -22],
    ],
  },
  // Sri Lanka
  {
    name: 'Sri Lanka',
    vertices: [
      [10, 80], [8, 80], [6, 80], [6, 82], [8, 82], [10, 80],
    ],
  },
  // Philippines
  {
    name: 'Philippines',
    vertices: [
      [18, 120], [14, 121], [10, 124], [7, 126],
      [10, 124], [14, 122], [18, 122],
    ],
  },
  // Taiwan
  {
    name: 'Taiwan',
    vertices: [
      [25, 121], [23, 120], [22, 121], [23, 122], [25, 121],
    ],
  },
];

function pointInPolygon(lat: number, lng: number, vertices: [number, number][]): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i][0], yi = vertices[i][1];
    const xj = vertices[j][0], yj = vertices[j][1];
    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isLandCheck(lat: number, lng: number): boolean {
  for (const continent of CONTINENTS) {
    if (pointInPolygon(lat, lng, continent.vertices)) {
      return true;
    }
  }
  return false;
}

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
      if (isLandCheck(lat, lng)) {
        dots.push(latLngToVec3(lat, lng, radius));
      }
    }
  }
  return dots;
}
