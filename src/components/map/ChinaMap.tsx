'use client';

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { geoMercator, geoPath, geoBounds } from 'd3-geo';

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
  // containerRef stays on the OUTER wrapper — never moves between renders
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [geoFeatures, setGeoFeatures] = useState<GeoFeature[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredAdcode, setHoveredAdcode] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const c = isDark ? COLORS.dark : COLORS.light;

  // Visited set — use adcode as unique key
  const visitedAdcodeSet = useMemo(() => {
    const set = new Set<string>();
    visitedPlaces.forEach((p) => set.add(String(p.adcode)));
    return set;
  }, [visitedPlaces]);

  const provinceCount = useMemo(
    () => new Set(visitedPlaces.filter((p) => p.level === 'province').map((p) => p.adcode)).size,
    [visitedPlaces],
  );

  // ─── Fetch GeoJSON ───

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/china-geojson');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        // Keep ALL features with a valid name (filters out 九段线 which has empty name)
        const features: GeoFeature[] = (data.features || [])
          .filter((f: any) => {
            const name = String(f?.properties?.name || '').trim();
            return name.length > 0;
          })
          .map((f: any) => ({
            type: f.type,
            id: f.id || String(f.properties?.adcode || ''),
            properties: f.properties,
            geometry: f.geometry,
          }));

        console.log('[ChinaMap] fetched', features.length, 'provinces:', features.map(f => f.properties.name).join(', '));

        if (features.length < 30) {
          console.warn('[ChinaMap] Insufficient features:', features.length, '(expected ~34)');
        }

        setGeoFeatures(features);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Fetch failed');
          console.error('[ChinaMap] fetch error:', e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── ResizeObserver — stays on the same wrapperRef forever ───

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      // Only update if dimensions are meaningful
      if (w > 50 && h > 50) {
        setDimensions({ width: w, height: h });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ─── Projection & path ───

  const projectionPath = useMemo(() => {
    if (!geoFeatures || geoFeatures.length === 0) return null;

    const w = dimensions.width;
    const h = dimensions.height;

    // Need valid dimensions
    if (w < 50 || h < 50) {
      console.warn('[ChinaMap] dimensions too small:', w, 'x', h, '— waiting...');
      return null;
    }

    // Build FeatureCollection — exact same pattern as working WorldMap
    const featureCollection = {
      type: 'FeatureCollection' as const,
      features: geoFeatures.map((f) => ({
        type: f.type,
        id: f.id,
        properties: f.properties,
        geometry: f.geometry,
      })),
    };

    // Debug: check bounding box of raw GeoJSON
    const rawBounds = geoBounds(featureCollection);
    const [[lon0, lat0], [lon1, lat1]] = rawBounds;
    console.log('[ChinaMap] raw geoBounds:', { lon0, lat0, lon1, lat1 });
    console.log('[ChinaMap] features in collection:', featureCollection.features.length);

    let projection;
    try {
      // Use fitSize exactly like WorldMap
      projection = geoMercator()
        .fitSize([w, h], featureCollection as unknown as GeoJSON.FeatureCollection);
    } catch (err) {
      console.error('[ChinaMap] fitSize failed, using hardcoded China projection:', err);
      projection = geoMercator()
        .center([104.5, 37.5])
        .scale(Math.min(w, h) * 1.1)
        .translate([w / 2, h / 2]);
    }

    // Verify projection is sane
    const scale = projection.scale();
    const center = projection.center();
    console.log('[ChinaMap] projection:', { w, h, scale: Math.round(scale), center });

    // If projection looks wrong (zoomed into tiny area), use fallback
    if (scale > 50000 || scale < 10) {
      console.warn('[ChinaMap] scale looks wrong:', scale, '— using fallback');
      projection = geoMercator()
        .center([104.5, 37.5])
        .scale(Math.min(w, h) * 1.1)
        .translate([w / 2, h / 2]);
    }

    const pathGen = geoPath(projection) as (obj: any) => string | null;
    return { projection, pathGen };
  }, [geoFeatures, dimensions]);

  // ─── Pre-compute province paths ───

  const provincePaths = useMemo(() => {
    if (!geoFeatures || !projectionPath) return null;

    return geoFeatures.map((f) => {
      const props = f.properties;
      const adcode = String(props.adcode || '');
      const name = String(props.name || '').trim();
      const isVisited = visitedAdcodeSet.has(adcode);
      const isHovered = hoveredAdcode === adcode;
      const fill = isVisited
        ? (isHovered ? c.visitedHover : c.visited)
        : (isHovered ? c.unvisitedHover : c.unvisited);
      const d = projectionPath.pathGen(f) || '';
      return { d, adcode, name, isVisited, isHovered, fill, props };
    });
  }, [geoFeatures, projectionPath, visitedAdcodeSet, hoveredAdcode, c]);

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
      const el = wrapperRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    },
    [],
  );

  // ─── Render ───

  const showMap = !loading && !error && geoFeatures && projectionPath && provincePaths && dimensions.width > 50;

  return (
    <div
      ref={wrapperRef}
      className={`relative select-none ${className}`}
      style={{ background: c.ocean, overflow: 'hidden' }}
    >
      {/* ─── Loading overlay ─── */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin"
              style={{ borderColor: isDark ? '#333' : '#ddd', borderTopColor: isDark ? '#888' : '#555' }}
            />
            <span className="text-xs font-mono uppercase tracking-widest" style={{ color: c.title }}>Loading...</span>
          </div>
        </div>
      )}

      {/* ─── Error overlay ─── */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm" style={{ color: c.title }}>Failed to load map</span>
            <span className="text-xs" style={{ color: c.title }}>{error}</span>
          </div>
        </div>
      )}

      {/* ─── Map SVG ─── */}
      {showMap && (
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          style={{ display: 'block', cursor: 'default' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredAdcode(null)}
        >
          {provincePaths.map((p, idx) => (
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
      )}

      {/* ─── Title ─── */}
      <div
        className="absolute top-4 left-4 pointer-events-none z-20"
        style={{ fontFamily: 'ui-monospace, monospace' }}
      >
        <div
          className="text-[10px] font-semibold uppercase"
          style={{ color: c.title, letterSpacing: '0.25em', opacity: 0.6 }}
        >
          China Map
        </div>
      </div>

      {/* ─── Badge ─── */}
      {showMap && (
        <div
          className="absolute top-4 right-4 pointer-events-none z-20 px-3 py-1.5 rounded-full text-xs font-mono font-medium"
          style={{ background: c.badge, color: c.badgeText, backdropFilter: 'blur(8px)' }}
        >
          {provinceCount}/{geoFeatures!.length} 省份
        </div>
      )}

      {/* ─── Tooltip ─── */}
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
                {p.isVisited && (
                  <span
                    className="ml-1.5 inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: '#fbbf24', verticalAlign: 'middle' }}
                  />
                )}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

