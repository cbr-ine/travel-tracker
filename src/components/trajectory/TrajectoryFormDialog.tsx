'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, Search, MapPin, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useTrajectoryStore } from '@/lib/store';

// ─── Color presets ───
const COLOR_PRESETS = [
  '#E85D4A', '#F4A261', '#E9C46A', '#2A9D8F',
  '#264653', '#D4A5A5', '#9B5DE5', '#00BBF9',
  '#FF6B6B', '#48CAE4', '#FFD166', '#06D6A0',
];

// ─── Types ───

interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface TrajectoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface LocationFormData {
  name: string;
  lat: number;
  lng: number;
}

// ─── Component ───

export default function TrajectoryFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: TrajectoryFormDialogProps) {
  const editingTrajectory = useTrajectoryStore((s) => s.editingTrajectory);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [note, setNote] = useState('');
  const [locations, setLocations] = useState<LocationFormData[]>([
    { name: '', lat: 0, lng: 0 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search state for each location
  const [searchResults, setSearchResults] = useState<GeocodeResult[][]>(
    Array(10).fill([])
  );
  const [searchLoading, setSearchLoading] = useState<boolean[]>(
    Array(10).fill(false)
  );
  const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);
  const searchTimers = useRef<NodeJS.Timeout[]>([]);

  // Populate form when editing
  useEffect(() => {
    if (open && editingTrajectory) {
      setName(editingTrajectory.name);
      setStartDate(editingTrajectory.startDate?.split('T')[0] || '');
      setEndDate(editingTrajectory.endDate?.split('T')[0] || '');
      setColor(editingTrajectory.color);
      setNote(editingTrajectory.note || '');
      setLocations(
        editingTrajectory.locations.map((l) => ({
          name: l.name,
          lat: l.lat,
          lng: l.lng,
        }))
      );
    } else if (open) {
      // Reset form for new trajectory
      setName('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setColor(COLOR_PRESETS[0]);
      setNote('');
      setLocations([{ name: '', lat: 0, lng: 0 }]);
    }
    setActiveSearchIdx(null);
    setSearchResults(Array(10).fill([]));
  }, [open, editingTrajectory]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      searchTimers.current.forEach(clearTimeout);
    };
  }, []);

  // Location search
  const handleLocationSearch = useCallback(
    (query: string, idx: number) => {
      // Clear previous timer
      if (searchTimers.current[idx]) clearTimeout(searchTimers.current[idx]);

      if (query.length < 2) {
        setSearchResults((prev) => {
          const next = [...prev];
          next[idx] = [];
          return next;
        });
        setActiveSearchIdx(null);
        return;
      }

      setSearchLoading((prev) => {
        const next = [...prev];
        next[idx] = true;
        return next;
      });

      searchTimers.current[idx] = setTimeout(async () => {
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults((prev) => {
              const next = [...prev];
              next[idx] = data.slice(0, 5);
              return next;
            });
            setActiveSearchIdx(idx);
          }
        } catch {
          // Silently fail
        } finally {
          setSearchLoading((prev) => {
            const next = [...prev];
            next[idx] = false;
            return next;
          });
        }
      }, 400);
    },
    []
  );

  // Select search result
  const selectSearchResult = (result: GeocodeResult, idx: number) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    // Extract short name from display_name (first part before comma)
    const shortName = result.display_name.split(',')[0];

    setLocations((prev) => {
      const next = [...prev];
      next[idx] = { name: shortName, lat, lng };
      return next;
    });
    setActiveSearchIdx(null);
  };

  // Add location
  const addLocation = () => {
    setLocations((prev) => [...prev, { name: '', lat: 0, lng: 0 }]);
  };

  // Remove location
  const removeLocation = (idx: number) => {
    if (locations.length <= 1) {
      toast.error('至少需要一个地点');
      return;
    }
    setLocations((prev) => prev.filter((_, i) => i !== idx));
    setActiveSearchIdx(null);
  };

  // Submit form
  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('请输入轨迹名称');
      return;
    }
    if (!startDate) {
      toast.error('请选择开始日期');
      return;
    }

    // Check all locations have names and coordinates
    const validLocations = locations.filter((l) => l.name.trim() && l.lat !== 0 && l.lng !== 0);
    if (validLocations.length === 0) {
      toast.error('请至少添加一个有效的地点');
      return;
    }

    setIsSubmitting(true);

    try {
      const body = {
        name: name.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        color,
        note: note.trim() || undefined,
        locations: validLocations.map((l, i) => ({
          name: l.name.trim(),
          latitude: l.lat,
          longitude: l.lng,
          order: i,
        })),
      };

      const isEditing = editingTrajectory;
      const url = isEditing
        ? `/api/trajectories/${editingTrajectory.id}`
        : '/api/trajectories';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(isEditing ? '轨迹已更新' : '轨迹已创建');
        onSuccess();
      } else {
        const data = await res.json();
        toast.error(data.error || '操作失败');
      }
    } catch {
      toast.error('网络错误，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg">
            {editingTrajectory ? '编辑轨迹' : '新建轨迹'}
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-500">
            在地球上记录你的旅行轨迹
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-120px)]">
          <div className="px-6 pb-6 space-y-5">
            {/* Trajectory Name */}
            <div className="space-y-1.5">
              <Label htmlFor="traj-name" className="text-sm font-medium">
                轨迹名称 <span className="text-red-400">*</span>
              </Label>
              <Input
                id="traj-name"
                placeholder="例如：巴黎蜜月之旅"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start-date" className="text-sm font-medium">
                  开始日期 <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-date" className="text-sm font-medium">
                  结束日期
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">轨迹颜色</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full transition-all ${
                      color === c
                        ? 'ring-2 ring-offset-2 scale-110'
                        : 'hover:scale-105 opacity-60 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: c,
                      ringColor: c,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="traj-note" className="text-sm font-medium">
                备注
              </Label>
              <Textarea
                id="traj-note"
                placeholder="这次旅行有什么特别的故事..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            <Separator />

            {/* Locations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  途经地点 <span className="text-red-400">*</span>
                </Label>
                <span className="text-xs text-neutral-400">
                  {locations.filter((l) => l.name).length} 个地点
                </span>
              </div>

              <div className="space-y-2.5">
                {locations.map((loc, idx) => (
                  <div key={idx} className="space-y-1.5 relative">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="shrink-0 w-6 h-6 justify-center p-0 text-[10px] font-mono"
                      >
                        {idx + 1}
                      </Badge>
                      <Input
                        placeholder="搜索城市或地点..."
                        value={loc.name}
                        onChange={(e) => {
                          setLocations((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], name: e.target.value };
                            return next;
                          });
                          handleLocationSearch(e.target.value, idx);
                        }}
                        onFocus={() => {
                          if (loc.name.length >= 2) setActiveSearchIdx(idx);
                        }}
                        className="h-9 text-sm"
                      />
                      {searchLoading[idx] && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400 shrink-0" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-neutral-400 hover:text-red-500"
                        onClick={() => removeLocation(idx)}
                        disabled={locations.length <= 1}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Search results dropdown */}
                    {activeSearchIdx === idx && searchResults[idx]?.length > 0 && (
                      <div className="absolute left-8 right-10 top-full z-50 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
                        {searchResults[idx].map((result, ri) => (
                          <button
                            key={ri}
                            type="button"
                            onClick={() => selectSearchResult(result, idx)}
                            className="w-full text-left px-3 py-2 hover:bg-neutral-50 transition-colors border-b border-neutral-50 last:border-0"
                          >
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-neutral-400 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-sm text-neutral-800 truncate">
                                  {result.display_name.split(',')[0]}
                                </div>
                                <div className="text-[10px] text-neutral-400 truncate">
                                  {result.display_name}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLocation}
                className="w-full h-9 border-dashed text-neutral-500 hover:text-neutral-700"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                添加地点
              </Button>
            </div>

            {/* Submit */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-neutral-900 hover:bg-neutral-800"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    保存中...
                  </>
                ) : editingTrajectory ? (
                  '更新轨迹'
                ) : (
                  '创建轨迹'
                )}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
