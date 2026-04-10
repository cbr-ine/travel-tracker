'use client';

import dynamic from 'next/dynamic';

// ─── Re-export types from TrajectoryLayer to avoid duplication ───
export type { Trajectory, TrajectoryPoint } from './TrajectoryLayer';
import type { Trajectory } from './TrajectoryLayer';

// ─── Lazy load the entire Three.js scene to avoid SSR issues ───

const GlobeScene = dynamic(() => import('./GlobeScene'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-white dark:bg-neutral-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-neutral-200 dark:border-neutral-700 border-t-neutral-500 dark:border-t-neutral-300 rounded-full animate-spin" />
        <span className="text-xs text-neutral-400 font-medium tracking-wide">
          Loading Globe...
        </span>
      </div>
    </div>
  ),
});

export interface PixelGlobeProps {
  trajectories?: Trajectory[];
  onTrajectoryClick?: (trajectory: Trajectory) => void;
  className?: string;
  radius?: number;
  autoRotate?: boolean;
  focusTrajectoryId?: string | null;
  isDark?: boolean;
}

// ─── Main Component ───

export default function PixelGlobe({
  trajectories = [],
  onTrajectoryClick,
  className = '',
  radius = 2,
  autoRotate = true,
  focusTrajectoryId,
  isDark = false,
}: PixelGlobeProps) {
  return (
    <div
      className={`relative w-full h-full ${className}`}
      style={{ minHeight: '300px' }}
    >
      <GlobeScene
        trajectories={trajectories}
        onTrajectoryClick={onTrajectoryClick}
        radius={radius}
        autoRotate={autoRotate}
        focusTrajectoryId={focusTrajectoryId}
        isDark={isDark}
      />
    </div>
  );
}
