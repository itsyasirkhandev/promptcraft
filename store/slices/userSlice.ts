import { StateCreator } from 'zustand';
import type { StoreState } from '../index';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface UserSlice {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateUserName: (name: string) => void;
}

export const createUserSlice: StateCreator<
  StoreState,
  [['zustand/immer', never], ['zustand/persist', unknown]],
  [],
  UserSlice
> = (set) => ({
  currentUser: null,
  isAuthenticated: false,
  login: (user) => set({ currentUser: user, isAuthenticated: true }),
  logout: () => set({ currentUser: null, isAuthenticated: false }),
  updateUserName: (name) =>
    set((state) => {
      if (state.currentUser) {
        state.currentUser.name = name;
      }
    }),
});
