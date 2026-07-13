import { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import type { TemplateField } from '@/lib/schemas/prompt.schema';

export interface Prompt {
  id: string;           // crypto.randomUUID()
  title: string;
  content: string;
  templateMode: boolean;
  isPublic: boolean;
  tags: string[];
  templateFields: TemplateField[];
  createdAt: number;    // Date.now()
  updatedAt?: number;
  category?: string;
}


export interface PromptsSlice {
  prompts: Prompt[];
  addPrompt: (data: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => void;
  deletePrompt: (id: string) => void;
  editPrompt: (id: string, data: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const createPromptsSlice: StateCreator<
  StoreState,
  [['zustand/immer', never], ['zustand/persist', unknown]],
  [],
  PromptsSlice
> = (set) => ({
  prompts: [],
  addPrompt: (data) =>
    set((state) => {
      const now = Date.now();
      state.prompts.push({
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        ...data,
      });
    }),
  deletePrompt: (id) =>
    set((state) => {
      state.prompts = state.prompts.filter((p) => p.id !== id);
    }),
  editPrompt: (id, data) =>
    set((state) => {
      const idx = state.prompts.findIndex((p) => p.id === id);
      if (idx !== -1) {
        state.prompts[idx] = {
          ...state.prompts[idx],
          ...data,
          updatedAt: Date.now(),
        };
      }
    }),
});
