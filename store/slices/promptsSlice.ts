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
}


export interface PromptsSlice {
  prompts: Prompt[];
  addPrompt: (data: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => void;
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
});
