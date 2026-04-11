'use client';

import { useMemo } from 'react';
import {
  BarChart3,
  Globe2,
  Navigation,
  MapPin,
  Calendar,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

// ─── Types ───

interface VisitedCountry {
  id: string;
  code: string;
  name: string;
  nameZh: string;
  visitedAt: string;
}

interface VisitedPlace {
  id: string;
  name: string;
  province: string;
  adcode: string;
  lat: number;
  lng: number;
  level: string;
  visitedAt: string;
}

interface StatisticsPanelProps {
  countries: VisitedCountry[];
  places: VisitedPlace[];
  isDark?: boolean;
  className?: string;
}

// ─── Component ───

export default function StatisticsPanel({
  countries,
  places,
  isDark = false,
  className = '',
}: StatisticsPanelProps) {
  // Province count
  const provinceCount = useMemo(
    () => new Set(places.filter((p) => p.level === 'province').map((p) => p.adcode)).size,
    [places]
  );

  // City count (non-province)
  const cityCount = useMemo(
    () => places.filter((p) => p.level === 'city').length,
    [places]
  );

  // Most recent countries
  const recentCountries = useMemo(
    () => [...countries].sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime()).slice(0, 10),
    [countries]
  );

  // Most recent places
  const recentPlaces = useMemo(
    () => [...places].sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime()).slice(0, 10),
    [places]
  );

  return (
    <div className={`w-full h-full overflow-hidden bg-white dark:bg-neutral-950 ${className}`}>
      <ScrollArea className="h-full">
        <div className="max-w-2xl mx-auto p-5 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-neutral-500" />
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">旅行统计</h2>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Globe2 className="h-4 w-4" />}
              label="已探索国家"
              value={countries.length.toString()}
              sub="全球 195 国"
              accent="text-emerald-600"
            />
            <StatCard
              icon={<Navigation className="h-4 w-4" />}
              label="已到省份"
              value={provinceCount.toString()}
              sub="全国 34 省级行政区"
              accent="text-amber-600"
            />
            <StatCard
              icon={<MapPin className="h-4 w-4" />}
              label="已到城市"
              value={cityCount.toString()}
              accent="text-rose-600"
            />
            <StatCard
              icon={<Calendar className="h-4 w-4" />}
              label="记录总数"
              value={(countries.length + places.length).toString()}
              accent="text-violet-600"
            />
          </div>

          {/* Coverage progress */}
          <Card className="border-neutral-100 dark:border-neutral-800">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">全球覆盖率</span>
                <span className="text-sm font-mono text-neutral-500 dark:text-neutral-400">
                  {countries.length}/195 ({((countries.length / 195) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
                  style={{ width: `${Math.min((countries.length / 195) * 100, 100)}%` }}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">中国覆盖率</span>
                <span className="text-sm font-mono text-neutral-500 dark:text-neutral-400">
                  {provinceCount}/34 ({((provinceCount / 34) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-500 transition-all duration-500"
                  style={{ width: `${Math.min((provinceCount / 34) * 100, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Recent countries */}
          {recentCountries.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5 text-neutral-400" />
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  最近探索的国家
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentCountries.map((c) => (
                  <div
                    key={c.code}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200/50 dark:border-amber-800/30"
                  >
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">{c.nameZh || c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent places */}
          {recentPlaces.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  最近到访的城市
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentPlaces.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200/50 dark:border-amber-800/30"
                  >
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      {p.province ? `${p.province} · ` : ''}{p.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {countries.length === 0 && places.length === 0 && (
            <div className="text-center py-16">
              <Globe2 className="h-12 w-12 text-neutral-200 dark:text-neutral-700 mx-auto mb-4" />
              <p className="text-neutral-400 text-sm">还没有探索记录</p>
              <p className="text-neutral-300 dark:text-neutral-600 text-xs mt-1">切换到世界地图或中国地图，点击国家/省份开始记录</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Stat Card ───

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <Card className="border-neutral-100 dark:border-neutral-800 hover:shadow-sm transition-shadow">
      <CardContent className="p-3">
        <div className={`mb-1.5 ${accent}`}>{icon}</div>
        <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-none">{value}</div>
        <div className="text-[10px] text-neutral-400 uppercase tracking-wider mt-1">{label}</div>
        {sub && <div className="text-[9px] text-neutral-300 dark:text-neutral-600 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
