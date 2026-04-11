'use client';

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
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

interface GeoFeature {
  type: string;
  id?: string;
  properties: Record<string, any>;
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
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [geoFeatures, setGeoFeatures] = useState<GeoFeature[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredAdcode, setHoveredAdcode] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const c = isDark ? COLORS.dark : COLORS.light;

  // Visited set
  const visitedSet = useMemo(() => {
    const set = new Set<string>();
    visitedPlaces.forEach((p) => { set.add(p.name); set.add(String(p.adcode)); });
    return set;
  }, [visitedPlaces]);

  const provinceCount = useMemo(
    () => new Set(visitedPlaces.filter((p) => p.level === 'province').map((p) => p.adcode)).size,
    [visitedPlaces],
  );

  // ─── Fetch GeoJSON (exact same pattern as WorldMap) ───

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/china-geojson');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        // Convert raw features → clean GeoFeature[] (filter empty names)
        const features: GeoFeature[] = (data.features || [])
          .filter((f: any) => String(f?.properties?.name || '').trim().length > 0)
          .map((f: any) => ({
            type: f.type,
            id: f.id || String(f.properties?.adcode || ''),
            properties: f.properties,
            geometry: f.geometry,
          }));

        console.log('[ChinaMap] fetched', features.length, 'provinces');
        setGeoFeatures(features);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Fetch failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── ResizeObserver (exact same pattern as WorldMap) ───

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ─── Projection & path (exact same pattern as WorldMap) ───

  const projectionPath = useMemo(() => {
    if (!geoFeatures || geoFeatures.length === 0) return null;

    // Build clean FeatureCollection — SAME as WorldMap
    const featureCollection = {
      type: 'FeatureCollection' as const,
      features: geoFeatures.map((f) => ({
        type: f.type,
        id: f.id,
        properties: f.properties,
        geometry: f.geometry,
      })),
    };

    const projection = geoMercator()
      .fitSize([dimensions.width, dimensions.height], featureCollection as unknown as GeoJSON.FeatureCollection)
      .clipExtent([[0, 0], [dimensions.width, dimensions.height]]);

    const pathGen = geoPath(projection) as (obj: any) => string | null;

    // Debug log
    console.log('[ChinaMap] projection:', {
      w: dimensions.width,
      h: dimensions.height,
      scale: Math.round(projection.scale()),
      center: projection.center().map((v: number) => Math.round(v * 100) / 100),
    });

    return { projection, pathGen };
  }, [geoFeatures, dimensions]);

  // ─── Pre-compute province paths ───

  const provincePaths = useMemo(() => {
    if (!geoFeatures || !projectionPath) return null;

    return geoFeatures.map((f) => {
      const props = f.properties;
      const adcode = String(props.adcode || '');
      const name = String(props.name || '').trim();
      const isVisited = visitedSet.has(name) || visitedSet.has(adcode);
      const isHovered = hoveredAdcode === adcode;
      const fill = isVisited
        ? (isHovered ? c.visitedHover : c.visited)
        : (isHovered ? c.unvisitedHover : c.unvisited);
      const d = projectionPath.pathGen(f) || '';
      return { d, adcode, name, isVisited, isHovered, fill, props };
    });
  }, [geoFeatures, projectionPath, visitedSet, hoveredAdcode, c]);

  // ─── Handlers ───

  const handleClick = useCallback(
    (e: React.MouseEvent, feature: GeoFeature) => {
      e.stopPropagation();
      const name = String(feature.properties.name || '').trim();
      const adcode = String(feature.properties.adcode || '');
      const center = feature.properties.center || feature.properties.centroid;
      const lat = Array.isArray(center) && typeof center[1] === 'number' ? center[1] : 0;
      const lng = Array.isArray(center) && typeof center[0] === 'number' ? center[0] : 0;
      if (!name) return;
      onTogglePlace(name, name, adcode, 'province', lat, lng);
    },
    [onTogglePlace],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    },
    [],
  );

  // ─── Loading ───

  if (loading) {
    return (
      <div ref={containerRef} className={`flex items-center justify-center ${className}`} style={{ background: c.ocean }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: isDark ? '#333' : '#ddd', borderTopColor: isDark ? '#888' : '#555' }} />
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: c.title }}>Loading...</span>
        </div>
      </div>
    );
  }

  // ─── Error ───

  if (error || !geoFeatures || !projectionPath) {
    return (
      <div ref={containerRef} className={`flex items-center justify-center ${className}`} style={{ background: c.ocean }}>
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm" style={{ color: c.title }}>Failed to load map</span>
          <span className="text-xs" style={{ color: c.title }}>{error || 'No data'}</span>
        </div>
      </div>
    );
  }

  // ─── Map ───

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${className}`}
      style={{ background: c.ocean, overflow: 'hidden' }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="w-full h-full"
        style={{ cursor: 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredAdcode(null)}
      >
        {provincePaths?.map((p, idx) => (
          <path
            key={p.adcode || `province-${idx}`}
            d={p.d}
            fill={p.fill}
            stroke={c.border}
            strokeWidth={0.5}
            strokeLinejoin="round"
            style={{
              transition: 'fill 0.15s ease',
              cursor: p.name ? 'pointer' : 'default',
              filter: p.isVisited ? `drop-shadow(0 0 3px ${c.visitedGlow})` : undefined,
            }}
            onClick={(e) => {
              const f = geoFeatures.find((gf) => String(gf.properties.adcode) === p.adcode);
              if (f) handleClick(e, f);
            }}
            onMouseEnter={() => p.name && setHoveredAdcode(p.adcode)}
            onMouseLeave={() => setHoveredAdcode(null)}
          />
        ))}
      </svg>

      {/* Title */}
      <div className="absolute top-4 left-4 pointer-events-none z-20"
        style={{ fontFamily: 'ui-monospace, monospace' }}>
        <div className="text-[10px] font-semibold uppercase" style={{ color: c.title, letterSpacing: '0.25em', opacity: 0.6 }}>
          China Map
        </div>
      </div>

      {/* Badge */}
      <div className="absolute top-4 right-4 pointer-events-none z-20 px-3 py-1.5 rounded-full text-xs font-mono font-medium"
        style={{ background: c.badge, color: c.badgeText, backdropFilter: 'blur(8px)' }}>
        {provinceCount}/{geoFeatures.length} 省份
      </div>

      {/* Tooltip */}
      {hoveredAdcode !== null && (
        <div
          className="absolute pointer-events-none z-50 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
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
          {(() => {
            const p = provincePaths?.find((pp) => pp.adcode === hoveredAdcode);
            if (!p?.name) return '';
            return (
              <span>
                {p.name}
                {p.isVisited && <span className="ml-1.5 inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#fbbf24', verticalAlign: 'middle' }} />}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}
