'use client';

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { feature } from 'topojson-client';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import type { Topology } from 'topojson-specification';

// ─── Types ───

interface WorldMapProps {
  visitedCountries: { code: string; name: string }[];
  onToggleCountry: (code: string, name: string, nameZh: string) => void;
  isDark?: boolean;
  className?: string;
}

interface CountryFeature extends Record<string, any> {
  type: string;
  id: string;
  properties: {
    name: string;
  };
  geometry: GeoJSON.Geometry;
}

// ─── ISO 3166-1 numeric → alpha-2 mapping (~195 countries) ───

const NUMERIC_TO_ALPHA2: Record<string, string> = {
  '004': 'AF', '008': 'AL', '012': 'DZ', '016': 'AS', '020': 'AD',
  '024': 'AO', '028': 'AG', '032': 'AR', '036': 'AU', '040': 'AT',
  '031': 'AZ', '044': 'BS', '048': 'BH', '050': 'BD', '051': 'AM',
  '052': 'BB', '056': 'BE', '064': 'BT', '068': 'BO', '070': 'BA',
  '072': 'BW', '076': 'BR', '084': 'BZ', '090': 'SB', '096': 'BN',
  '100': 'BG', '104': 'MM', '108': 'BI', '112': 'BY', '116': 'KH',
  '120': 'CM', '124': 'CA', '132': 'CV', '140': 'CF', '144': 'LK',
  '148': 'TD', '152': 'CL', '156': 'CN', '158': 'TW', '162': 'CX',
  '166': 'CC', '170': 'CO', '174': 'KM', '175': 'YT', '178': 'CG',
  '180': 'CD', '184': 'CK', '188': 'CR', '191': 'HR', '192': 'CU',
  '196': 'CY', '203': 'CZ', '204': 'BJ', '208': 'DK', '212': 'DM',
  '214': 'DO', '218': 'EC', '222': 'SV', '226': 'GQ', '231': 'ET',
  '232': 'ER', '233': 'EE', '234': 'FO', '238': 'FK', '242': 'FJ',
  '246': 'FI', '250': 'FR', '258': 'PF', '260': 'TF', '262': 'DJ',
  '266': 'GA', '268': 'GE', '270': 'GM', '275': 'PS', '276': 'DE',
  '288': 'GH', '296': 'KI', '300': 'GR', '304': 'GL', '308': 'GD',
  '312': 'GP', '316': 'GU', '320': 'GT', '324': 'GN', '328': 'GY',
  '332': 'HT', '336': 'VA', '340': 'HN', '344': 'HK', '348': 'HU',
  '352': 'IS', '356': 'IN', '360': 'ID', '364': 'IR', '368': 'IQ',
  '372': 'IE', '376': 'IL', '380': 'IT', '384': 'CI', '388': 'JM',
  '392': 'JP', '398': 'KZ', '400': 'JO', '404': 'KE', '408': 'KP',
  '410': 'KR', '414': 'KW', '417': 'KG', '418': 'LA', '422': 'LB',
  '426': 'LS', '428': 'LV', '430': 'LR', '434': 'LY', '438': 'LI',
  '440': 'LT', '442': 'LU', '446': 'MO', '450': 'MG', '454': 'MW',
  '458': 'MY', '462': 'MV', '466': 'ML', '470': 'MT', '478': 'MR',
  '480': 'MU', '484': 'MX', '492': 'MC', '496': 'MN', '498': 'MD',
  '499': 'ME', '504': 'MA', '508': 'MZ', '512': 'OM', '516': 'NA',
  '520': 'NR', '524': 'NP', '528': 'NL', '540': 'NC', '548': 'VU',
  '554': 'NZ', '558': 'NI', '562': 'NE', '566': 'NG', '570': 'NU',
  '578': 'NO', '583': 'FM', '585': 'PW', '586': 'PK', '591': 'PA',
  '598': 'PG', '600': 'PY', '604': 'PE', '608': 'PH', '616': 'PL',
  '620': 'PT', '624': 'GW', '626': 'TL', '630': 'PR', '634': 'QA',
  '642': 'RO', '643': 'RU', '646': 'RW', '659': 'KN', '662': 'LC',
  '670': 'VC', '674': 'SM', '678': 'ST', '682': 'SA', '686': 'SN',
  '688': 'RS', '690': 'SC', '694': 'SL', '702': 'SG', '703': 'SK',
  '704': 'VN', '705': 'SI', '706': 'SO', '710': 'ZA', '716': 'ZW',
  '724': 'ES', '728': 'SS', '729': 'SD', '732': 'EH', '740': 'SR',
  '748': 'SZ', '752': 'SE', '756': 'CH', '760': 'SY', '762': 'TJ',
  '764': 'TH', '768': 'TG', '776': 'TO', '780': 'TT', '784': 'AE',
  '788': 'TN', '792': 'TR', '795': 'TM', '798': 'TV', '800': 'UG',
  '804': 'UA', '807': 'MK', '818': 'EG', '826': 'GB', '834': 'TZ',
  '840': 'US', '854': 'BF', '858': 'UY', '860': 'UZ', '862': 'VE',
  '876': 'WF', '882': 'WS', '887': 'YE', '894': 'ZM',
  '010': 'AQ',  // Antarctica
};

// ─── Chinese country name mapping (major countries) ───

const CHINESE_NAMES: Record<string, string> = {
  'AF': '阿富汗', 'AL': '阿尔巴尼亚', 'DZ': '阿尔及利亚', 'AS': '美属萨摩亚',
  'AD': '安道尔', 'AO': '安哥拉', 'AG': '安提瓜和巴布达', 'AR': '阿根廷',
  'AM': '亚美尼亚', 'AU': '澳大利亚', 'AT': '奥地利', 'AZ': '阿塞拜疆',
  'BS': '巴哈马', 'BH': '巴林', 'BD': '孟加拉国', 'BB': '巴巴多斯',
  'BY': '白俄罗斯', 'BE': '比利时', 'BZ': '伯利兹', 'BJ': '贝宁',
  'BT': '不丹', 'BO': '玻利维亚', 'BA': '波斯尼亚和黑塞哥维那', 'BW': '博茨瓦纳',
  'BR': '巴西', 'BN': '文莱', 'BG': '保加利亚', 'BF': '布基纳法索',
  'BI': '布隆迪', 'KH': '柬埔寨', 'CM': '喀麦隆', 'CA': '加拿大',
  'CV': '佛得角', 'CF': '中非共和国', 'TD': '乍得', 'CL': '智利',
  'CN': '中国', 'CO': '哥伦比亚', 'KM': '科摩罗', 'CG': '刚果（布）',
  'CD': '刚果（金）', 'CR': '哥斯达黎加', 'CI': '科特迪瓦', 'HR': '克罗地亚',
  'CU': '古巴', 'CY': '塞浦路斯', 'CZ': '捷克', 'DK': '丹麦',
  'DJ': '吉布提', 'DM': '多米尼克', 'DO': '多米尼加', 'EC': '厄瓜多尔',
  'EG': '埃及', 'SV': '萨尔瓦多', 'GQ': '赤道几内亚', 'ER': '厄立特里亚',
  'EE': '爱沙尼亚', 'ET': '埃塞俄比亚', 'FJ': '斐济', 'FI': '芬兰',
  'FR': '法国', 'GA': '加蓬', 'GM': '冈比亚', 'GE': '格鲁吉亚',
  'DE': '德国', 'GH': '加纳', 'GR': '希腊', 'GD': '格林纳达',
  'GT': '危地马拉', 'GN': '几内亚', 'GW': '几内亚比绍', 'GY': '圭亚那',
  'HT': '海地', 'HN': '洪都拉斯', 'HU': '匈牙利', 'IS': '冰岛',
  'IN': '印度', 'ID': '印度尼西亚', 'IR': '伊朗', 'IQ': '伊拉克',
  'IE': '爱尔兰', 'IL': '以色列', 'IT': '意大利', 'JM': '牙买加',
  'JP': '日本', 'JO': '约旦', 'KZ': '哈萨克斯坦', 'KE': '肯尼亚',
  'KI': '基里巴斯', 'KP': '朝鲜', 'KR': '韩国', 'KW': '科威特',
  'KG': '吉尔吉斯斯坦', 'LA': '老挝', 'LV': '拉脱维亚', 'LB': '黎巴嫩',
  'LS': '莱索托', 'LR': '利比里亚', 'LY': '利比亚', 'LI': '列支敦士登',
  'LT': '立陶宛', 'LU': '卢森堡', 'MO': '中国澳门', 'MG': '马达加斯加',
  'MW': '马拉维', 'MY': '马来西亚', 'MV': '马尔代夫', 'ML': '马里',
  'MT': '马耳他', 'MH': '马绍尔群岛', 'MR': '毛里塔尼亚', 'MU': '毛里求斯',
  'MX': '墨西哥', 'FM': '密克罗尼西亚', 'MD': '摩尔多瓦', 'MC': '摩纳哥',
  'MN': '蒙古', 'ME': '黑山', 'MA': '摩洛哥', 'MZ': '莫桑比克',
  'MM': '缅甸', 'NA': '纳米比亚', 'NR': '瑙鲁', 'NP': '尼泊尔',
  'NL': '荷兰', 'NZ': '新西兰', 'NI': '尼加拉瓜', 'NE': '尼日尔',
  'NG': '尼日利亚', 'MK': '北马其顿', 'NO': '挪威', 'OM': '阿曼',
  'PK': '巴基斯坦', 'PW': '帕劳', 'PA': '巴拿马', 'PG': '巴布亚新几内亚',
  'PY': '巴拉圭', 'PE': '秘鲁', 'PH': '菲律宾', 'PL': '波兰',
  'PT': '葡萄牙', 'PR': '波多黎各', 'QA': '卡塔尔', 'RO': '罗马尼亚',
  'RU': '俄罗斯', 'RW': '卢旺达', 'KN': '圣基茨和尼维斯', 'LC': '圣卢西亚',
  'VC': '圣文森特和格林纳丁斯', 'WS': '萨摩亚', 'SM': '圣马力诺',
  'ST': '圣多美和普林西比', 'SA': '沙特阿拉伯', 'SN': '塞内加尔',
  'RS': '塞尔维亚', 'SC': '塞舌尔', 'SL': '塞拉利昂', 'SG': '新加坡',
  'SK': '斯洛伐克', 'SI': '斯洛文尼亚', 'SB': '所罗门群岛', 'SO': '索马里',
  'ZA': '南非', 'SS': '南苏丹', 'ES': '西班牙', 'LK': '斯里兰卡',
  'SD': '苏丹', 'SR': '苏里南', 'SZ': '斯威士兰', 'SE': '瑞典',
  'CH': '瑞士', 'SY': '叙利亚', 'TW': '中国台湾', 'TJ': '塔吉克斯坦',
  'TZ': '坦桑尼亚', 'TH': '泰国', 'TL': '东帝汶', 'TG': '多哥',
  'TO': '汤加', 'TT': '特立尼达和多巴哥', 'TN': '突尼斯', 'TR': '土耳其',
  'TM': '土库曼斯坦', 'TV': '图瓦卢', 'UG': '乌干达', 'UA': '乌克兰',
  'AE': '阿联酋', 'GB': '英国', 'US': '美国', 'UY': '乌拉圭',
  'UZ': '乌兹别克斯坦', 'VU': '瓦努阿图', 'VE': '委内瑞拉', 'VN': '越南',
  'YE': '也门', 'ZM': '赞比亚', 'ZW': '津巴布韦', 'AQ': '南极洲',
  'FO': '法罗群岛', 'GL': '格陵兰', 'GP': '瓜德罗普', 'GU': '关岛',
  'HK': '中国香港', 'NC': '新喀里多尼亚', 'PF': '法属波利尼西亚',
  'RE': '留尼汪', 'WF': '瓦利斯和富图纳',
};

// ─── TOPOJSON URL ───

const TOPOJSON_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

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

export default function WorldMap({
  visitedCountries,
  onToggleCountry,
  isDark = false,
  className = '',
}: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Data state
  const [geoFeatures, setGeoFeatures] = useState<CountryFeature[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction state
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOrigin, setPanOrigin] = useState({ x: 0, y: 0 });
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Colors
  const c = isDark ? COLORS.dark : COLORS.light;

  // Visited country set for fast lookup
  const visitedSet = useMemo(() => {
    const set = new Set<string>();
    visitedCountries.forEach((c) => set.add(c.code));
    return set;
  }, [visitedCountries]);

  // Fetch TopoJSON and convert to GeoJSON features
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(TOPOJSON_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const topology = (await response.json()) as Topology;
        const geoJson = feature(topology, topology.objects.countries as any) as any;

        if (cancelled) return;

        const features = (geoJson.features || []) as CountryFeature[];
        setGeoFeatures(features);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load map data');
          console.error('Failed to load world map:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
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

  // Projection & path generator (memoized on dimensions + data)
  const projectionPath = useMemo(() => {
    if (!geoFeatures || geoFeatures.length === 0) return null;

    const featureCollection = {
      type: 'FeatureCollection' as const,
      features: geoFeatures.map((f) => ({
        type: f.type,
        id: f.id,
        properties: f.properties,
        geometry: f.geometry,
      })),
    };

    const projection = geoNaturalEarth1()
      .fitSize([dimensions.width, dimensions.height], featureCollection as unknown as GeoJSON.FeatureCollection)
      .clipExtent([[0, 0], [dimensions.width, dimensions.height]]);

    const pathGen = geoPath(projection) as (obj: any) => string | null;

    return { projection, pathGen };
  }, [geoFeatures, dimensions]);

  // ─── Zoom handlers ───

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 8;

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

      // Zoom towards cursor
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

  const handleDoubleClick = useCallback(
    (e: ReactMouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newZoom = Math.min(MAX_ZOOM, zoom * 1.5);
      const scale = newZoom / zoom;
      const newPanX = mouseX - (mouseX - pan.x) * scale;
      const newPanY = mouseY - (mouseY - pan.y) * scale;

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    },
    [zoom, pan]
  );

  // ─── Pan handlers ───

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      // Only pan on left click, not on a country
      if ((e.target as Element).tagName === 'path') return;
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setPanOrigin({ x: pan.x, y: pan.y });
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      // Update tooltip position
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }

      if (!isPanning) return;
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan({ x: panOrigin.x + dx, y: panOrigin.y + dy });
    },
    [isPanning, panStart, panOrigin]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // ─── Country click ───

  const handleCountryClick = useCallback(
    (e: ReactMouseEvent, clickedFeature: CountryFeature) => {
      // Prevent pan from starting
      e.stopPropagation();

      const numericId = clickedFeature.id;
      const alpha2 = NUMERIC_TO_ALPHA2[numericId] || numericId;
      const countryName = clickedFeature.properties?.name || 'Unknown';
      const chineseName = CHINESE_NAMES[alpha2] || '';

      onToggleCountry(alpha2, countryName, chineseName);
    },
    [onToggleCountry]
  );

  // ─── Render country paths ───

  const countryPaths = useMemo(() => {
    if (!geoFeatures || !projectionPath) return null;

    return geoFeatures.map((f) => {
      const numericId = f.id;
      const alpha2 = NUMERIC_TO_ALPHA2[numericId] || numericId;
      const isVisited = visitedSet.has(alpha2);
      const isHovered = hoveredCountry === numericId;

      let fill: string;
      if (isVisited) {
        fill = isHovered ? c.visitedHover : c.visited;
      } else {
        fill = isHovered ? c.unvisitedHover : c.unvisited;
      }

      return {
        d: projectionPath.pathGen(f) || '',
        numericId,
        alpha2,
        isVisited,
        isHovered,
        fill,
        name: f.properties?.name || 'Unknown',
      };
    });
  }, [geoFeatures, projectionPath, visitedSet, hoveredCountry, c]);

  // ─── Loading state ───

  if (loading) {
    return (
      <div
        ref={containerRef}
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

  if (error || !geoFeatures || !projectionPath) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center ${className}`}
        style={{ background: c.ocean }}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm" style={{ color: c.title }}>
            Failed to load map
          </span>
          <span className="text-xs" style={{ color: c.title }}>
            {error || 'No data'}
          </span>
        </div>
      </div>
    );
  }

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
        onMouseLeave={() => {
          setIsPanning(false);
          setHoveredCountry(null);
        }}
      >
        {/* Countries group with zoom/pan transform */}
        <g
          transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
          style={{ transformOrigin: '0 0' }}
        >
          {countryPaths?.map((country, idx) => (
            <path
              key={country.numericId || `country-${idx}`}
              d={country.d}
              fill={country.fill}
              stroke={c.border}
              strokeWidth={0.5 / zoom}
              style={{
                transition: country.isVisited
                  ? 'fill 0.2s ease, filter 0.2s ease'
                  : 'fill 0.15s ease',
                cursor: 'pointer',
                filter: country.isVisited
                  ? `drop-shadow(0 0 ${3 / zoom}px ${c.visitedGlow})`
                  : undefined,
              }}
              onClick={(e) => {
                const f = geoFeatures.find(
                  (gf) => gf.id === country.numericId
                );
                if (f) handleCountryClick(e, f);
              }}
              onMouseEnter={() => setHoveredCountry(country.numericId)}
              onMouseLeave={() => setHoveredCountry(null)}
            />
          ))}
        </g>
      </svg>

      {/* WORLD MAP title */}
      <div
        className="absolute top-4 left-4 pointer-events-none"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
      >
        <div
          className="text-[10px] font-semibold uppercase"
          style={{
            color: c.title,
            letterSpacing: '0.25em',
            opacity: 0.6,
          }}
        >
          World Map
        </div>
      </div>

      {/* Country count badge */}
      <div
        className="absolute top-4 right-4 pointer-events-none px-3 py-1.5 rounded-full text-xs font-mono font-medium"
        style={{
          background: c.badge,
          color: c.badgeText,
          backdropFilter: 'blur(8px)',
        }}
      >
        {visitedCountries.length}/195 已探索
      </div>

      {/* Tooltip */}
      {hoveredCountry && (
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
            const f = geoFeatures.find((gf) => gf.id === hoveredCountry);
            if (!f) return '';
            const numericId = f.id;
            const alpha2 = NUMERIC_TO_ALPHA2[numericId] || numericId;
            const chineseName = CHINESE_NAMES[alpha2];
            const englishName = f.properties?.name || 'Unknown';
            const visited = visitedSet.has(alpha2);

            return (
              <span>
                {chineseName ? `${chineseName}` : englishName}
                {chineseName && (
                  <span style={{ opacity: 0.65 }}> / {englishName}</span>
                )}
                {visited && (
                  <span className="ml-1.5 inline-block w-2 h-2 rounded-full"
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
