'use client';

import { useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { Globe2, Map, Navigation, BarChart3, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AppView, useTravelStore } from '@/lib/store';

// ─── Lazy load heavy 3D components (SSR unsafe) ───
const PixelGlobe = dynamic(() => import('@/components/globe/PixelGlobe'), { ssr: false });
const WorldMap = dynamic(() => import('@/components/map/WorldMap'), { ssr: false });
const ChinaMap = dynamic(() => import('@/components/map/ChinaMap').then(m => ({ default: m.default })), { ssr: false });
const StatisticsPanel = dynamic(() => import('@/components/StatisticsPanel'), { ssr: false });

// ─── Main Page ───

export default function Home() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const {
    countries,
    places,
    isLoading,
    currentView,
    setCurrentView,
    setIsLoading,
    setCountries,
    addCountry,
    removeCountry,
    setPlaces,
    addPlace,
    removePlace,
    statsPanelOpen,
    setStatsPanelOpen,
  } = useTravelStore();

  // ─── Fetch data on mount ───
  const fetchCountries = useCallback(async () => {
    try {
      const res = await fetch('/api/countries');
      if (res.ok) {
        const data = await res.json();
        setCountries(data);
      }
    } catch (err) {
      console.error('Failed to fetch countries:', err);
    }
  }, [setCountries]);

  const fetchPlaces = useCallback(async () => {
    try {
      const res = await fetch('/api/places');
      if (res.ok) {
        const data = await res.json();
        setPlaces(data);
      }
    } catch (err) {
      console.error('Failed to fetch places:', err);
    }
  }, [setPlaces]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchCountries(), fetchPlaces()]).finally(() => {
      setIsLoading(false);
    });
  }, [fetchCountries, fetchPlaces, setIsLoading]);

  // ─── World map toggle ───
  const handleToggleCountry = useCallback(
    async (code: string, name: string, nameZh: string) => {
      const isVisited = useTravelStore.getState().isCountryVisited(code);
      const displayName = nameZh || name;
      if (isVisited) {
        // Remove
        try {
          const res = await fetch(`/api/countries/${code}`, { method: 'DELETE' });
          if (res.ok) {
            removeCountry(code);
            toast.success(`已取消标记: ${displayName}`);
          }
        } catch {
          toast.error('操作失败');
        }
      } else {
        // Add
        const res = await fetch('/api/countries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, name, nameZh: nameZh || '' }),
        });
        if (res.ok) {
          const data = await res.json();
          addCountry(data);
          toast.success(`已标记: ${displayName}`);
        } else {
          const err = await res.json();
          toast.error(err.error || '操作失败');
        }
      }
    },
    [addCountry, removeCountry]
  );

  // ─── China map toggle ───
  const handleTogglePlace = useCallback(
    async (name: string, province: string, adcode: string, level: string, lat: number, lng: number) => {
      const isVisited = useTravelStore.getState().isPlaceVisited(name, province);
      console.log('[handleTogglePlace]', { name, province, adcode, level, lat, lng, isVisited });
      if (isVisited) {
        // Find and remove
        const place = places.find((p) => p.name === name && p.province === province);
        if (place) {
          try {
            const res = await fetch(`/api/places/${place.id}`, { method: 'DELETE' });
            if (res.ok) {
              removePlace(place.id);
              toast.success(`已取消标记: ${name}`);
            }
          } catch {
            toast.error('操作失败');
          }
        }
      } else {
        // Add
        const payload = { name, province, adcode, lat, lng, level };
        console.log('[handleTogglePlace] POST body:', JSON.stringify(payload));
        const res = await fetch('/api/places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        console.log('[handleTogglePlace] response:', res.status);
        if (res.ok) {
          const data = await res.json();
          addPlace(data);
          toast.success(`已标记: ${name}`);
        } else {
          const err = await res.json();
          toast.error(err.error || '操作失败');
        }
      }
    },
    [places, addPlace, removePlace]
  );

  // ─── Bottom nav items ───
  const navItems: { view: AppView; icon: typeof Globe2; label: string }[] = [
    { view: 'globe', icon: Globe2, label: '地球' },
    { view: 'world', icon: Map, label: '世界' },
    { view: 'china', icon: Navigation, label: '中国' },
    { view: 'stats', icon: BarChart3, label: '统计' },
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-neutral-950 overflow-hidden relative">
      {/* ─── Header ─── */}
      <header className="absolute top-0 left-0 right-0 z-30 px-4 sm:px-6 pt-4 sm:pt-5 flex items-start justify-between pointer-events-none">
        {/* Center title */}
        <div className="pointer-events-none w-full flex justify-center">
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">轨迹记录</h1>
        </div>

        {/* Right side controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Dark mode toggle */}
          <Button
            variant="outline"
            size="icon"
            aria-label="切换主题"
            className="h-10 w-10 rounded-xl border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="h-4 w-4 text-neutral-700 dark:hidden" />
            <Moon className="h-4 w-4 text-neutral-300 hidden dark:block" />
          </Button>
        </div>
      </header>

      {/* ─── Main Content Area ─── */}
      <div className="flex-1 relative pb-16">
        {/* Globe View */}
        <div
          className="absolute inset-0 bottom-16 transition-opacity duration-300"
          style={{
            opacity: currentView === 'globe' ? 1 : 0,
            pointerEvents: currentView === 'globe' ? 'auto' : 'none',
          }}
        >
          <PixelGlobe className="w-full h-full" isDark={isDark} />
        </div>

        {/* World Map View */}
        <div
          className="absolute inset-0 bottom-16 transition-opacity duration-300"
          style={{
            opacity: currentView === 'world' ? 1 : 0,
            pointerEvents: currentView === 'world' ? 'auto' : 'none',
          }}
        >
          <WorldMap
            visitedCountries={countries.map((c) => ({ code: c.code, name: c.name }))}
            onToggleCountry={handleToggleCountry}
            isDark={isDark}
            className="w-full h-full"
          />
        </div>

        {/* China Map View */}
        <div
          className="absolute inset-0 bottom-16 transition-opacity duration-300"
          style={{
            opacity: currentView === 'china' ? 1 : 0,
            pointerEvents: currentView === 'china' ? 'auto' : 'none',
          }}
        >
          <ChinaMap
            visitedPlaces={places.map((p) => ({
              name: p.name,
              province: p.province,
              adcode: p.adcode,
              level: p.level,
            }))}
            onTogglePlace={handleTogglePlace}
            isDark={isDark}
            className="w-full h-full"
          />
        </div>

        {/* Statistics View */}
        <div
          className="absolute inset-0 bottom-16 transition-opacity duration-300"
          style={{
            opacity: currentView === 'stats' ? 1 : 0,
            pointerEvents: currentView === 'stats' ? 'auto' : 'none',
          }}
        >
          <StatisticsPanel
            countries={countries}
            places={places}
            isDark={isDark}
            className="w-full h-full"
          />
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bottom-16 bg-white/60 dark:bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-neutral-200 dark:border-neutral-700 border-t-neutral-600 dark:border-t-neutral-300 rounded-full animate-spin" />
              <span className="text-xs text-neutral-400">加载中...</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom Navigation Bar ─── */}
      <nav className="absolute bottom-0 left-0 right-0 z-30">
        <div className="flex justify-center pb-3 px-4">
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-lg border border-neutral-100 dark:border-neutral-800">
            {navItems.map(({ view, icon: Icon, label }) => (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`
                  flex flex-col items-center gap-0.5 px-4 sm:px-5 py-1.5 rounded-xl transition-all duration-200
                  ${currentView === view
                    ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }
                `}
                aria-label={label}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
