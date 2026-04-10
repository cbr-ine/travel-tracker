'use client';

import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { latLngToFlat } from '@/lib/geo';

// ─── Types ───

export interface FlatMapTrajectoryPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
}

export interface FlatMapTrajectory {
  id: string;
  name: string;
  color: string;
  locations: FlatMapTrajectoryPoint[];
}

interface FlatMapProps {
  trajectories?: FlatMapTrajectory[];
  onTrajectoryClick?: (trajectory: FlatMapTrajectory) => void;
  focusTrajectoryId?: string | null;
  className?: string;
}

// ─── Simplified world coastline outlines (equirectangular projection) ───
// These are very simplified polygon paths for major landmasses
const CONTINENT_PATHS: { d: string; className?: string }[] = [
  // North America (simplified)
  { d: 'M 125 42 L 125 48 L 122 52 L 118 56 L 118 60 L 115 63 L 112 67 L 108 70 L 104 72 L 100 74 L 97 77 L 95 80 L 90 82 L 85 84 L 80 84 L 75 82 L 70 78 L 65 75 L 60 72 L 58 68 L 55 62 L 52 56 L 50 50 L 48 46 L 48 42 L 50 38 L 54 36 L 60 36 L 65 38 L 70 40 L 75 42 L 80 45 L 85 48 L 90 50 L 95 48 L 100 46 L 105 44 L 110 42 L 115 40 L 120 38 L 125 42 Z' },
  // South America
  { d: 'M 138 132 L 135 128 L 132 122 L 130 116 L 128 110 L 126 104 L 124 98 L 122 92 L 120 86 L 118 80 L 116 76 L 114 72 L 112 68 L 114 64 L 118 60 L 122 58 L 126 56 L 130 55 L 134 56 L 138 58 L 140 62 L 142 68 L 144 75 L 145 82 L 146 90 L 146 98 L 145 106 L 144 112 L 142 118 L 140 124 L 138 128 L 138 132 Z' },
  // Europe
  { d: 'M 182 38 L 186 36 L 190 36 L 194 38 L 198 40 L 202 42 L 206 44 L 208 48 L 206 52 L 204 56 L 200 58 L 196 60 L 192 62 L 188 64 L 186 68 L 184 72 L 182 76 L 180 78 L 178 76 L 176 72 L 178 68 L 180 64 L 182 60 L 180 56 L 178 52 L 176 48 L 178 44 L 180 40 L 182 38 Z' },
  // Africa
  { d: 'M 182 80 L 186 78 L 190 80 L 194 82 L 198 85 L 202 88 L 206 92 L 208 96 L 210 100 L 212 106 L 214 112 L 214 118 L 212 124 L 210 130 L 206 136 L 202 140 L 198 142 L 194 144 L 190 142 L 186 138 L 184 132 L 182 126 L 180 120 L 178 114 L 176 108 L 174 102 L 174 96 L 176 90 L 178 84 L 180 80 L 182 80 Z' },
  // Asia (simplified)
  { d: 'M 208 36 L 212 34 L 218 34 L 224 36 L 230 38 L 236 40 L 242 42 L 248 44 L 254 48 L 260 50 L 264 54 L 268 58 L 272 62 L 274 66 L 272 70 L 268 72 L 264 74 L 258 74 L 252 72 L 248 68 L 244 64 L 240 62 L 236 64 L 232 68 L 228 72 L 224 76 L 220 78 L 216 76 L 212 72 L 210 68 L 208 64 L 206 58 L 204 52 L 204 46 L 206 40 L 208 36 Z' },
  // Australia
  { d: 'M 304 154 L 308 150 L 314 148 L 320 148 L 326 150 L 332 154 L 336 160 L 338 166 L 336 172 L 332 176 L 326 178 L 320 178 L 314 176 L 308 172 L 304 168 L 302 162 L 302 156 L 304 154 Z' },
  // Greenland
  { d: 'M 148 24 L 152 20 L 158 20 L 162 22 L 164 28 L 162 34 L 158 38 L 154 38 L 150 36 L 148 30 L 148 24 Z' },
  // UK/Ireland
  { d: 'M 178 36 L 180 34 L 182 36 L 182 40 L 180 42 L 178 40 L 178 36 Z' },
  // Japan
  { d: 'M 296 42 L 298 40 L 300 42 L 300 48 L 298 52 L 296 50 L 296 42 Z' },
  // Indonesia
  { d: 'M 288 102 L 292 100 L 298 100 L 304 102 L 308 104 L 306 106 L 300 106 L 294 104 L 288 102 Z' },
];

// ─── Grid lines for the flat map ───

function MapGrid() {
  const lines: JSX.Element[] = [];

  // Latitude lines every 30°
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = 50 - (lat / 180) * 100; // map to 0-100 range
    lines.push(
      <line
        key={`lat-${lat}`}
        x1="0%" y1={`${y}%`} x2="100%" y2={`${y}%`}
        stroke="#e5e5e5" strokeWidth="0.3" strokeDasharray="2,2"
      />
    );
  }

  // Longitude lines every 30°
  for (let lng = -180; lng <= 150; lng += 30) {
    const x = 50 + (lng / 360) * 100; // map to 0-100 range
    lines.push(
      <line
        key={`lng-${lng}`}
        x1={`${x}%`} y1="5%" x2={`${x}%`} y2="95%"
        stroke="#e5e5e5" strokeWidth="0.3" strokeDasharray="2,2"
      />
    );
  }

  // Equator
  lines.push(
    <line
      key="equator"
      x1="0%" y1="50%" x2="100%" y2="50%"
      stroke="#d4d4d4" strokeWidth="0.5"
    />
  );

  return <g>{lines}</g>;
}

// ─── Convert lat/lng to SVG coordinates in viewBox (0-360 x 0-180) ───

function toSvgCoord(lat: number, lng: number): { x: number; y: number } {
  return {
    x: 180 + lng,
    y: 90 - lat,
  };
}

// ─── Component ───

export default function FlatMap({
  trajectories = [],
  onTrajectoryClick,
  focusTrajectoryId,
  className = '',
}: FlatMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [svgRef, setSvgRef] = useState<SVGSVGElement | null>(null);

  // Compute viewBox when a trajectory is focused
  const viewBox = useMemo(() => {
    if (focusTrajectoryId) {
      const traj = trajectories.find((t) => t.id === focusTrajectoryId);
      if (traj && traj.locations.length > 0) {
        let minLng = Infinity, maxLng = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;
        for (const loc of traj.locations) {
          minLng = Math.min(minLng, loc.lng);
          maxLng = Math.max(maxLng, loc.lng);
          minLat = Math.min(minLat, loc.lat);
          maxLat = Math.max(maxLat, loc.lat);
        }
        const padding = 20;
        const cx = (minLng + maxLng) / 2;
        const cy = (minLat + maxLat) / 2;
        const w = Math.max((maxLng - minLng) + padding * 2, 40);
        const h = Math.max((maxLat - minLat) + padding * 2, 30);
        return `${180 + cx - w / 2} ${90 - cy - h / 2} ${w} ${h}`;
      }
    }
    return '0 0 360 180';
  }, [focusTrajectoryId, trajectories]);

  const handleResetView = useCallback(() => {
    // viewBox is controlled by useMemo, so removing focus will reset
  }, []);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <svg
        ref={setSvgRef}
        viewBox={viewBox}
        className="w-full h-full"
        style={{ background: '#fafafa' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Ocean background dots (pixel grid) */}
        <defs>
          <pattern id="ocean-dots" width="3" height="3" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="0.3" fill="#e8e8e8" />
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#ocean-dots)" />

        {/* Grid */}
        <MapGrid />

        {/* Landmass shapes */}
        <g fill="#d4d4d4" stroke="#bbb" strokeWidth="0.3">
          {CONTINENT_PATHS.map((path, i) => (
            <path key={i} d={path.d} className={path.className} />
          ))}
        </g>

        {/* Pixel landmass overlay using actual dot positions for a more accurate look */}
        <PixelLandDots />

        {/* Trajectories */}
        {trajectories.map((traj) => {
          const sorted = [...traj.locations].sort((a, b) => a.order - b.order);
          const isFocused = traj.id === focusTrajectoryId;
          const isHovered = traj.id === hoveredId;

          return (
            <g
              key={traj.id}
              onClick={() => onTrajectoryClick?.(traj)}
              onMouseEnter={() => setHoveredId(traj.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Connecting lines */}
              {sorted.length >= 2 && (
                <polyline
                  points={sorted
                    .map((loc) => {
                      const { x, y } = toSvgCoord(loc.lat, loc.lng);
                      return `${x},${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke={traj.color}
                  strokeWidth={isFocused ? 1.5 : isHovered ? 1.2 : 0.8}
                  strokeOpacity={isFocused ? 0.9 : 0.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Location dots */}
              {sorted.map((loc, idx) => {
                const { x, y } = toSvgCoord(loc.lat, loc.lng);
                const isFirst = idx === 0;
                const isLast = idx === sorted.length - 1;
                const r = isFirst || isLast ? 2.5 : 1.5;

                return (
                  <g key={loc.id || idx}>
                    {/* Glow ring for start/end */}
                    {(isFirst || isLast) && (
                      <circle
                        cx={x} cy={y} r={r + 2}
                        fill={traj.color} opacity={0.15}
                      />
                    )}
                    {/* Outer ring */}
                    {(isFirst || isLast) && (
                      <circle
                        cx={x} cy={y} r={r + 0.8}
                        fill="none" stroke={traj.color}
                        strokeWidth="0.5" strokeOpacity={0.5}
                      />
                    )}
                    {/* Main dot */}
                    <circle
                      cx={x} cy={y} r={r}
                      fill={traj.color}
                      stroke="white"
                      strokeWidth="0.5"
                      filter={isFocused || isHovered ? 'url(#glow)' : undefined}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Map attribution */}
      <div className="absolute bottom-2 left-2 text-[9px] text-neutral-300 pointer-events-none font-mono">
        Equirectangular Projection
      </div>
    </div>
  );
}

// ─── Pixel-style land dots using simplified continent data ───

function PixelLandDots() {
  const dots = useMemo(() => {
    // Generate a grid of dots for land areas (simplified)
    const result: { cx: number; cy: number }[] = [];
    const step = 3.6; // Every ~3.6 degrees

    for (let lat = -70; lat <= 75; lat += step) {
      for (let lng = -180; lng <= 180; lng += step) {
        if (isApproxLand(lat, lng)) {
          const { x, y } = toSvgCoord(lat, lng);
          result.push({ cx: x, cy: y });
        }
      }
    }
    return result;
  }, []);

  return (
    <g>
      {dots.map((dot, i) => (
        <rect
          key={i}
          x={dot.cx - 0.6}
          y={dot.cy - 0.6}
          width={1.2}
          height={1.2}
          fill="#a3a3a3"
          opacity={0.5}
          rx={0.2}
        />
      ))}
    </g>
  );
}

// Very rough land detection for pixel dots
function isApproxLand(lat: number, lng: number): boolean {
  // North America
  if (lat > 25 && lat < 72 && lng > -130 && lng < -60) return true;
  // Central America
  if (lat > 10 && lat < 25 && lng > -105 && lng < -75) return true;
  // South America
  if (lat > -55 && lat < 12 && lng > -80 && lng < -35) return true;
  // Europe
  if (lat > 36 && lat < 70 && lng > -10 && lng < 40) return true;
  // Africa
  if (lat > -35 && lat < 37 && lng > -18 && lng < 52) return true;
  // Middle East
  if (lat > 12 && lat < 40 && lng > 35 && lng < 60) return true;
  // Asia
  if (lat > 10 && lat < 75 && lng > 60 && lng < 145) return true;
  // Southeast Asia
  if (lat > -10 && lat < 20 && lng > 95 && lng < 140) return true;
  // Japan/Korea
  if (lat > 30 && lat < 46 && lng > 128 && lng < 146) return true;
  // Australia
  if (lat > -40 && lat < -10 && lng > 112 && lng < 155) return true;
  // New Zealand
  if (lat > -48 && lat < -34 && lng > 165 && lng < 179) return true;
  // Greenland
  if (lat > 60 && lat < 83 && lng > -55 && lng < -15) return true;
  // Iceland
  if (lat > 63 && lat < 67 && lng > -25 && lng < -13) return true;
  // Russia/Siberia
  if (lat > 50 && lat < 75 && lng > 40 && lng < 180) return true;
  // India
  if (lat > 8 && lat < 35 && lng > 68 && lng < 90) return true;
  // UK/Ireland
  if (lat > 50 && lat < 59 && lng > -11 && lng < 2) return true;
  // Madagascar
  if (lat > -26 && lat < -12 && lng > 43 && lng < 50) return true;
  return false;
}
