'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';

// ─── Types ───

interface VisitedPlace {
  name: string;
  province: string;
  adcode: string;
  level: string; // "province" or "city"
}

interface ChinaMapProps {
  visitedPlaces: VisitedPlace[];
  onTogglePlace: (name: string, province: string, adcode: string, level: string, lat: number, lng: number) => void;
  isDark?: boolean;
  className?: string;
}

interface GeoFeature {
  type: 'Feature';
  properties: {
    name: string;
    adcode: string;
    center?: [number, number];
    childrenNum?: number;
    level?: string;
    parent?: { adcode: string };
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][] ;
  };
}

interface GeoJSON {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

// ─── Province abbreviation mapping ───

const PROVINCE_ABBR: Record<string, string> = {
  '北京市': '京',
  '天津市': '津',
  '河北省': '冀',
  '山西省': '晋',
  '内蒙古自治区': '蒙',
  '辽宁省': '辽',
  '吉林省': '吉',
  '黑龙江省': '黑',
  '上海市': '沪',
  '江苏省': '苏',
  '浙江省': '浙',
  '安徽省': '皖',
  '福建省': '闽',
  '江西省': '赣',
  '山东省': '鲁',
  '河南省': '豫',
  '湖北省': '鄂',
  '湖南省': '湘',
  '广东省': '粤',
  '广西壮族自治区': '桂',
  '海南省': '琼',
  '重庆市': '渝',
  '四川省': '川',
  '贵州省': '黔',
  '云南省': '滇',
  '西藏自治区': '藏',
  '陕西省': '陕',
  '甘肃省': '甘',
  '青海省': '青',
  '宁夏回族自治区': '宁',
  '新疆维吾尔自治区': '新',
  '台湾省': '台',
  '香港特别行政区': '港',
  '澳门特别行政区': '澳',
};

// ─── Constants ───

const MIN_ZOOM = 0.8;
const MAX_ZOOM = 10;
const ZOOM_SPEED = 0.15;
const PAN_SPEED = 1;

// South China Sea box dimensions (relative to SVG viewport)
const SCSEA_BOX = { x: 0.76, y: 0.62, w: 0.21, h: 0.32 };
// Hainan + South China Sea island adcodes (for rendering in inset)
const SCSEA_PROVINCES = ['460000', '710000', '810000', '820000'];

// ─── Fetch helper ───

async function fetchGeoJSON(url: string): Promise<GeoJSON> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch GeoJSON: ${res.status}`);
  return res.json();
}

// ─── Main Component ───

export default function ChinaMap({
  visitedPlaces = [],
  onTogglePlace,
  isDark = false,
  className = '',
}: ChinaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Map state
  const [geoData, setGeoData] = useState<GeoJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<GeoFeature | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Zoom/Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  // Keep refs in sync
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // Visited province set for quick lookup
  const visitedSet = useMemo(() => {
    const set = new Set<string>();
    for (const p of visitedPlaces) {
      set.add(p.name);
      set.add(p.adcode);
    }
    return set;
  }, [visitedPlaces]);

  const visitedCount = useMemo(() => {
    return new Set(visitedPlaces.filter((p) => p.level === 'province').map((p) => p.adcode)).size;
  }, [visitedPlaces]);

  // SVG dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Fetch China GeoJSON
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchGeoJSON('/api/china-geojson');
        if (!cancelled) {
          setGeoData(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load map data');
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // D3 projection — centered on China
  const projection = useMemo(() => {
    if (!geoData) return null;
    const proj = geoMercator()
      .center([104, 35])
      .scale(1)
      .translate([0, 0]);

    // Compute bounding box of features and fit projection
    const pathGenerator = geoPath(proj);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const feature of geoData.features) {
      try {
        const bounds = pathGenerator.bounds(feature);
        if (bounds) {
          minX = Math.min(minX, bounds[0][0]);
          minY = Math.min(minY, bounds[0][1]);
          maxX = Math.max(maxX, bounds[1][0]);
          maxY = Math.max(maxY, bounds[1][1]);
        }
      } catch {
        // skip broken features
      }
    }

    if (isFinite(minX) && isFinite(maxX) && isFinite(minY) && isFinite(maxY)) {
      const dx = maxX - minX;
      const dy = maxY - minY;
      const padding = 30;
      const w = dimensions.width - padding * 2;
      const h = dimensions.height - padding * 2;
      const scale = Math.min(w / dx, h / dy);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      proj.scale(scale).translate([dimensions.width / 2 - cx * scale, dimensions.height / 2 - cy * scale]);
    }

    return proj;
  }, [geoData, dimensions]);

  const pathGenerator = useMemo(() => {
    if (!projection) return null;
    return geoPath(projection);
  }, [projection]);

  // Centroid map for labels
  const centroidMap = useMemo(() => {
    if (!projection || !geoData) return new Map<string, [number, number]>();
    const map = new Map<string, [number, number]>();
    const pathGen = geoPath(projection);
    for (const feature of geoData.features) {
      try {
        const centroid = pathGen.centroid(feature);
        if (isFinite(centroid[0]) && isFinite(centroid[1])) {
          map.set(feature.properties.adcode, centroid);
        }
      } catch {
        // skip
      }
    }
    return map;
  }, [geoData, projection]);

  // Split features for mainland vs South China Sea inset
  const { mainlandFeatures, scseaFeatures } = useMemo(() => {
    if (!geoData) return { mainlandFeatures: [], scseaFeatures: [] };
    const mainland: GeoFeature[] = [];
    const inset: GeoFeature[] = [];
    for (const f of geoData.features) {
      if (SCSEA_PROVINCES.includes(f.properties.adcode)) {
        inset.push(f);
      } else {
        mainland.push(f);
      }
    }
    return { mainlandFeatures: mainland, scseaFeatures: inset };
  }, [geoData]);

  // ─── Zoom handlers ───
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001 * zoomRef.current;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current * (1 + delta)));
    // Zoom toward mouse position
    const svg = svgRef.current;
    if (!svg) { setZoom(newZoom); return; }
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left - dimensions.width / 2;
    const my = e.clientY - rect.top - dimensions.height / 2;
    const factor = newZoom / zoomRef.current;
    const newPanX = mx - factor * (mx - panRef.current.x);
    const newPanY = my - factor * (my - panRef.current.y);
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [dimensions]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Update tooltip position
    if (hoveredFeature && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    if (!isPanning) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, [hoveredFeature, isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left - dimensions.width / 2;
    const my = e.clientY - rect.top - dimensions.height / 2;
    const newZoom = Math.min(MAX_ZOOM, zoomRef.current * 1.5);
    const factor = newZoom / zoomRef.current;
    setZoom(newZoom);
    setPan({ x: mx - factor * (mx - panRef.current.x), y: my - factor * (my - panRef.current.y) });
  }, [dimensions]);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // ─── Province click handler ───
  const handleFeatureClick = useCallback((feature: GeoFeature) => {
    const { name, adcode } = feature.properties;
    let lat = 0;
    let lng = 0;
    try {
      const centroid = geoCentroid(feature);
      lat = centroid[1];
      lng = centroid[0];
    } catch {
      // fallback
    }
    onTogglePlace(name, name, adcode, 'province', lat, lng);
  }, [onTogglePlace]);

  // ─── Colors ───
  const colors = useMemo(() => ({
    bg: isDark ? '#0a0a0a' : '#fafafa',
    unvisited: isDark ? '#262626' : '#e5e7eb',
    border: isDark ? '#404040' : '#d1d5db',
    visited: 'rgba(251, 191, 36, 0.65)',
    visitedStroke: 'rgba(251, 191, 36, 0.9)',
    hoverUnvisited: isDark ? '#333333' : '#d4d4d8',
    hoverVisited: 'rgba(251, 191, 36, 0.8)',
    text: isDark ? '#e5e5e5' : '#1a1a1a',
    subtitle: isDark ? '#555555' : '#a0a0a0',
    abbr: isDark ? '#999' : '#666',
  }), [isDark]);

  // ─── Render ───
  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none ${className}`}
      style={{ background: colors.bg, cursor: isPanning ? 'grabbing' : 'grab' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setIsPanning(false); setHoveredFeature(null); setTooltipPos(null); }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-neutral-300 dark:border-neutral-600 border-t-amber-500 rounded-full animate-spin" />
            <span className="text-xs text-neutral-400">加载地图数据...</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3 text-center px-6">
            <span className="text-sm text-red-400">{error}</span>
            <button
              onClick={() => window.location.reload()}
              className="text-xs px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {/* SVG Map */}
      {!loading && !error && geoData && projection && pathGenerator && (
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          className="w-full h-full"
        >
          <defs>
            {/* Glow filter for visited provinces */}
            <filter id="china-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Transform group for zoom/pan */}
          <g
            transform={`translate(${dimensions.width / 2 + pan.x}, ${dimensions.height / 2 + pan.y}) scale(${zoom}) translate(${-dimensions.width / 2}, ${-dimensions.height / 2})`}
          >
            {/* Mainland province paths */}
            {mainlandFeatures.map((feature) => {
              const adcode = feature.properties.adcode;
              const name = feature.properties.name;
              const isVisited = visitedSet.has(name) || visitedSet.has(adcode);
              const isHovered = hoveredFeature?.properties.adcode === adcode;

              let d: string | null;
              try {
                d = pathGenerator(feature);
              } catch {
                return null;
              }
              if (!d) return null;

              return (
                <g key={adcode}>
                  {/* Glow behind visited */}
                  {isVisited && (
                    <path
                      d={d}
                      fill="rgba(251, 191, 36, 0.25)"
                      stroke="none"
                      filter="url(#china-glow)"
                    />
                  )}
                  {/* Province path */}
                  <path
                    d={d}
                    fill={isHovered
                      ? (isVisited ? colors.hoverVisited : colors.hoverUnvisited)
                      : (isVisited ? colors.visited : colors.unvisited)
                    }
                    stroke={isVisited ? colors.visitedStroke : colors.border}
                    strokeWidth={isHovered ? 1.2 : 0.6}
                    strokeLinejoin="round"
                    style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
                    onClick={() => handleFeatureClick(feature)}
                    onMouseEnter={(e) => {
                      setHoveredFeature(feature);
                      const svg = svgRef.current;
                      if (svg) {
                        const rect = svg.getBoundingClientRect();
                        setTooltipPos({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                        });
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredFeature(null);
                      setTooltipPos(null);
                    }}
                  />
                  {/* Province abbreviation label */}
                  {centroidMap.has(adcode) && (
                    <text
                      x={centroidMap.get(adcode)![0]}
                      y={centroidMap.get(adcode)![1]}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={zoom > 3 ? 12 : zoom > 1.5 ? 10 : 9}
                      fontWeight={600}
                      fontFamily="system-ui, sans-serif"
                      fill={isVisited ? '#92400e' : colors.abbr}
                      opacity={zoom > 1.2 ? 1 : 0.7}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {PROVINCE_ABBR[name] || name.replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔)/g, '').slice(0, 1)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* South China Sea inset box */}
          {scseaFeatures.length > 0 && (
            <g>
              {/* Box background */}
              <rect
                x={dimensions.width * SCSEA_BOX.x}
                y={dimensions.height * SCSEA_BOX.y}
                width={dimensions.width * SCSEA_BOX.w}
                height={dimensions.height * SCSEA_BOX.h}
                fill={isDark ? '#111' : '#f5f5f5'}
                stroke={isDark ? '#333' : '#ccc'}
                strokeWidth={0.8}
                rx={4}
              />
              {/* Box title */}
              <text
                x={dimensions.width * SCSEA_BOX.x + 6}
                y={dimensions.height * SCSEA_BOX.y + 14}
                fontSize={9}
                fontFamily="system-ui, sans-serif"
                fontWeight={600}
                fill={colors.subtitle}
                opacity={0.7}
              >
                南海诸岛
              </text>

              {/* Render Hainan and islands with inset projection */}
              <SouthChinaSeaInset
                features={scseaFeatures}
                projection={projection}
                pathGenerator={pathGenerator}
                dimensions={dimensions}
                visitedSet={visitedSet}
                colors={colors}
                hoveredFeature={hoveredFeature}
                setHoveredFeature={setHoveredFeature}
                onFeatureClick={handleFeatureClick}
                centroidMap={centroidMap}
                zoom={zoom}
                abbrMap={PROVINCE_ABBR}
              />
            </g>
          )}
        </svg>
      )}

      {/* "CHINA MAP" title */}
      <div
        className="absolute top-3 left-3 pointer-events-none select-none z-5"
        style={{
          fontFamily: 'var(--font-geist-mono), monospace',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: colors.subtitle,
          opacity: 0.7,
        }}
      >
        China Map
      </div>

      {/* Province count badge */}
      <div
        className="absolute top-3 left-[110px] pointer-events-none select-none z-5"
        style={{
          fontFamily: 'var(--font-geist-mono), monospace',
          fontSize: '11px',
          fontWeight: 500,
          color: colors.subtitle,
          opacity: 0.7,
        }}
      >
        {visitedCount}/34 省份
      </div>

      {/* Reset view button */}
      {zoom !== 1 && (
        <button
          onClick={handleResetView}
          className="absolute bottom-4 right-4 z-10 px-3 py-1.5 rounded-lg text-xs font-medium
            bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-sm
            border border-neutral-200 dark:border-neutral-700
            text-neutral-600 dark:text-neutral-300
            hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          重置视图
        </button>
      )}

      {/* Zoom indicator */}
      <div
        className="absolute bottom-4 left-4 z-10 px-2 py-1 rounded-md text-[10px] font-mono
          bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm
          text-neutral-400 dark:text-neutral-500 pointer-events-none"
      >
        {zoom.toFixed(1)}x
      </div>

      {/* Tooltip */}
      {hoveredFeature && tooltipPos && (
        <div
          className="absolute z-20 pointer-events-none px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-lg
            bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm
            border border-neutral-200 dark:border-neutral-700
            text-neutral-800 dark:text-neutral-200"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 8,
          }}
        >
          {hoveredFeature.properties.name}
          {(visitedSet.has(hoveredFeature.properties.name) || visitedSet.has(hoveredFeature.properties.adcode)) && (
            <span className="ml-1.5 text-amber-500">✓</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── South China Sea Inset ───

function SouthChinaSeaInset({
  features,
  projection,
  pathGenerator,
  dimensions,
  visitedSet,
  colors,
  hoveredFeature,
  setHoveredFeature,
  onFeatureClick,
  centroidMap,
  zoom,
  abbrMap,
}: {
  features: GeoFeature[];
  projection: ReturnType<typeof geoMercator>;
  pathGenerator: ReturnType<typeof geoPath>;
  dimensions: { width: number; height: number };
  visitedSet: Set<string>;
  colors: Record<string, string>;
  hoveredFeature: GeoFeature | null;
  setHoveredFeature: (f: GeoFeature | null) => void;
  onFeatureClick: (f: GeoFeature) => void;
  centroidMap: Map<string, [number, number]>;
  zoom: number;
  abbrMap: Record<string, string>;
}) {
  // For the inset, we render Hainan + islands as simplified paths.
  // We use the same projection but clip and scale to fit the inset box.
  const insetProjection = useMemo(() => {
    const proj = geoMercator()
      .center([112, 12])
      .scale(1)
      .translate([0, 0]);

    const pathGen = geoPath(proj);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const feature of features) {
      try {
        const bounds = pathGen.bounds(feature);
        if (bounds) {
          minX = Math.min(minX, bounds[0][0]);
          minY = Math.min(minY, bounds[0][1]);
          maxX = Math.max(maxX, bounds[1][0]);
          maxY = Math.max(maxY, bounds[1][1]);
        }
      } catch {
        // skip
      }
    }

    if (isFinite(minX) && isFinite(maxX) && isFinite(minY) && isFinite(maxY)) {
      const dx = maxX - minX;
      const dy = maxY - minY;
      const insetW = dimensions.width * SCSEA_BOX.w - 12;
      const insetH = dimensions.height * SCSEA_BOX.h - 24;
      const insetX = dimensions.width * SCSEA_BOX.x + 6;
      const insetY = dimensions.height * SCSEA_BOX.y + 18;
      const scale = Math.min(insetW / Math.max(dx, 1), insetH / Math.max(dy, 1));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      proj.scale(scale).translate([insetX + insetW / 2 - cx * scale, insetY + insetH / 2 - cy * scale]);
    }

    return proj;
  }, [features, dimensions]);

  const insetPathGen = useMemo(() => {
    if (!insetProjection) return null;
    return geoPath(insetProjection);
  }, [insetProjection]);

  const insetCentroids = useMemo(() => {
    if (!insetProjection) return new Map<string, [number, number]>();
    const map = new Map<string, [number, number]>();
    const pg = geoPath(insetProjection);
    for (const f of features) {
      try {
        const c = pg.centroid(f);
        if (isFinite(c[0]) && isFinite(c[1])) {
          map.set(f.properties.adcode, c);
        }
      } catch {
        // skip
      }
    }
    return map;
  }, [features, insetProjection]);

  if (!insetPathGen) return null;

  return (
    <g clipPath="url(#scsea-clip)">
      <clipPath id="scsea-clip">
        <rect
          x={dimensions.width * SCSEA_BOX.x + 1}
          y={dimensions.height * SCSEA_BOX.y + 1}
          width={dimensions.width * SCSEA_BOX.w - 2}
          height={dimensions.height * SCSEA_BOX.h - 2}
          rx={3}
        />
      </clipPath>
      {features.map((feature) => {
        const adcode = feature.properties.adcode;
        const name = feature.properties.name;
        const isVisited = visitedSet.has(name) || visitedSet.has(adcode);
        const isHovered = hoveredFeature?.properties.adcode === adcode;

        let d: string | null;
        try {
          d = insetPathGen(feature);
        } catch {
          return null;
        }
        if (!d) return null;

        return (
          <g key={`inset-${adcode}`}>
            <path
              d={d}
              fill={isHovered
                ? (isVisited ? 'rgba(251, 191, 36, 0.8)' : (colors.hoverUnvisited))
                : (isVisited ? colors.visited : colors.unvisited)
              }
              stroke={isVisited ? colors.visitedStroke : colors.border}
              strokeWidth={isHovered ? 1 : 0.5}
              strokeLinejoin="round"
              style={{ cursor: 'pointer' }}
              onClick={() => onFeatureClick(feature)}
              onMouseEnter={() => setHoveredFeature(feature)}
              onMouseLeave={() => setHoveredFeature(null)}
            />
            {insetCentroids.has(adcode) && (
              <text
                x={insetCentroids.get(adcode)![0]}
                y={insetCentroids.get(adcode)![1]}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={7}
                fontWeight={600}
                fontFamily="system-ui, sans-serif"
                fill={isVisited ? '#92400e' : colors.abbr}
                opacity={0.8}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {abbrMap[name] || ''}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
