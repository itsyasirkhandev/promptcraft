import { StateCreator } from 'zustand';
import type { StoreState } from '../index';

export interface UISlice {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
}

export const createUISlice: StateCreator<
  StoreState,
  [['zustand/immer', never], ['zustand/persist', unknown]],
  [],
  UISlice
> = (set) => ({
  theme: 'light',
  sidebarOpen: false,
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () =>
    set((state) => {
      state.sidebarOpen = !state.sidebarOpen;
    }),
});
