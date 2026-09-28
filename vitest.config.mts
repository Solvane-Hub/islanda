import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Vite resolves the `@/*` alias from tsconfig.json natively (Vitest 4+),
  // so no path-mapping plugin is needed.
  resolve: {
    tsconfigPaths: true,
    // Unit tests execute in Node; Next's server-only marker is compile-time.
    alias: { 'server-only': 'next/dist/compiled/server-only/empty.js' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // E2E belongs to Playwright; keep the two runners from fighting over tests/e2e.
    include: ['tests/{unit,integration,rls}/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['lib/**', 'services/**', 'components/**'],
    },
  },
});
