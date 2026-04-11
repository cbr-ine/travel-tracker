'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { geoMercator, geoPath } from 'd3-geo';

// ─── Types ───

interface VisitedPlace {
  name: string;
  province: string;
  adcode: string;
  level: string;
}

interface ChinaMapProps {
  visitedPlaces: VisitedPlace[];
  onTogglePlace: (name: string, province: string, adcode: string, level: string, lat: number, lng: number) => void;
  isDark?: boolean;
  className?: string;
}

interface ProvinceFeature {
  type: string;
  properties: {
    adcode: number;
    name: string;
    center?: [number, number];
    centroid?: [number, number];
  };
  geometry: GeoJSON.Geometry;
}

// ─── Colors ───

const COLORS = {
  light: {
    ocean: '#fafafa',
    unvisited: '#e5e7eb',
    unvisitedHover: '#d1d5db',
    border: '#d1d5db',
    visited: 'rgba(251, 191, 36, 0.65)',
    visitedHover: 'rgba(251, 191, 36, 0.85)',
    visitedGlow: 'rgba(251, 191, 36, 0.3)',
    title: '#a0a0a0',
    badge: 'rgba(23, 23, 23, 0.75)',
    badgeText: '#fafafa',
    tooltip: 'rgba(23, 23, 23, 0.85)',
    tooltipText: '#fafafa',
  },
  dark: {
    ocean: '#0a0a0a',
    unvisited: '#262626',
    unvisitedHover: '#333333',
    border: '#404040',
    visited: 'rgba(251, 191, 36, 0.55)',
    visitedHover: 'rgba(251, 191, 36, 0.75)',
    visitedGlow: 'rgba(251, 191, 36, 0.2)',
    title: '#555555',
    badge: 'rgba(250, 250, 250, 0.85)',
    badgeText: '#171717',
    tooltip: 'rgba(250, 250, 250, 0.9)',
    tooltipText: '#171717',
  },
};

// ─── Component ───

export default function ChinaMap({
  visitedPlaces = [],
  onTogglePlace,
  isDark = false,
  className = '',
}: ChinaMapProps) {
  // Data state
  const [geoFeatures, setGeoFeatures] = useState<ProvinceFeature[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Interaction state
  const [hoveredAdcode, setHoveredAdcode] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Colors
  const c = isDark ? COLORS.dark : COLORS.light;

  // Visited set for fast lookup
  const visitedSet = useMemo(() => {
    const set = new Set<string>();
    visitedPlaces.forEach((p) => {
      set.add(p.name);
      set.add(String(p.adcode));
    });
    return set;
  }, [visitedPlaces]);

  const provinceCount = useMemo(
    () => new Set(visitedPlaces.filter((p) => p.level === 'province').map((p) => p.adcode)).size,
    [visitedPlaces]
  );

  // Fetch GeoJSON from server proxy
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch('/api/china-geojson');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (cancelled) return;

        const features = (data.features || []) as ProvinceFeature[];
        setGeoFeatures(features);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load map data');
          console.error('Failed to load China map:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Measure container
  useEffect(() => {
    function updateSize() {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - 64, // subtract bottom nav
      });
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Projection & path generator
  const pathGen = useMemo(() => {
    if (!geoFeatures || geoFeatures.length === 0) return null;

    const featureCollection = {
      type: 'FeatureCollection' as const,
      features: geoFeatures,
    };

    const projection = geoMercator()
      .fitSize([dimensions.width, dimensions.height], featureCollection as unknown as GeoJSON.FeatureCollection)
      .clipExtent([[0, 0], [dimensions.width, dimensions.height]]);

    return geoPath(projection) as (obj: any) => string | null;
  }, [geoFeatures, dimensions]);

  // Pre-compute province paths
  const provincePaths = useMemo(() => {
    if (!geoFeatures || !pathGen) return null;

    return geoFeatures.map((f) => {
      const adcode = f.properties.adcode;
      const name = f.properties.name;
      const isVisited = visitedSet.has(name) || visitedSet.has(String(adcode));
      const isHovered = hoveredAdcode === adcode;

      let fill: string;
      if (isVisited) {
        fill = isHovered ? c.visitedHover : c.visited;
      } else {
        fill = isHovered ? c.unvisitedHover : c.unvisited;
      }

      const d = pathGen(f) || '';

      return { d, adcode, name, isVisited, isHovered, fill };
    });
  }, [geoFeatures, pathGen, visitedSet, hoveredAdcode, c]);

  // Province click
  const handleProvinceClick = useCallback(
    (e: React.MouseEvent, feature: ProvinceFeature) => {
      e.stopPropagation();
      const name = feature.properties.name;
      const adcode = String(feature.properties.adcode);
      const center = feature.properties.center || feature.properties.centroid || [0, 0];
      onTogglePlace(name, name, adcode, 'province', center[1], center[0]);
    },
    [onTogglePlace]
  );

  // Mouse move for tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  // ─── Loading state ───

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ background: c.ocean }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{
              borderColor: isDark ? '#333' : '#ddd',
              borderTopColor: isDark ? '#888' : '#555',
            }}
          />
          <span
            className="text-xs font-mono uppercase tracking-widest"
            style={{ color: c.title }}
          >
            Loading Map...
          </span>
        </div>
      </div>
    );
  }

  // ─── Error state ───

  if (error || !geoFeatures || !pathGen || !provincePaths) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ background: c.ocean }}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm" style={{ color: c.title }}>Failed to load map</span>
          <span className="text-xs" style={{ color: c.title }}>{error || 'No data'}</span>
        </div>
      </div>
    );
  }

  // ─── Map render ───

  return (
    <div
      className={`relative select-none ${className}`}
      style={{ background: c.ocean, overflow: 'hidden' }}
      onMouseMove={handleMouseMove}
    >
      {/* SVG Map */}
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        style={{ display: 'block' }}
      >
        {provincePaths.map((province) => (
          <path
            key={province.adcode}
            d={province.d}
            fill={province.fill}
            stroke={province.isVisited ? c.visitedHover : c.border}
            strokeWidth={0.5}
            strokeLinejoin="round"
            style={{
              transition: 'fill 0.15s ease',
              cursor: 'pointer',
              filter: province.isVisited
                ? `drop-shadow(0 0 3px ${c.visitedGlow})`
                : undefined,
            }}
            onClick={(e) => {
              const f = geoFeatures.find((gf) => gf.properties.adcode === province.adcode);
              if (f) handleProvinceClick(e, f);
            }}
            onMouseEnter={() => setHoveredAdcode(province.adcode)}
            onMouseLeave={() => setHoveredAdcode(null)}
          />
        ))}
      </svg>

      {/* CHINA MAP title */}
      <div
        className="absolute top-4 left-4 pointer-events-none"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
      >
        <div
          className="text-[10px] font-semibold uppercase"
          style={{ color: c.title, letterSpacing: '0.25em', opacity: 0.6 }}
        >
          China Map
        </div>
      </div>

      {/* Province count badge */}
      <div
        className="absolute top-4 right-4 pointer-events-none px-3 py-1.5 rounded-full text-xs font-mono font-medium"
        style={{ background: c.badge, color: c.badgeText, backdropFilter: 'blur(8px)' }}
      >
        {provinceCount}/34 省份
      </div>

      {/* Tooltip */}
      {hoveredAdcode !== null && (() => {
        const p = provincePaths.find((pp) => pp.adcode === hoveredAdcode);
        if (!p) return null;
        return (
          <div
            className="fixed pointer-events-none z-50 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
            style={{
              background: c.tooltip,
              color: c.tooltipText,
              left: mousePos.x + 14,
              top: mousePos.y - 10,
              transform: 'translateY(-100%)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {p.name}
            {p.isVisited && (
              <span
                className="ml-1.5 inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: '#fbbf24', verticalAlign: 'middle' }}
              />
            )}
          </div>
        );
      })()}
    </div>
  );
}
