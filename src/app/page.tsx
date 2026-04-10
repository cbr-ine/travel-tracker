'use client';

import { useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  MapPin, Plus, Menu, X, Trash2, Edit2, Calendar,
  Search, BarChart3, Globe2, LayoutGrid, Route, Clock,
  Navigation, ChevronRight, Sun, Moon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Trajectory, useTrajectoryStore } from '@/lib/store';
import {
  totalRouteDistance, formatDistance, tripDurationDays, formatDuration,
} from '@/lib/geo';

// ─── Lazy load globe (Three.js SSR incompatible) ───
const PixelGlobe = dynamic(() => import('@/components/globe/PixelGlobe'), { ssr: false });

// ─── Lazy load flat map ───
const FlatMap = dynamic(() => import('@/components/map/FlatMap'), { ssr: false });

// ─── Statistics Panel ───
import StatisticsPanel from '@/components/StatisticsPanel';

// ─── Trajectory Form Dialog ───
import TrajectoryFormDialog from '@/components/trajectory/TrajectoryFormDialog';

// ─── Helpers ───

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Main Page ───

export default function Home() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  // Use resolvedTheme for isDark to handle hydration mismatch (theme can be undefined initially)
  const isDark = resolvedTheme === 'dark';
  const {
    trajectories,
    isLoading,
    sidebarOpen,
    setSidebarOpen,
    setTrajectories,
    setIsLoading,
    removeTrajectory,
    setEditingTrajectory,
    setDetailTrajectory,
    formDialogOpen,
    detailTrajectory,
    detailPanelOpen,
    setDetailPanelOpen,
    searchQuery,
    setSearchQuery,
    mapMode,
    setMapMode,
    focusTrajectoryId,
    setFocusTrajectoryId,
    statsPanelOpen,
    setStatsPanelOpen,
  } = useTrajectoryStore();

  // Fetch trajectories on mount
  const fetchTrajectories = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/trajectories');
      if (res.ok) {
        const data = await res.json();
        setTrajectories(data);
      }
    } catch (err) {
      console.error('Failed to fetch trajectories:', err);
    } finally {
      setIsLoading(false);
    }
  }, [setTrajectories, setIsLoading]);

  useEffect(() => {
    fetchTrajectories();
  }, [fetchTrajectories]);

  // Delete trajectory
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/trajectories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        removeTrajectory(id);
        setDetailPanelOpen(false);
        toast.success('轨迹已删除');
      }
    } catch {
      toast.error('删除失败，请重试');
    }
  };

  // Filtered trajectories based on search
  const filteredTrajectories = useMemo(() => {
    if (!searchQuery.trim()) return trajectories;
    const q = searchQuery.toLowerCase().trim();
    return trajectories.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.note?.toLowerCase().includes(q) ||
        t.locations.some((l) => l.name.toLowerCase().includes(q))
    );
  }, [trajectories, searchQuery]);

  // Globe/FlatMap trajectories (transformed)
  const mapTrajectories = useMemo(
    () =>
      trajectories.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        locations: t.locations.map((l) => ({
          id: l.id || '',
          name: l.name,
          lat: l.lat,
          lng: l.lng,
          order: l.order,
        })),
      })),
    [trajectories]
  );

  // Stats
  const totalLocations = useMemo(
    () => trajectories.reduce((sum, t) => sum + t.locations.length, 0),
    [trajectories]
  );
  const globalDistance = useMemo(
    () =>
      trajectories.reduce((sum, t) => {
        const sorted = [...t.locations].sort((a, b) => a.order - b.order);
        return sum + totalRouteDistance(sorted);
      }, 0),
    [trajectories]
  );

  // Handle trajectory click from sidebar → zoom to it
  const handleSidebarTrajectoryClick = useCallback(
    (t: Trajectory) => {
      setDetailTrajectory(t);
      setSidebarOpen(false);
      // Focus globe on this trajectory
      setFocusTrajectoryId(t.id);
      // Clear focus after a few seconds so globe returns to normal
      setTimeout(() => {
        setFocusTrajectoryId(null);
      }, 6000);
    },
    [setDetailTrajectory, setSidebarOpen, setFocusTrajectoryId]
  );

  // Handle trajectory click from globe/flatmap
  const handleMapTrajectoryClick = useCallback(
    (t: { id: string; name: string; color: string; locations: { id: string; name: string; lat: number; lng: number; order: number }[] }) => {
      const full = trajectories.find((tr) => tr.id === t.id);
      if (full) {
        setDetailTrajectory(full);
        setFocusTrajectoryId(t.id);
        setTimeout(() => {
          setFocusTrajectoryId(null);
        }, 6000);
      }
    },
    [trajectories, setDetailTrajectory, setFocusTrajectoryId]
  );

  // Compute detail trajectory stats
  const detailStats = useMemo(() => {
    if (!detailTrajectory) return null;
    const sorted = [...detailTrajectory.locations].sort((a, b) => a.order - b.order);
    const distance = totalRouteDistance(sorted);
    const days = tripDurationDays(detailTrajectory.startDate, detailTrajectory.endDate);
    const avgPerDay = days > 0 ? distance / days : 0;
    return { distance, days, avgPerDay, sorted };
  }, [detailTrajectory]);

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-neutral-950 overflow-hidden relative">
      {/* ─── Header ─── */}
      <header className="absolute top-0 left-0 right-0 z-30 px-4 sm:px-6 pt-4 sm:pt-5 flex items-start justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <Menu className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 sm:w-96 p-0">
              <SheetHeader className="p-5 pb-3">
                <SheetTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-4 w-4 text-neutral-500" />
                  轨迹记录
                </SheetTitle>
                <p className="text-sm text-neutral-500 -mt-1">旅行轨迹记录</p>
              </SheetHeader>
              <Separator />
              {/* Search */}
              <div className="px-4 py-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                  <Input
                    placeholder="搜索轨迹、地点..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-8 text-sm bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 focus:bg-white dark:focus:bg-neutral-700"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {searchQuery && (
                  <p className="text-[10px] text-neutral-400 mt-1.5 px-1">
                    找到 {filteredTrajectories.length} 个轨迹
                  </p>
                )}
              </div>
              {/* Stats */}
              <div className="px-5 pb-3 flex gap-2.5">
                <div className="flex-1 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-neutral-800 dark:text-neutral-200">{trajectories.length}</div>
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wider">轨迹</div>
                </div>
                <div className="flex-1 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-neutral-800 dark:text-neutral-200">{totalLocations}</div>
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wider">地点</div>
                </div>
                <div className="flex-1 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-neutral-800 dark:text-neutral-200 text-xs">
                    {globalDistance > 0 ? `${(globalDistance / 1000).toFixed(1)}k` : '0'}
                  </div>
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wider">km</div>
                </div>
              </div>
              <Separator />
              {/* Trajectory List */}
              <ScrollArea className="flex-1 h-[calc(100vh-260px)]">
                <div className="p-3 space-y-1.5">
                  {filteredTrajectories.length === 0 && (
                    <div className="text-center py-12 text-neutral-400 text-sm">
                      {searchQuery ? '没有匹配的轨迹' : '还没有轨迹，点击右下角按钮开始记录'}
                    </div>
                  )}
                  {filteredTrajectories.map((t) => {
                    const sorted = [...t.locations].sort((a, b) => a.order - b.order);
                    const dist = totalRouteDistance(sorted);
                    const days = tripDurationDays(t.startDate, t.endDate);
                    return (
                      <motion.button
                        key={t.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSidebarTrajectoryClick(t)}
                        className={`w-full text-left px-3 py-3 rounded-xl transition-colors group ${
                          focusTrajectoryId === t.id
                            ? 'bg-neutral-100 dark:bg-neutral-800'
                            : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-3 h-3 rounded-full mt-1 shrink-0 ring-2 ring-offset-1"
                            style={{ backgroundColor: t.color, ringColor: t.color + '30' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-neutral-800 dark:text-neutral-200 truncate">
                              {t.name}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="flex items-center gap-1 text-xs text-neutral-400">
                                <Calendar className="h-3 w-3" />
                                {formatDate(t.startDate)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="flex items-center gap-1 text-xs text-neutral-400">
                                <MapPin className="h-3 w-3" />
                                {t.locations.length} 地点
                              </span>
                              <span className="flex items-center gap-1 text-xs text-neutral-400">
                                <Route className="h-3 w-3" />
                                {formatDistance(dist)}
                              </span>
                              <span className="flex items-center gap-1 text-xs text-neutral-400">
                                <Clock className="h-3 w-3" />
                                {formatDuration(days)}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTrajectory(t);
                                setSidebarOpen(false);
                              }}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-400 hover:text-red-500 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(t.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>

        {/* Center title */}
        <div className="pointer-events-none hidden sm:block">
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">轨迹记录</h1>
          <p className="text-xs text-neutral-400 text-center mt-0.5">Travel Tracker</p>
        </div>

        {/* Right side controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Map mode toggle */}
          <div className="flex items-center gap-1 px-1 py-1 rounded-xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-sm border border-neutral-200 dark:border-neutral-700">
            <ToggleGroup
              type="single"
              value={mapMode}
              onValueChange={(val) => {
                if (val) setMapMode(val as 'globe' | 'flat');
              }}
              className="bg-transparent gap-0"
            >
              <ToggleGroupItem
                value="globe"
                size="sm"
                className="h-8 w-8 rounded-lg data-[state=on]:bg-neutral-900 data-[state=on]:text-white dark:data-[state=on]:bg-neutral-100 dark:data-[state=on]:text-neutral-900 p-0"
                aria-label="3D Globe"
              >
                <Globe2 className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="flat"
                size="sm"
                className="h-8 w-8 rounded-lg data-[state=on]:bg-neutral-900 data-[state=on]:text-white dark:data-[state=on]:bg-neutral-100 dark:data-[state=on]:text-neutral-900 p-0"
                aria-label="2D Map"
              >
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Dark mode toggle */}
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl border-neutral-200 bg-white/80 dark:bg-neutral-900/80 dark:border-neutral-700 backdrop-blur-sm shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="h-4 w-4 text-neutral-700 dark:hidden" />
            <Moon className="h-4 w-4 text-neutral-300 hidden dark:block" />
          </Button>

          {/* Stats button */}
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl border-neutral-200 bg-white/80 dark:bg-neutral-900/80 dark:border-neutral-700 backdrop-blur-sm shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
            onClick={() => setStatsPanelOpen(true)}
          >
            <BarChart3 className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
          </Button>
        </div>
      </header>

      {/* ─── Globe / Flat Map ─── */}
      <div className="flex-1 relative">
        {/* Keep both mounted to prevent unmount/remount flash */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ opacity: mapMode === 'globe' ? 1 : 0, pointerEvents: mapMode === 'globe' ? 'auto' : 'none' }}
        >
          <PixelGlobe
            trajectories={mapTrajectories}
            onTrajectoryClick={handleMapTrajectoryClick}
            focusTrajectoryId={focusTrajectoryId}
            className="w-full h-full"
            isDark={isDark}
          />
        </div>
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ opacity: mapMode === 'flat' ? 1 : 0, pointerEvents: mapMode === 'flat' ? 'auto' : 'none' }}
        >
          <FlatMap
            trajectories={mapTrajectories}
            onTrajectoryClick={handleMapTrajectoryClick}
            focusTrajectoryId={focusTrajectoryId}
            className="w-full h-full"
            isDark={isDark}
          />
        </div>

        {/* Loading overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/60 dark:bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center z-10"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-neutral-200 dark:border-neutral-700 border-t-neutral-600 dark:border-t-neutral-300 rounded-full animate-spin" />
                <span className="text-xs text-neutral-400">加载中...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Stats bar at bottom ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
        <div className="flex justify-center pb-5">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-full bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-sm border border-neutral-100 dark:border-neutral-800">
            <Badge variant="secondary" className="font-mono text-xs px-2.5">
              {trajectories.length} 轨迹
            </Badge>
            <div className="w-px h-3 bg-neutral-200" />
            <Badge variant="secondary" className="font-mono text-xs px-2.5">
              {totalLocations} 地点
            </Badge>
            <div className="w-px h-3 bg-neutral-200" />
            <Badge variant="secondary" className="font-mono text-xs px-2.5">
              {formatDistance(globalDistance)}
            </Badge>
          </div>
        </div>
      </div>

      {/* ─── FAB: Add Trajectory ─── */}
      <motion.div
        className="absolute bottom-16 right-5 z-20"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          onClick={() => useTrajectoryStore.getState().setFormDialogOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg bg-neutral-900 hover:bg-neutral-800 text-white"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </motion.div>

      {/* ─── Trajectory Detail Panel (Improved) ─── */}
      <AnimatePresence>
        {detailPanelOpen && detailTrajectory && detailStats && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute inset-x-4 bottom-20 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[480px] z-40"
          >
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-100 dark:border-neutral-800 overflow-hidden">
              {/* Header */}
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full ring-2 ring-offset-2"
                      style={{ backgroundColor: detailTrajectory.color, ringColor: detailTrajectory.color + '40' }}
                    />
                    <div>
                      <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">{detailTrajectory.name}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {formatDate(detailTrajectory.startDate)}
                        {detailTrajectory.endDate && ` — ${formatDate(detailTrajectory.endDate)}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingTrajectory(detailTrajectory);
                        setDetailPanelOpen(false);
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-50"
                      onClick={() => handleDelete(detailTrajectory.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDetailPanelOpen(false)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {detailTrajectory.note && (
                  <p className="text-sm text-neutral-500 mt-2 leading-relaxed">{detailTrajectory.note}</p>
                )}

                {/* Stats row */}
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <Route className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {formatDistance(detailStats.distance)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {formatDuration(detailStats.days)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <Navigation className="h-3.5 w-3.5 text-rose-600" />
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {detailStats.avgPerDay > 0 ? formatDistance(detailStats.avgPerDay) + '/天' : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <MapPin className="h-3.5 w-3.5 text-violet-600" />
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {detailTrajectory.locations.length} 地点
                    </span>
                  </div>
                </div>
              </div>
              <Separator />
              {/* Locations */}
              <ScrollArea className="max-h-52">
                <div className="px-5 py-3">
                  <div className="space-y-2.5">
                    {detailStats.sorted.map((loc, idx) => {
                      const prevLoc = idx > 0 ? detailStats.sorted[idx - 1] : null;
                      const segmentDist = prevLoc
                        ? totalRouteDistance([
                            { lat: prevLoc.lat, lng: prevLoc.lng },
                            { lat: loc.lat, lng: loc.lng },
                          ])
                        : null;

                      return (
                        <div key={loc.id || idx} className="flex items-start gap-3">
                          <div className="flex flex-col items-center mt-0.5">
                            <div
                              className="w-2.5 h-2.5 rounded-full border-2 border-white dark:border-neutral-900 shadow-sm"
                              style={{ backgroundColor: detailTrajectory.color }}
                            />
                            {idx < detailTrajectory.locations.length - 1 && (
                              <div
                                className="w-px h-6 mt-0.5"
                                style={{ backgroundColor: detailTrajectory.color + '30' }}
                              />
                            )}
                          </div>
                          <div className="flex-1 -mt-0.5">
                            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{loc.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-neutral-400 font-mono">
                                {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                              </span>
                              {segmentDist !== null && (
                                <span className="flex items-center gap-0.5 text-[10px] text-neutral-400">
                                  <ChevronRight className="h-2.5 w-2.5" />
                                  {formatDistance(segmentDist)}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] px-1.5 font-mono text-neutral-400">
                            {idx + 1}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Statistics Panel ─── */}
      <StatisticsPanel
        trajectories={trajectories}
        open={statsPanelOpen}
        onClose={() => setStatsPanelOpen(false)}
      />

      {/* ─── Trajectory Form Dialog ─── */}
      <TrajectoryFormDialog
        open={formDialogOpen}
        onOpenChange={(open) => {
          if (!open) useTrajectoryStore.getState().setFormDialogOpen(false);
        }}
        onSuccess={() => {
          fetchTrajectories();
          useTrajectoryStore.getState().setFormDialogOpen(false);
        }}
      />
    </div>
  );
}
