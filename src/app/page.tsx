'use client';

import { useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, Menu, Heart, X, Trash2, Edit2, Calendar, Map } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Trajectory, useLoveTracksStore } from '@/lib/store';

// ─── Lazy load globe (Three.js SSR incompatible) ───
const PixelGlobe = dynamic(() => import('@/components/globe/PixelGlobe'), { ssr: false });

// ─── Trajectory Form Dialog ───
import TrajectoryFormDialog from '@/components/trajectory/TrajectoryFormDialog';

// ─── Helpers ───

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Main Page ───

export default function Home() {
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
  } = useLoveTracksStore();

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

  // Globe trajectories (transformed)
  const globeTrajectories = useMemo(
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

  return (
    <div className="h-screen w-screen flex flex-col bg-white overflow-hidden relative">
      {/* ─── Header ─── */}
      <header className="absolute top-0 left-0 right-0 z-30 px-4 sm:px-6 pt-4 sm:pt-5 flex items-start justify-between pointer-events-none">
        <div className="pointer-events-auto">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl border-neutral-200 bg-white/80 backdrop-blur-sm shadow-sm hover:bg-neutral-50"
              >
                <Menu className="h-4 w-4 text-neutral-700" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 sm:w-96 p-0">
              <SheetHeader className="p-5 pb-3">
                <SheetTitle className="flex items-center gap-2 text-lg">
                  <Heart className="h-4 w-4 text-red-400" />
                  Love Tracks
                </SheetTitle>
                <p className="text-sm text-neutral-500 -mt-1">我们的旅行轨迹</p>
              </SheetHeader>
              <Separator />
              {/* Stats */}
              <div className="px-5 py-3 flex gap-3">
                <div className="flex-1 bg-neutral-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-neutral-800">{trajectories.length}</div>
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wider">轨迹</div>
                </div>
                <div className="flex-1 bg-neutral-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-neutral-800">{totalLocations}</div>
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wider">地点</div>
                </div>
              </div>
              <Separator />
              {/* Trajectory List */}
              <ScrollArea className="flex-1 h-[calc(100vh-220px)]">
                <div className="p-3 space-y-1.5">
                  {trajectories.length === 0 && (
                    <div className="text-center py-12 text-neutral-400 text-sm">
                      还没有轨迹，点击右下角按钮开始记录
                    </div>
                  )}
                  {trajectories.map((t) => (
                    <motion.button
                      key={t.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setDetailTrajectory(t);
                        setSidebarOpen(false);
                      }}
                      className="w-full text-left px-3 py-3 rounded-xl hover:bg-neutral-50 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-3 h-3 rounded-full mt-1 shrink-0 ring-2 ring-offset-1"
                          style={{ backgroundColor: t.color, ringColor: t.color + '30' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-neutral-800 truncate">{t.name}</div>
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-neutral-400">
                            <Calendar className="h-3 w-3" />
                            {formatDate(t.startDate)}
                            {t.endDate && ` — ${formatDate(t.endDate)}`}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-neutral-400">
                            <MapPin className="h-3 w-3" />
                            {t.locations.length} 个地点
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>

        {/* Center title */}
        <div className="pointer-events-none hidden sm:block">
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Love Tracks</h1>
          <p className="text-xs text-neutral-400 text-center mt-0.5">恋爱轨迹记录器</p>
        </div>

        {/* Right side empty for balance */}
        <div className="w-10" />
      </header>

      {/* ─── Globe ─── */}
      <div className="flex-1 relative">
        <PixelGlobe
          trajectories={globeTrajectories}
          onTrajectoryClick={(t) => {
            const full = trajectories.find((tr) => tr.id === t.id);
            if (full) setDetailTrajectory(full);
          }}
          className="w-full h-full"
        />

        {/* Loading overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-600 rounded-full animate-spin" />
                <span className="text-xs text-neutral-400">加载中...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Stats bar at bottom ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
        <div className="flex justify-center pb-5">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm shadow-sm border border-neutral-100">
            <Badge variant="secondary" className="font-mono text-xs px-2.5">
              {trajectories.length} 轨迹
            </Badge>
            <div className="w-px h-3 bg-neutral-200" />
            <Badge variant="secondary" className="font-mono text-xs px-2.5">
              {totalLocations} 地点
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
          onClick={() => useLoveTracksStore.getState().setFormDialogOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg bg-neutral-900 hover:bg-neutral-800 text-white"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </motion.div>

      {/* ─── Trajectory Detail Panel ─── */}
      <AnimatePresence>
        {detailPanelOpen && detailTrajectory && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute inset-x-4 bottom-20 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[440px] z-40"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-neutral-100 overflow-hidden">
              {/* Header */}
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full ring-2 ring-offset-2"
                      style={{ backgroundColor: detailTrajectory.color, ringColor: detailTrajectory.color + '40' }}
                    />
                    <div>
                      <h3 className="font-semibold text-base text-neutral-900">{detailTrajectory.name}</h3>
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
              </div>
              <Separator />
              {/* Locations */}
              <ScrollArea className="max-h-48">
                <div className="px-5 py-3">
                  <div className="space-y-2.5">
                    {detailTrajectory.locations
                      .sort((a, b) => a.order - b.order)
                      .map((loc, idx) => (
                        <div key={loc.id || idx} className="flex items-start gap-3">
                          <div className="flex flex-col items-center mt-0.5">
                            <div
                              className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm"
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
                            <div className="text-sm font-medium text-neutral-800">{loc.name}</div>
                            <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                              {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] px-1.5 font-mono text-neutral-400">
                            {idx + 1}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>
              </ScrollArea>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Trajectory Form Dialog ─── */}
      <TrajectoryFormDialog
        open={formDialogOpen}
        onOpenChange={(open) => {
          if (!open) useLoveTracksStore.getState().setFormDialogOpen(false);
        }}
        onSuccess={() => {
          fetchTrajectories();
          useLoveTracksStore.getState().setFormDialogOpen(false);
        }}
      />
    </div>
  );
}
