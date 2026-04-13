'use client';

import { useRef, useState, useEffect, useMemo, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { geoMercator, geoPath, geoBounds } from 'd3-geo';
import { ChevronLeft, Plus, Minus } from 'lucide-react';

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

// ─── GeoJSON Winding Order Fix ───

function signedRingArea(coords: number[][]): number {
  let area = 0;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    area += (coords[j][0] + coords[i][0]) * (coords[j][1] - coords[i][1]);
  }
  return area / 2;
}

function rewindRing(coords: number[][], ccw: boolean): number[][] {
  const area = signedRingArea(coords);
  if ((ccw && area < 0) || (!ccw && area > 0)) {
    return [...coords].reverse();
  }
  return coords;
}

function rewindFeature(feature: GeoFeature): GeoFeature {
  const geom = feature.geometry;
  let newGeom: GeoJSON.Geometry;

  if (geom.type === 'Polygon') {
    newGeom = {
      type: 'Polygon',
      coordinates: geom.coordinates.map((ring, i) =>
        rewindRing(ring.map(c => [...c] as number[]), i === 0)
      ),
    };
  } else if (geom.type === 'MultiPolygon') {
    newGeom = {
      type: 'MultiPolygon',
      coordinates: geom.coordinates.map(polygon =>
        polygon.map((ring, i) =>
          rewindRing(ring.map(c => [...c] as number[]), i === 0)
        )
      ),
    };
  } else {
    newGeom = geom;
  }

  return { ...feature, geometry: newGeom };
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
    btn: 'rgba(23, 23, 23, 0.7)',
    btnHover: 'rgba(23, 23, 23, 0.85)',
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
    btn: 'rgba(250, 250, 250, 0.7)',
    btnHover: 'rgba(250, 250, 250, 0.85)',
  },
};

// ─── Zoom limits ───

const MIN_ZOOM = 1;
const MAX_ZOOM = 12;

// ─── Component ───

export default function ChinaMap({
  visitedPlaces = [],
  onTogglePlace,
  isDark = false,
  className = '',
}: ChinaMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const provinceFeaturesRef = useRef<GeoFeature[] | null>(null);

  // ─── Data state ───
  const [geoFeatures, setGeoFeatures] = useState<GeoFeature[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewLevel, setViewLevel] = useState<'province' | 'city'>('province');
  const [selectedProvince, setSelectedProvince] = useState<{
    name: string;
    adcode: string;
    level: string;
  } | null>(null);

  // ─── Interaction state ───
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOrigin, setPanOrigin] = useState({ x: 0, y: 0 });
  const [hoveredAdcode, setHoveredAdcode] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const c = isDark ? COLORS.dark : COLORS.light;

  // ─── Visited sets ───

  const visitedAdcodeSet = useMemo(() => {
    const set = new Set<string>();
    visitedPlaces.forEach((p) => set.add(String(p.adcode)));
    return set;
  }, [visitedPlaces]);

  // Province-level visited: visited directly OR has visited cities
  const visitedProvinceSet = useMemo(() => {
    const set = new Set<string>();
    visitedPlaces.forEach((p) => {
      if (p.level === 'province') {
        set.add(String(p.adcode));
      }
      // Also mark by province name (for city-level visits)
      if (p.province) {
        set.add(p.province);
      }
    });
    return set;
  }, [visitedPlaces]);

  const visitedCount = useMemo(() => {
    if (viewLevel === 'province') {
      return new Set(
        visitedPlaces
          .filter((p) => p.level === 'province')
          .map((p) => p.adcode)
      ).size;
    }
    return visitedPlaces.filter(
      (p) => p.level === 'city' && p.province === selectedProvince?.name
    ).length;
  }, [visitedPlaces, viewLevel, selectedProvince]);

  const totalCount = useMemo(() => {
    return geoFeatures?.length || 0;
  }, [geoFeatures]);

  // ─── Fetch GeoJSON ───

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        let url: string;
        if (viewLevel === 'province') {
          url = '/api/china-geojson';
        } else if (selectedProvince) {
          url = `/api/china-geojson/${selectedProvince.adcode}`;
        } else {
          return;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        // Filter empty names & fix winding order
        const features: GeoFeature[] = (data.features || [])
          .filter((f: any) => String(f?.properties?.name || '').trim().length > 0)
          .map((f: any) =>
            rewindFeature({
              type: f.type,
              id: f.id || String(f.properties?.adcode || ''),
              properties: f.properties,
              geometry: f.geometry,
            })
          );

        // Cache province features for back navigation
        if (viewLevel === 'province') {
          provinceFeaturesRef.current = features;
        }

        setGeoFeatures(features);
        console.log(
          `[ChinaMap] ${viewLevel} view:`,
          features.length,
          viewLevel === 'province' ? 'provinces' : 'cities'
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Fetch failed');
          console.error('[ChinaMap] fetch error:', e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [viewLevel, selectedProvince]);

  // ─── ResizeObserver ───

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w > 50 && h > 50) {
        setDimensions({ width: w, height: h });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ─── Projection ───

  const projectionPath = useMemo(() => {
    if (!geoFeatures || geoFeatures.length === 0) return null;
    const w = dimensions.width;
    const h = dimensions.height;
    if (w < 50 || h < 50) return null;

    const fc = {
      type: 'FeatureCollection' as const,
      features: geoFeatures.map((f) => ({
        type: f.type,
        id: f.id,
        properties: f.properties,
        geometry: f.geometry,
      })),
    };

    const [[lon0, lat0], [lon1, lat1]] = geoBounds(fc);
    const isBoundsSane = lon1 - lon0 < 180 && lat1 - lat0 < 90;

    let projection;
    if (isBoundsSane) {
      try {
        projection = geoMercator()
          .fitSize([w, h], fc as unknown as GeoJSON.FeatureCollection)
          .clipExtent([[0, 0], [w, h]]);
      } catch {
        projection = null;
      }
    }

    if (projection) {
      const s = projection.scale();
      if (s > 50000 || s < 10) projection = null;
    }

    if (!projection) {
      projection = geoMercator()
        .center([104.5, 37.5])
        .scale(Math.min(w, h) * 0.9)
        .translate([w / 2, h / 2])
        .clipExtent([[0, 0], [w, h]]);
    }

    const pathGen = geoPath(projection) as (obj: any) => string | null;
    return { projection, pathGen };
  }, [geoFeatures, dimensions]);

  // ─── Pre-compute paths ───

  const mapPaths = useMemo(() => {
    if (!geoFeatures || !projectionPath) return null;

    return geoFeatures.map((f) => {
      const props = f.properties;
      const adcode = String(props.adcode || '');
      const name = String(props.name || '').trim();

      // Determine visited status
      let isVisited: boolean;
      if (viewLevel === 'province') {
        // Province visited if: direct province mark OR any city in it is visited
        isVisited =
          visitedAdcodeSet.has(adcode) || visitedProvinceSet.has(name);
      } else {
        isVisited = visitedAdcodeSet.has(adcode);
      }

      const isHovered = hoveredAdcode === adcode;
      const fill = isVisited
        ? isHovered ? c.visitedHover : c.visited
        : isHovered ? c.unvisitedHover : c.unvisited;
      const d = projectionPath.pathGen(f) || '';

      return { d, adcode, name, isVisited, isHovered, fill, props };
    });
  }, [geoFeatures, projectionPath, visitedAdcodeSet, visitedProvinceSet, hoveredAdcode, c, viewLevel]);

  // ─── Wheel zoom ───

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * zoomFactor));

      const scale = newZoom / zoom;
      const newPanX = mouseX - (mouseX - pan.x) * scale;
      const newPanY = mouseY - (mouseY - pan.y) * scale;

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    },
    [zoom, pan]
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ─── Double-click zoom ───

  const handleDoubleClick = useCallback(
    (e: ReactMouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newZoom = Math.min(MAX_ZOOM, zoom * 1.5);
      const scale = newZoom / zoom;
      setZoom(newZoom);
      setPan({
        x: mouseX - (mouseX - pan.x) * scale,
        y: mouseY - (mouseY - pan.y) * scale,
      });
    },
    [zoom, pan]
  );

  // ─── Pan ───

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if ((e.target as Element).tagName === 'path') return;
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setPanOrigin({ x: pan.x, y: pan.y });
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      const el = wrapperRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }

      if (!isPanning) return;
      setPan({
        x: panOrigin.x + (e.clientX - panStart.x),
        y: panOrigin.y + (e.clientY - panStart.y),
      });
    },
    [isPanning, panStart, panOrigin]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // ─── Click handler ───

  const handleMapClick = useCallback(
    (e: ReactMouseEvent, feature: GeoFeature) => {
      e.stopPropagation();
      const name = String(feature.properties.name || '').trim();
      const adcode = String(feature.properties.adcode || '');
      const center = feature.properties.center || feature.properties.centroid;
      const lat = Array.isArray(center) && typeof center[1] === 'number' ? center[1] : 0;
      const lng = Array.isArray(center) && typeof center[0] === 'number' ? center[0] : 0;
      if (!name) return;

      if (viewLevel === 'province') {
        // Drill into city view
        setSelectedProvince({ name, adcode, level: 'province' });
        setViewLevel('city');
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } else {
        // Toggle city visited
        onTogglePlace(name, selectedProvince?.name || name, adcode, 'city', lat, lng);
      }
    },
    [viewLevel, selectedProvince, onTogglePlace]
  );

  // ─── Back to provinces ───

  const handleBack = useCallback(() => {
    setViewLevel('province');
    setSelectedProvince(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // ─── Zoom buttons ───

  const zoomIn = useCallback(() => {
    const newZoom = Math.min(MAX_ZOOM, zoom * 1.4);
    const scale = newZoom / zoom;
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    setZoom(newZoom);
    setPan({ x: cx - (cx - pan.x) * scale, y: cy - (cy - pan.y) * scale });
  }, [zoom, pan, dimensions]);

  const zoomOut = useCallback(() => {
    const newZoom = Math.max(MIN_ZOOM, zoom / 1.4);
    const scale = newZoom / zoom;
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    setZoom(newZoom);
    setPan({ x: cx - (cx - pan.x) * scale, y: cy - (cy - pan.y) * scale });
  }, [zoom, pan, dimensions]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // ─── Render ───

  const showMap =
    !loading && !error && geoFeatures && projectionPath && mapPaths && dimensions.width > 50;

  return (
    <div
      ref={wrapperRef}
      className={`relative select-none ${className}`}
      style={{ background: c.ocean, overflow: 'hidden' }}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
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
              Loading...
            </span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm" style={{ color: c.title }}>
              加载失败
            </span>
            <span className="text-xs" style={{ color: c.title }}>
              {error}
            </span>
          </div>
        </div>
      )}

      {/* Map SVG */}
      {showMap && (
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          className="w-full h-full"
          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setIsPanning(false);
            setHoveredAdcode(null);
          }}
        >
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            style={{ transformOrigin: '0 0' }}
          >
            {mapPaths.map((p, idx) => (
              <path
                key={p.adcode || `region-${idx}`}
                d={p.d}
                fill={p.fill}
                stroke={c.border}
                strokeWidth={0.5 / zoom}
                strokeLinejoin="round"
                style={{
                  transition: 'fill 0.15s ease',
                  cursor: 'pointer',
                  filter: p.isVisited
                    ? `drop-shadow(0 0 ${3 / zoom}px ${c.visitedGlow})`
                    : undefined,
                }}
                onClick={(e) => {
                  const f = geoFeatures!.find(
                    (gf) => String(gf.properties.adcode) === p.adcode
                  );
                  if (f) handleMapClick(e, f);
                }}
                onMouseEnter={() => setHoveredAdcode(p.adcode)}
                onMouseLeave={() => setHoveredAdcode(null)}
              />
            ))}
          </g>
        </svg>
      )}

      {/* ─── Top-left: Title + Back button ─── */}
      <div
        className="absolute top-4 left-4 pointer-events-none z-20 flex flex-col gap-2"
        style={{ fontFamily: 'ui-monospace, monospace' }}
      >
        <div
          className="text-[10px] font-semibold uppercase"
          style={{ color: c.title, letterSpacing: '0.25em', opacity: 0.6 }}
        >
          {viewLevel === 'province' ? 'China Map' : selectedProvince?.name || 'City Map'}
        </div>

        {/* Back button (city view) */}
        {viewLevel === 'city' && (
          <button
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: c.btn,
              color: c.badgeText,
              backdropFilter: 'blur(8px)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}
            onClick={handleBack}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = c.btnHover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = c.btn)
            }
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            返回省份
          </button>
        )}
      </div>

      {/* ─── Top-right: Badge ─── */}
      {showMap && (
        <div
          className="absolute top-4 right-4 pointer-events-none z-20 px-3 py-1.5 rounded-full text-xs font-mono font-medium"
          style={{
            background: c.badge,
            color: c.badgeText,
            backdropFilter: 'blur(8px)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        >
          {visitedCount}/{totalCount}{' '}
          {viewLevel === 'province' ? '省份' : '城市'}
        </div>
      )}

      {/* ─── Bottom-right: Zoom controls ─── */}
      <div className="absolute bottom-20 right-4 z-20 flex flex-col gap-1">
        <button
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
          style={{
            background: c.btn,
            color: c.badgeText,
            backdropFilter: 'blur(8px)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
          onClick={zoomIn}
          onMouseEnter={(e) => (e.currentTarget.style.background = c.btnHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = c.btn)}
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors text-[10px] font-mono"
          style={{
            background: c.btn,
            color: c.badgeText,
            backdropFilter: 'blur(8px)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
          onClick={resetZoom}
          onMouseEnter={(e) => (e.currentTarget.style.background = c.btnHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = c.btn)}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
          style={{
            background: c.btn,
            color: c.badgeText,
            backdropFilter: 'blur(8px)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
          onClick={zoomOut}
          onMouseEnter={(e) => (e.currentTarget.style.background = c.btnHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = c.btn)}
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

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
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        >
          {(() => {
            const p = mapPaths?.find((pp) => pp.adcode === hoveredAdcode);
            if (!p?.name) return '';
            return (
              <span>
                {p.name}
                {viewLevel === 'province' && (
                  <span style={{ opacity: 0.5, marginLeft: 4 }}>
                    点击查看城市
                  </span>
                )}
                {p.isVisited && (
                  <span
                    className="ml-1.5 inline-block w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: '#fbbf24',
                      verticalAlign: 'middle',
                    }}
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
