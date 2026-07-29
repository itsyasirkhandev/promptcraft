import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'edge-runtime',
    globals: true,
    include: ['convex/**/*.test.ts'],
    exclude: ['node_modules', 'convex/_generated/**'],
  },
});
