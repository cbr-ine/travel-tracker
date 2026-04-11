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

// ─── Component (v3: fixed ref + projection) ───

export default function ChinaMap({
  visitedPlaces = [],
  onTogglePlace,
  isDark = false,
  className = '',
}: ChinaMapProps) {
  // containerRef stays on the OUTER wrapper at ALL times (never switches between loading/map)
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Data state
  const [geoFeatures, setGeoFeatures] = useState<GeoFeature[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Layout state — initialise from window (more reliable than a static fallback)
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

  // ─── Fetch GeoJSON from server proxy ───

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch('/api/china-geojson');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;

        // Filter out features with empty names (e.g. 九段线 100000_JD)
        const features = (data.features || [])
          .filter((f: any) => {
            const name = String(f?.properties?.name || '').trim();
            return name.length > 0;
          }) as GeoFeature[];

        console.log('[ChinaMap] loaded', features.length, 'valid features');
        setGeoFeatures(features);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load map data');
          console.error('[ChinaMap] fetch error:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  // ─── Measure container (always attached to the same outer div) ───

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    };

    measure();

    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // ─── Projection & path generator ───

  const { projection, pathGen } = useMemo(() => {
    if (!geoFeatures || geoFeatures.length === 0) return { projection: null, pathGen: null };

    const featureCollection = {
      type: 'FeatureCollection' as const,
      features: geoFeatures,
    };

    // Use fitExtent with 2 % padding on each side (4 % total) so provinces
    // don't touch the SVG edges.
    const padding = Math.min(dimensions.width, dimensions.height) * 0.02;
    const proj = geoMercator()
      .fitExtent(
        [[padding, padding], [dimensions.width - padding, dimensions.height - padding]],
        featureCollection as unknown as GeoJSON.FeatureCollection,
      );

    return {
      projection: proj,
      pathGen: geoPath(proj) as (obj: any) => string | null,
    };
  }, [geoFeatures, dimensions]);

  // ─── Pre-compute province paths ───

  const provincePaths = useMemo(() => {
    if (!geoFeatures || !pathGen) return null;
    return geoFeatures.map((f) => {
      const props = f.properties;
      const rawAdcode = props.adcode;
      const adcode = Number(rawAdcode) || 0;
      const name = String(props.name || '').trim();
      const isVisited = visitedSet.has(name) || visitedSet.has(String(rawAdcode));
      const isHovered = hoveredAdcode === adcode;
      let fill: string;
      if (isVisited) {
        fill = isHovered ? c.visitedHover : c.visited;
      } else {
        fill = isHovered ? c.unvisitedHover : c.unvisited;
      }
      const d = pathGen(f) || '';
      return { d, adcode, name, isVisited, isHovered, fill, props };
    });
  }, [geoFeatures, pathGen, visitedSet, hoveredAdcode, c]);

  // ─── Province click ───

  const handleProvinceClick = useCallback(
    (e: React.MouseEvent, props: Record<string, any>) => {
      e.stopPropagation();
      const name = String(props.name || '').trim();
      const adcode = String(props.adcode || '');
      const center = props.center || props.centroid;
      const lat = Array.isArray(center) && typeof center[1] === 'number' ? center[1] : 0;
      const lng = Array.isArray(center) && typeof center[0] === 'number' ? center[0] : 0;
      if (!name) return;
      onTogglePlace(name, name, adcode, 'province', lat, lng);
    },
    [onTogglePlace],
  );

  // ─── Mouse move for tooltip ───

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  // ─── Render ───
  // IMPORTANT: containerRef is ALWAYS on the outer div — never switches.

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${className}`}
      style={{ background: c.ocean, overflow: 'hidden' }}
      onMouseMove={handleMouseMove}
    >
      {/* ── Loading overlay ── */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{ borderColor: isDark ? '#333' : '#ddd', borderTopColor: isDark ? '#888' : '#555' }}
            />
            <span className="text-xs font-mono uppercase tracking-widest" style={{ color: c.title }}>
              Loading Map...
            </span>
          </div>
        </div>
      )}

      {/* ── Error overlay ── */}
      {!loading && (error || !geoFeatures) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm" style={{ color: c.title }}>Failed to load map</span>
            <span className="text-xs" style={{ color: c.title }}>{error || 'No data'}</span>
          </div>
        </div>
      )}

      {/* ── SVG Map (always mounted once container exists) ── */}
      {geoFeatures && pathGen && provincePaths && (
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          style={{ display: 'block' }}
        >
          {provincePaths.map((province, idx) => (
            <path
              key={province.adcode || `province-${idx}`}
              d={province.d}
              fill={province.fill}
              stroke={province.isVisited ? c.visitedHover : c.border}
              strokeWidth={0.5}
              strokeLinejoin="round"
              style={{
                transition: 'fill 0.15s ease',
                cursor: province.name ? 'pointer' : 'default',
                filter: province.isVisited
                  ? `drop-shadow(0 0 3px ${c.visitedGlow})`
                  : undefined,
              }}
              onClick={(e) => {
                if (province.name) handleProvinceClick(e, province.props);
              }}
              onMouseEnter={() => province.name && setHoveredAdcode(province.adcode)}
              onMouseLeave={() => setHoveredAdcode(null)}
            />
          ))}
        </svg>
      )}

      {/* ── CHINA MAP title ── */}
      <div
        className="absolute top-4 left-4 pointer-events-none z-20"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
      >
        <div
          className="text-[10px] font-semibold uppercase"
          style={{ color: c.title, letterSpacing: '0.25em', opacity: 0.6 }}
        >
          China Map
        </div>
      </div>

      {/* ── Province count badge ── */}
      {geoFeatures && (
        <div
          className="absolute top-4 right-4 pointer-events-none z-20 px-3 py-1.5 rounded-full text-xs font-mono font-medium"
          style={{ background: c.badge, color: c.badgeText, backdropFilter: 'blur(8px)' }}
        >
          {provinceCount}/{geoFeatures.length} 省份
        </div>
      )}

      {/* ── Debug: show dimensions ── */}
      {geoFeatures && (
        <div
          className="absolute bottom-2 left-2 pointer-events-none z-20 text-[9px] font-mono"
          style={{ color: c.title, opacity: 0.35 }}
        >
          {dimensions.width}×{dimensions.height}
        </div>
      )}

      {/* ── Tooltip ── */}
      {hoveredAdcode !== null && (() => {
        const p = provincePaths?.find((pp) => pp.adcode === hoveredAdcode);
        if (!p || !p.name) return null;
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
