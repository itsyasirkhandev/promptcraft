import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createUISlice, type UISlice } from './slices/uiSlice';

// Auth state is NOT managed here.
// Convex Auth is the single Viewer identity source.
// Persisting Firebase auth state in Zustand would create a second source of truth
// that can drift from the Firebase SDK's own session state.
export type StoreState = UISlice;

export const useAppStore = create<StoreState>()(
  persist(
    immer((...a) => ({
      ...createUISlice(...a),
    })),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
