import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    // exclude convex/_generated from coverage or tests if needed
    exclude: ['node_modules', 'convex/_generated/**'],
  },
});
