import { create } from 'zustand';

// ─── Types ───

export interface VisitedCountry {
  id: string;
  code: string;
  name: string;
  nameZh: string;
  visitedDate: string;
  note: string;
  visitedAt: string;
}

export interface VisitedPlace {
  id: string;
  name: string;
  province: string;
  adcode: string;
  lat: number;
  lng: number;
  level: string;
  visitedDate: string;
  note: string;
  visitedAt: string;
}

export type AppView = 'globe' | 'world' | 'china' | 'stats';

// ─── Pending visit info for dialog ───

export type PendingVisit =
  | {
      type: 'country';
      code: string;
      name: string;
      nameZh: string;
    }
  | {
      type: 'place';
      name: string;
      province: string;
      adcode: string;
      level: string;
      lat: number;
      lng: number;
    };

// ─── State ───

interface TravelStoreState {
  // Data
  countries: VisitedCountry[];
  places: VisitedPlace[];
  isLoading: boolean;

  // UI
  currentView: AppView;
  sidebarOpen: boolean;
  pendingVisit: PendingVisit | null;
  dialogOpen: boolean;

  // Actions
  setCountries: (countries: VisitedCountry[]) => void;
  addCountry: (country: VisitedCountry) => void;
  removeCountry: (code: string) => void;
  setPlaces: (places: VisitedPlace[]) => void;
  addPlace: (place: VisitedPlace) => void;
  removePlace: (id: string) => void;
  setCurrentView: (view: AppView) => void;
  setIsLoading: (loading: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setPendingVisit: (visit: PendingVisit | null) => void;
  setDialogOpen: (open: boolean) => void;

  // Helpers
  isCountryVisited: (code: string) => boolean;
  isPlaceVisited: (name: string, province: string) => boolean;
}

export const useTravelStore = create<TravelStoreState>((set, get) => ({
  countries: [],
  places: [],
  isLoading: false,
  currentView: 'globe',
  sidebarOpen: false,
  pendingVisit: null,
  dialogOpen: false,

  setCountries: (countries) => set({ countries }),
  addCountry: (country) =>
    set((state) => ({ countries: [...state.countries, country] })),
  removeCountry: (code) =>
    set((state) => ({
      countries: state.countries.filter((c) => c.code !== code),
    })),
  setPlaces: (places) => set({ places }),
  addPlace: (place) =>
    set((state) => ({ places: [...state.places, place] })),
  removePlace: (id) =>
    set((state) => ({
      places: state.places.filter((p) => p.id !== id),
    })),
  setCurrentView: (view) => set({ currentView: view }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setPendingVisit: (visit) => set({ pendingVisit: visit }),
  setDialogOpen: (open) => set({ dialogOpen: open }),

  isCountryVisited: (code) =>
    get().countries.some((c) => c.code === code),
  isPlaceVisited: (name, province) =>
    get().places.some(
      (p) => p.name === name && p.province === (province || '')
    ),
}));
