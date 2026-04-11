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

const PADDING = 30;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

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
    abbr: '#666',
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
    abbr: '#999',
  },
};

// ─── Main Component ───

export default function ChinaMap({
  visitedPlaces = [],
  onTogglePlace,
  isDark = false,
  className = '',
}: ChinaMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Data state
  const [geoFeatures, setGeoFeatures] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction state
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOrigin, setPanOrigin] = useState({ x: 0, y: 0 });
  const [hoveredAdcode, setHoveredAdcode] = useState<string | null>(null);
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

  const visitedCount = useMemo(
    () => new Set(visitedPlaces.filter((p) => p.level === 'province').map((p) => p.adcode)).size,
    [visitedPlaces]
  );

  // Fetch GeoJSON
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

  // Resize observer
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

  // Projection & path generator — use fitSize like WorldMap
  const projectionPath = useMemo(() => {
    if (!geoFeatures || geoFeatures.length === 0) return null;

    try {
      const featureCollection = { type: 'FeatureCollection' as const, features: geoFeatures };
      const projection = geoMercator()
        .fitExtent(
          [[PADDING, PADDING], [dimensions.width - PADDING, dimensions.height - PADDING]],
          featureCollection as unknown as GeoJSON.FeatureCollection
        );
      const pathGen = geoPath(projection) as (obj: any) => string | null;
      return { projection, pathGen };
    } catch {
      // Fallback
      const projection = geoMercator()
        .center([104, 35])
        .scale(Math.min(dimensions.width, dimensions.height) / 3)
        .translate([dimensions.width / 2, dimensions.height / 2]);
      const pathGen = geoPath(projection) as (obj: any) => string | null;
      return { projection, pathGen };
    }
  }, [geoFeatures, dimensions]);

  // ─── Zoom handler (native addEventListener to support preventDefault) ───

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
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
      if (!isPanning) return;
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan({ x: panOrigin.x + dx, y: panOrigin.y + dy });
    },
    [isPanning, panStart, panOrigin]
  );

  const handleMouseUp = useCallback(() => { setIsPanning(false); }, []);

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
      let lat = 0;
      let lng = 0;
      try {
        const centroid = geoCentroid(clickedFeature);
        lat = centroid[1];
        lng = centroid[0];
      } catch { /* fallback */ }
      onTogglePlace(name, name, adcode, 'province', lat, lng);
    },
    [onTogglePlace]
  );

  // ─── Pre-compute rendered paths ───

  const renderedPaths = useMemo(() => {
    if (!geoFeatures || !projectionPath) return null;

    return geoFeatures.map((f) => {
      const adcode = String(f.properties?.adcode ?? '');
      const name = String(f.properties?.name ?? '');
      const isVisited = visitedSet.has(name) || visitedSet.has(adcode);
      const isHovered = hoveredAdcode === adcode;

      let d: string;
      try {
        d = projectionPath.pathGen(f) || '';
        if (!d) return null;
      } catch {
        return null;
      }

      return { feature: f, d, adcode, name, isVisited, isHovered };
    }).filter(Boolean);
  }, [geoFeatures, projectionPath, visitedSet, hoveredAdcode]);

  // ─── Centroid map for labels ───

  const centroidMap = useMemo(() => {
    if (!projectionPath) return new Map<string, [number, number]>();
    const map = new Map<string, [number, number]>();
    if (!geoFeatures) return map;
    for (const f of geoFeatures) {
      try {
        const c = projectionPath.pathGen.centroid(f);
        if (isFinite(c[0]) && isFinite(c[1])) {
          map.set(String(f.properties?.adcode), c);
        }
      } catch { /* skip */ }
    }
    return map;
  }, [geoFeatures, projectionPath]);

  // ─── Loading state ───

  if (loading) {
    return (
      <div ref={containerRef} className={`flex items-center justify-center ${className}`} style={{ background: c.ocean }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: isDark ? '#333' : '#ddd', borderTopColor: isDark ? '#888' : '#555' }} />
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: c.title }}>Loading Map...</span>
        </div>
      </div>
    );
  }

  // ─── Error state ───

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

  // ─── Map render ───

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${className}`}
      style={{ background: c.ocean, overflow: 'hidden' }}
    >
      {/* SVG Map */}
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
        onMouseLeave={() => { setIsPanning(false); setHoveredAdcode(null); }}
      >
        {/* Countries group with zoom/pan transform */}
        <g
          transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
          style={{ transformOrigin: '0 0' }}
        >
          {renderedPaths?.map((item) => {
            if (!item) return null;
            const { feature, d, adcode, name, isVisited, isHovered } = item;
            return (
              <g key={adcode}>
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
                  fill={isHovered
                    ? (isVisited ? c.visitedHover : c.unvisitedHover)
                    : (isVisited ? c.visited : c.unvisited)
                  }
                  stroke={isVisited ? c.visitedHover : c.border}
                  strokeWidth={0.5 / zoom}
                  style={{
                    transition: isVisited ? 'fill 0.2s ease, filter 0.2s ease' : 'fill 0.15s ease',
                    cursor: 'pointer',
                    filter: isVisited ? `drop-shadow(0 0 ${2 / zoom}px ${c.visitedGlow})` : undefined,
                  }}
                  onClick={(e) => handleProvinceClick(e, feature)}
                  onMouseEnter={() => setHoveredAdcode(adcode)}
                  onMouseLeave={() => setHoveredAdcode(null)}
                />
                {/* Province abbreviation label */}
                {centroidMap.has(adcode) && zoom > 1.2 && (
                  <text
                    x={centroidMap.get(adcode)![0]}
                    y={centroidMap.get(adcode)![1]}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={(zoom > 3 ? 12 : zoom > 2 ? 10 : 8) / zoom}
                    fontWeight={600}
                    fontFamily="system-ui, sans-serif"
                    fill={isVisited ? '#92400e' : c.abbr}
                    opacity={0.8}
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

      {/* CHINA MAP title */}
      <div className="absolute top-4 left-4 pointer-events-none" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
        <div className="text-[10px] font-semibold uppercase" style={{ color: c.title, letterSpacing: '0.25em', opacity: 0.6 }}>
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
        const item = renderedPaths?.find((p) => p?.adcode === hoveredAdcode);
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
              <span className="ml-1.5 inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#fbbf24', verticalAlign: 'middle' }} />
            )}
          </div>
        );
      })()}
    </div>
  );
}
