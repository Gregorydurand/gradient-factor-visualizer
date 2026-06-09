import { defineConfig } from 'vitest/config';

// The engine ships with a regression fixture (spec Section 12). Keep the test
// environment node-only — the engine is pure and must never touch the DOM.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['engine/**/*.test.ts', 'src/**/*.test.ts'],
    globals: false,
  },
});
