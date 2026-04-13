'use client';

import { useMemo } from 'react';
import { Globe2, MapPin, Trash2, X, FileText, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { VisitedCountry, VisitedPlace } from '@/lib/store';

interface RecordSidebarProps {
  open: boolean;
  countries: VisitedCountry[];
  places: VisitedPlace[];
  onDeleteCountry: (code: string) => void;
  onDeletePlace: (id: string) => void;
  onClose: () => void;
}

// ─── Combined record type for unified timeline ───

type RecordItem =
  | { kind: 'country'; data: VisitedCountry }
  | { kind: 'place'; data: VisitedPlace };

export default function RecordSidebar({
  open,
  countries,
  places,
  onDeleteCountry,
  onDeletePlace,
  onClose,
}: RecordSidebarProps) {
  // Merge into a unified timeline sorted by visitedAt desc
  const records = useMemo(() => {
    const items: (RecordItem & { sortDate: Date })[] = [];

    for (const c of countries) {
      items.push({ kind: 'country', data: c, sortDate: new Date(c.visitedAt) });
    }
    for (const p of places) {
      items.push({ kind: 'place', data: p, sortDate: new Date(p.visitedAt) });
    }

    items.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
    return items;
  }, [countries, places]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 bottom-0 z-50 w-80 max-w-[85vw]
          bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800
          shadow-xl transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            探索记录
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            onClick={onClose}
            aria-label="关闭侧栏"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-1.5">
            <Globe2 className="h-3 w-3 text-amber-500" />
            <span className="text-xs text-neutral-600 dark:text-neutral-400">
              {countries.length} 国家
            </span>
          </div>
          <div className="w-px h-3 bg-neutral-200 dark:bg-neutral-700" />
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-rose-500" />
            <span className="text-xs text-neutral-600 dark:text-neutral-400">
              {places.length} 地区
            </span>
          </div>
        </div>

        {/* Records list */}
        <ScrollArea className="h-[calc(100vh-110px)]">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <Globe2 className="h-10 w-10 text-neutral-200 dark:text-neutral-700 mb-3" />
              <p className="text-sm text-neutral-400 dark:text-neutral-500">还没有探索记录</p>
              <p className="text-xs text-neutral-300 dark:text-neutral-600 mt-1 text-center">
                切换到世界地图或中国地图，点击国家/省份开始记录
              </p>
            </div>
          ) : (
            <div className="py-1">
              {records.map((record) => {
                if (record.kind === 'country') {
                  const c = record.data;
                  return (
                    <RecordRow
                      key={`country-${c.code}`}
                      icon={<Globe2 className="h-3.5 w-3.5 text-amber-500" />}
                      title={c.nameZh || c.name}
                      visitedDate={c.visitedDate}
                      note={c.note}
                      onDelete={() => onDeleteCountry(c.code)}
                    />
                  );
                } else {
                  const p = record.data;
                  return (
                    <RecordRow
                      key={`place-${p.id}`}
                      icon={<MapPin className="h-3.5 w-3.5 text-rose-500" />}
                      title={p.province ? `${p.province} · ${p.name}` : p.name}
                      visitedDate={p.visitedDate}
                      note={p.note}
                      onDelete={() => onDeletePlace(p.id)}
                    />
                  );
                }
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </>
  );
}

// ─── Record Row ───

function RecordRow({
  icon,
  title,
  visitedDate,
  note,
  onDelete,
}: {
  icon: React.ReactNode;
  title: string;
  visitedDate: string;
  note: string;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
      <div className="mt-0.5 shrink-0">{icon}</div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
          {title}
        </div>

        {visitedDate && (
          <div className="flex items-center gap-1 mt-0.5">
            <Calendar className="h-3 w-3 text-neutral-400" />
            <span className="text-xs text-neutral-400 dark:text-neutral-500">{visitedDate}</span>
          </div>
        )}

        {note && (
          <div className="flex items-start gap-1 mt-0.5">
            <FileText className="h-3 w-3 text-neutral-400 mt-0.5 shrink-0" />
            <span className="text-xs text-neutral-400 dark:text-neutral-500 line-clamp-2">{note}</span>
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onDelete}
        aria-label="删除记录"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
