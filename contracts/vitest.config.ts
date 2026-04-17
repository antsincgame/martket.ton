import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.spec.ts'],
    testTimeout: 30_000,
    setupFiles: ['tests/setup.ts'],
  },
});
