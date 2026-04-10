import { create } from 'zustand';

// ─── Types ───

export interface TrajectoryPoint {
  id?: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
}

export interface Trajectory {
  id: string;
  name: string;
  startDate: string;
  endDate?: string | null;
  color: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  locations: TrajectoryPoint[];
}

// ─── State ───

interface LoveTracksState {
  trajectories: Trajectory[];
  selectedTrajectoryId: string | null;
  sidebarOpen: boolean;
  formDialogOpen: boolean;
  editingTrajectory: Trajectory | null;
  detailPanelOpen: boolean;
  detailTrajectory: Trajectory | null;
  isLoading: boolean;

  // Actions
  setTrajectories: (trajectories: Trajectory[]) => void;
  addTrajectory: (trajectory: Trajectory) => void;
  updateTrajectory: (trajectory: Trajectory) => void;
  removeTrajectory: (id: string) => void;
  setSelectedTrajectoryId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setFormDialogOpen: (open: boolean) => void;
  setEditingTrajectory: (trajectory: Trajectory | null) => void;
  setDetailPanelOpen: (open: boolean) => void;
  setDetailTrajectory: (trajectory: Trajectory | null) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useLoveTracksStore = create<LoveTracksState>((set) => ({
  trajectories: [],
  selectedTrajectoryId: null,
  sidebarOpen: false,
  formDialogOpen: false,
  editingTrajectory: null,
  detailPanelOpen: false,
  detailTrajectory: null,
  isLoading: false,

  setTrajectories: (trajectories) => set({ trajectories }),
  addTrajectory: (trajectory) =>
    set((state) => ({ trajectories: [trajectory, ...state.trajectories] })),
  updateTrajectory: (trajectory) =>
    set((state) => ({
      trajectories: state.trajectories.map((t) =>
        t.id === trajectory.id ? trajectory : t
      ),
    })),
  removeTrajectory: (id) =>
    set((state) => ({
      trajectories: state.trajectories.filter((t) => t.id !== id),
      selectedTrajectoryId:
        state.selectedTrajectoryId === id ? null : state.selectedTrajectoryId,
    })),
  setSelectedTrajectoryId: (id) => set({ selectedTrajectoryId: id }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setFormDialogOpen: (open) =>
    set({ formDialogOpen: open, editingTrajectory: open ? null : null }),
  setEditingTrajectory: (trajectory) =>
    set({ editingTrajectory: trajectory, formDialogOpen: true }),
  setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),
  setDetailTrajectory: (trajectory) =>
    set({ detailTrajectory: trajectory, detailPanelOpen: true }),
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
