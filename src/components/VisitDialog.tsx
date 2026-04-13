'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Globe2, MapPin, Calendar, FileText } from 'lucide-react';
import type { PendingVisit } from '@/lib/store';

interface VisitDialogProps {
  open: boolean;
  pendingVisit: PendingVisit | null;
  onConfirm: (visitedDate: string, note: string) => void;
  onCancel: () => void;
}

export default function VisitDialog({
  open,
  pendingVisit,
  onConfirm,
  onCancel,
}: VisitDialogProps) {
  const [visitedDate, setVisitedDate] = useState('');
  const [note, setNote] = useState('');

  const handleOpen = (isOpen: boolean) => {
    if (!isOpen) {
      setVisitedDate('');
      setNote('');
      onCancel();
    }
  };

  const handleConfirm = () => {
    onConfirm(visitedDate, note);
    setVisitedDate('');
    setNote('');
  };

  if (!pendingVisit) return null;

  const isCountry = pendingVisit.type === 'country';
  const displayName = isCountry
    ? (pendingVisit.nameZh || pendingVisit.name)
    : pendingVisit.name;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-[400px] bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
            {isCountry ? (
              <Globe2 className="h-4 w-4 text-amber-500" />
            ) : (
              <MapPin className="h-4 w-4 text-amber-500" />
            )}
            标记到访
          </DialogTitle>
          <DialogDescription className="text-neutral-500 dark:text-neutral-400">
            记录你到访 <span className="font-medium text-neutral-700 dark:text-neutral-300">{displayName}</span> 的信息
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Visit date */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <Calendar className="h-3.5 w-3.5 text-neutral-400" />
              到访日期
            </label>
            <Input
              type="date"
              value={visitedDate}
              onChange={(e) => setVisitedDate(e.target.value)}
              className="bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300">
              <FileText className="h-3.5 w-3.5 text-neutral-400" />
              备注
            </label>
            <Textarea
              placeholder="记录这次旅行的感受..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              取消
            </Button>
            <Button
              onClick={handleConfirm}
              className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200"
            >
              确认标记
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
