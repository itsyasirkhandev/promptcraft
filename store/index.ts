import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createUISlice, type UISlice } from './slices/uiSlice';
import { createUserSlice, type UserSlice } from './slices/userSlice';

export type StoreState = UISlice & UserSlice;

export const useAppStore = create<StoreState>()(
  persist(
    immer((...a) => ({
      ...createUISlice(...a),
      ...createUserSlice(...a),
    })),
    {
      name: 'app-storage',
      // Optional: you can choose which storage to use, default is localStorage
      storage: createJSONStorage(() => localStorage),
      // Optional: choose what gets persisted
      partialize: (state) => ({ 
        theme: state.theme,
        sidebarOpen: state.sidebarOpen 
      }),
    }
  )
);
