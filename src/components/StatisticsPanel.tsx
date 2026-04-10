'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Route,
  MapPin,
  Calendar,
  TrendingUp,
  Globe2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trajectory } from '@/lib/store';
import { totalRouteDistance, formatDistance, tripDurationDays, formatDuration } from '@/lib/geo';

// ─── Types ───

interface StatisticsPanelProps {
  trajectories: Trajectory[];
  open: boolean;
  onClose: () => void;
}

// ─── Component ───

export default function StatisticsPanel({
  trajectories,
  open,
  onClose,
}: StatisticsPanelProps) {
  const stats = useMemo(() => {
    const totalTrajectories = trajectories.length;
    const totalLocations = trajectories.reduce(
      (sum, t) => sum + t.locations.length,
      0
    );

    // Total distance across all trajectories
    let globalDistance = 0;
    const trajectoryDistances: { name: string; color: string; distance: number }[] = [];

    for (const t of trajectories) {
      const sorted = [...t.locations].sort((a, b) => a.order - b.order);
      const dist = totalRouteDistance(sorted);
      globalDistance += dist;
      trajectoryDistances.push({ name: t.name, color: t.color, distance: dist });
    }

    // Total duration
    let globalDays = 0;
    for (const t of trajectories) {
      globalDays += tripDurationDays(t.startDate, t.endDate);
    }

    // Longest trajectory
    const longest = trajectoryDistances.length > 0
      ? trajectoryDistances.reduce((a, b) => (a.distance > b.distance ? a : b))
      : null;

    // Average distance per trajectory
    const avgDistance = totalTrajectories > 0 ? globalDistance / totalTrajectories : 0;

    // Most locations in a single trajectory
    const mostLocations = trajectories.length > 0
      ? trajectories.reduce((a, b) =>
          a.locations.length > b.locations.length ? a : b
        )
      : null;

    // Sort trajectories by distance for ranking
    const ranked = [...trajectoryDistances]
      .sort((a, b) => b.distance - a.distance)
      .slice(0, 5);

    // Year distribution
    const yearMap: Record<string, number> = {};
    for (const t of trajectories) {
      const year = new Date(t.startDate).getFullYear().toString();
      yearMap[year] = (yearMap[year] || 0) + 1;
    }
    const yearData = Object.entries(yearMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, count]) => ({ year, count }));

    return {
      totalTrajectories,
      totalLocations,
      globalDistance,
      globalDays,
      longest,
      avgDistance,
      mostLocations,
      ranked,
      yearData,
    };
  }, [trajectories]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 320 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 320 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-[340px] sm:w-[380px] bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-neutral-500" />
                <h2 className="text-base font-semibold text-neutral-900">旅行统计</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Separator />

            <ScrollArea className="flex-1">
              <div className="p-5 space-y-5">
                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    icon={<Route className="h-4 w-4" />}
                    label="总里程"
                    value={formatDistance(stats.globalDistance)}
                    accent="text-emerald-600"
                  />
                  <StatCard
                    icon={<Calendar className="h-4 w-4" />}
                    label="总天数"
                    value={formatDuration(stats.globalDays)}
                    accent="text-amber-600"
                  />
                  <StatCard
                    icon={<MapPin className="h-4 w-4" />}
                    label="地点总数"
                    value={stats.totalLocations.toString()}
                    accent="text-rose-600"
                  />
                  <StatCard
                    icon={<Globe2 className="h-4 w-4" />}
                    label="轨迹总数"
                    value={stats.totalTrajectories.toString()}
                    accent="text-violet-600"
                  />
                </div>

                {/* Quick stats */}
                <Card className="border-neutral-100">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-500">平均轨迹距离</span>
                      <span className="text-sm font-medium text-neutral-800">
                        {formatDistance(stats.avgDistance)}
                      </span>
                    </div>
                    <Separator />
                    {stats.longest && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-neutral-500">最长轨迹</span>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: stats.longest.color }}
                            />
                            <span className="text-sm font-medium text-neutral-800 max-w-[140px] truncate">
                              {stats.longest.name}
                            </span>
                          </div>
                        </div>
                        <Separator />
                      </>
                    )}
                    {stats.mostLocations && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-neutral-500">最多地点轨迹</span>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: stats.mostLocations.color }}
                            />
                            <span className="text-sm font-medium text-neutral-800 max-w-[140px] truncate">
                              {stats.mostLocations.name}
                            </span>
                            <span className="text-xs text-neutral-400">
                              ({stats.mostLocations.locations.length})
                            </span>
                          </div>
                        </div>
                        <Separator />
                      </>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-500">日均行程</span>
                      <span className="text-sm font-medium text-neutral-800">
                        {stats.globalDays > 0
                          ? formatDistance(stats.globalDistance / stats.globalDays)
                          : '—'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Distance ranking */}
                {stats.ranked.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        距离排名
                      </span>
                    </div>
                    <div className="space-y-2">
                      {stats.ranked.map((item, idx) => {
                        const maxDist = stats.ranked[0]?.distance || 1;
                        const pct = (item.distance / maxDist) * 100;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-mono text-neutral-400 w-4 shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="text-sm text-neutral-700 truncate">
                                  {item.name}
                                </span>
                              </div>
                              <span className="text-xs font-mono text-neutral-500 shrink-0 ml-2">
                                {formatDistance(item.distance)}
                              </span>
                            </div>
                            <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, delay: idx * 0.1 }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Year distribution */}
                {stats.yearData.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        年度分布
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {stats.yearData.map((item) => (
                        <div
                          key={item.year}
                          className="px-3 py-1.5 bg-neutral-50 rounded-lg text-center"
                        >
                          <div className="text-base font-bold text-neutral-800">
                            {item.count}
                          </div>
                          <div className="text-[10px] text-neutral-400 font-mono">
                            {item.year}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Stat Card ───

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card className="border-neutral-100 hover:shadow-sm transition-shadow">
      <CardContent className="p-3">
        <div className={`mb-1.5 ${accent}`}>{icon}</div>
        <div className="text-lg font-bold text-neutral-900 leading-none">{value}</div>
        <div className="text-[10px] text-neutral-400 uppercase tracking-wider mt-1">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}
