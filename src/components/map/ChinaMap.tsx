'use client';

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';

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

// ─── Province abbreviation mapping ───

const PROVINCE_ABBR: Record<string, string> = {
  '北京市': '京', '天津市': '津', '河北省': '冀', '山西省': '晋',
  '内蒙古自治区': '蒙', '辽宁省': '辽', '吉林省': '吉', '黑龙江省': '黑',
  '上海市': '沪', '江苏省': '苏', '浙江省': '浙', '安徽省': '皖',
  '福建省': '闽', '江西省': '赣', '山东省': '鲁', '河南省': '豫',
  '湖北省': '鄂', '湖南省': '湘', '广东省': '粤', '广西壮族自治区': '桂',
  '海南省': '琼', '重庆市': '渝', '四川省': '川', '贵州省': '黔',
  '云南省': '滇', '西藏自治区': '藏', '陕西省': '陕', '甘肃省': '甘',
  '青海省': '青', '宁夏回族自治区': '宁', '新疆维吾尔自治区': '新',
  '台湾省': '台', '香港特别行政区': '港', '澳门特别行政区': '澳',
};

// ─── Constants ───

const PADDING = 20;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

// ─── Colors ───

const COLORS = {
  light: {
    ocean: '#f8f9fa',
    unvisited: '#dde1e6',
    unvisitedHover: '#c8cdd3',
    border: '#c0c4ca',
    visited: '#f59e0b',
    visitedHover: '#fbbf24',
    visitedGlow: 'rgba(245, 158, 11, 0.35)',
    title: '#9ca3af',
    badge: 'rgba(24, 24, 27, 0.8)',
    badgeText: '#f4f4f5',
    tooltip: 'rgba(24, 24, 27, 0.88)',
    tooltipText: '#f4f4f5',
    abbr: '#52525b',
    abbrVisited: '#92400e',
  },
  dark: {
    ocean: '#09090b',
    unvisited: '#27272a',
    unvisitedHover: '#3f3f46',
    border: '#3f3f46',
    visited: '#f59e0b',
    visitedHover: '#fbbf24',
    visitedGlow: 'rgba(245, 158, 11, 0.25)',
    title: '#52525b',
    badge: 'rgba(250, 250, 252, 0.85)',
    badgeText: '#18181b',
    tooltip: 'rgba(250, 250, 252, 0.92)',
    tooltipText: '#18181b',
    abbr: '#a1a1aa',
    abbrVisited: '#fbbf24',
  },
};

// ─── Main Component ───

export default function ChinaMap({
  visitedPlaces = [],
  onTogglePlace,
  isDark = false,
  className = '',
}: ChinaMapProps) {
  // ─── Refs ───
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null); // Always-mounted wrapper

  // ─── Data state ───
  const [geoFeatures, setGeoFeatures] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Layout state ───
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // ─── Interaction state ───
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOrigin, setPanOrigin] = useState({ x: 0, y: 0 });
  const [hoveredAdcode, setHoveredAdcode] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // ─── Colors ───
  const c = isDark ? COLORS.dark : COLORS.light;

  // ─── Visited set for fast lookup ───
  const visitedSet = useMemo(() => {
    const set = new Set<string>();
    visitedPlaces.forEach((p) => {
      set.add(p.name);
      set.add(String(p.adcode));
    });
    return set;
  }, [visitedPlaces]);

  const visitedCount = useMemo(
    () => new Set(visitedPlaces.filter((p) => p.level === 'province').map((p) => p.adcode)).size,
    [visitedPlaces]
  );

  // ─── Fetch GeoJSON ───
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch('/api/china-geojson');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        const features = data.features || [];
        console.log('[ChinaMap] Loaded', features.length, 'features');
        setGeoFeatures(features);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load map data';
          setError(msg);
          console.error('[ChinaMap] Fetch error:', msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  // ─── Resize observer (always on the same wrapperRef) ───
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ w: rect.width, h: rect.height });
        console.log('[ChinaMap] Size:', rect.width, 'x', rect.height);
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ─── Projection & path generator ───
  const projectionAndPath = useMemo(() => {
    if (!geoFeatures || geoFeatures.length === 0 || !size) return null;

    const featureCollection = { type: 'FeatureCollection' as const, features: geoFeatures };

    try {
      const w = size.w;
      const h = size.h;

      const projection = geoMercator()
        .fitExtent(
          [[PADDING, PADDING], [w - PADDING, h - PADDING]],
          featureCollection as unknown as GeoJSON.FeatureCollection
        )
        // CRITICAL: expand clip extent to match our viewBox so paths aren't clipped
        .clipExtent([[0, 0], [w, h]]);

      const pathGen = geoPath(projection);

      return { projection, pathGen };
    } catch (err) {
      console.error('[ChinaMap] Projection error:', err);
      return null;
    }
  }, [geoFeatures, size]);

  // ─── Pre-compute rendered paths ───
  const renderedPaths = useMemo(() => {
    if (!geoFeatures || !projectionAndPath) return [];
    const { pathGen } = projectionAndPath;

    const result: Array<{
      feature: any;
      d: string;
      adcode: string;
      name: string;
      isVisited: boolean;
      centroid: [number, number];
    }> = [];

    for (const f of geoFeatures) {
      try {
        const d = pathGen(f);
        if (!d) continue;

        const adcode = String(f.properties?.adcode ?? '');
        const name = String(f.properties?.name ?? '');
        const isVisited = visitedSet.has(name) || visitedSet.has(adcode);

        let centroid: [number, number] = [0, 0];
        try {
          const c = geoCentroid(f);
          centroid = projectionAndPath.projection(c) as [number, number];
        } catch { /* skip */ }

        result.push({ feature: f, d, adcode, name, isVisited, centroid });
      } catch { /* skip invalid features */ }
    }

    console.log('[ChinaMap] Rendered', result.length, 'paths');
    return result;
  }, [geoFeatures, projectionAndPath, visitedSet]);

  // ─── Zoom handler (native addEventListener for passive:false) ───
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
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

  // ─── Pan handlers ───
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
      const wrapper = wrapperRef.current;
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
      if (!isPanning) return;
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan({ x: panOrigin.x + dx, y: panOrigin.y + dy });
    },
    [isPanning, panStart, panOrigin]
  );

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

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
      setPan({ x: mouseX - (mouseX - pan.x) * scale, y: mouseY - (mouseY - pan.y) * scale });
    },
    [zoom, pan]
  );

  // ─── Province click ───
  const handleProvinceClick = useCallback(
    (e: ReactMouseEvent, clickedFeature: any) => {
      e.stopPropagation();
      const name = clickedFeature.properties?.name || '';
      const adcode = String(clickedFeature.properties?.adcode ?? '');
      if (!name || !adcode) return;
      let lat = 0, lng = 0;
      try {
        const [lng_, lat_] = geoCentroid(clickedFeature);
        lat = lat_;
        lng = lng_;
      } catch { /* fallback */ }
      onTogglePlace(name, name, adcode, 'province', lat, lng);
    },
    [onTogglePlace]
  );

  // ─── Determine view state ───
  const isReady = !loading && !error && geoFeatures && projectionAndPath && size;

  // ─── Render ───
  return (
    <div
      ref={wrapperRef}
      className={`relative select-none overflow-hidden ${className}`}
      style={{ background: c.ocean }}
    >
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
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

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm" style={{ color: c.title }}>Failed to load map</span>
            <span className="text-xs" style={{ color: c.title }}>{error}</span>
          </div>
        </div>
      )}

      {/* SVG Map — always rendered once size is known */}
      {size && (
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          style={{
            display: 'block',
            width: size.w,
            height: size.h,
            cursor: isPanning ? 'grabbing' : 'grab',
            opacity: isReady ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setIsPanning(false); setHoveredAdcode(null); }}
        >
          {/* Map group with zoom/pan transform */}
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            style={{ transformOrigin: '0 0' }}
          >
            {renderedPaths.map((item) => {
              const { feature, d, adcode, name, isVisited, centroid: ct } = item;
              const isHovered = hoveredAdcode === adcode;

              return (
                <g key={adcode || name}>
                  {/* Glow behind visited */}
                  {isVisited && (
                    <path
                      d={d}
                      fill={c.visitedGlow}
                      stroke="none"
                      style={{ filter: `drop-shadow(0 0 ${4 / zoom}px ${c.visitedGlow})` }}
                    />
                  )}
                  {/* Province path */}
                  <path
                    d={d}
                    fill={isVisited
                      ? (isHovered ? c.visitedHover : c.visited)
                      : (isHovered ? c.unvisitedHover : c.unvisited)
                    }
                    stroke={isVisited ? c.visitedHover : c.border}
                    strokeWidth={0.5 / zoom}
                    strokeLinejoin="round"
                    style={{
                      transition: 'fill 0.15s ease',
                      cursor: 'pointer',
                      filter: isVisited ? `drop-shadow(0 0 ${2 / zoom}px ${c.visitedGlow})` : undefined,
                    }}
                    onClick={(e) => handleProvinceClick(e, feature)}
                    onMouseEnter={() => setHoveredAdcode(adcode)}
                    onMouseLeave={() => setHoveredAdcode(null)}
                  />
                  {/* Province abbreviation label — only show at higher zoom */}
                  {isFinite(ct[0]) && isFinite(ct[1]) && zoom > 1.2 && (
                    <text
                      x={ct[0]}
                      y={ct[1]}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={(zoom > 3 ? 12 : zoom > 2 ? 10 : 8) / zoom}
                      fontWeight={600}
                      fontFamily="system-ui, sans-serif"
                      fill={isVisited ? c.abbrVisited : c.abbr}
                      opacity={0.85}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {PROVINCE_ABBR[name] || name.replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔)/g, '').slice(0, 1)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}

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
        {visitedCount}/34 省份
      </div>

      {/* Tooltip */}
      {hoveredAdcode && (() => {
        const item = renderedPaths.find((p) => p.adcode === hoveredAdcode);
        if (!item) return null;
        return (
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
            {item.name}
            {item.isVisited && (
              <span
                className="ml-1.5 inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: '#f59e0b', verticalAlign: 'middle' }}
              />
            )}
          </div>
        );
      })()}
    </div>
  );
}
