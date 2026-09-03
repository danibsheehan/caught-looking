import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vitest/config';

const analyze = process.env.ANALYZE === 'true';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(analyze
      ? [
          visualizer({
            filename: 'dist/stats.html',
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
          }),
        ]
      : []),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '') || '/',
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'cobertura'],
      reportsDirectory: './coverage',
      exclude: [
        '**/*.config.*',
        '**/dist/**',
        'src/test/**',
        'src/types/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      /**
       * Floor vs current aggregate (~87% stmts, ~77% branches, ~84% funcs, ~89% lines).
       * Raise gradually as suites grow; `npm run test:coverage` prints the table locally.
       * Replaces the previous external check_cobertura_line_rate.py threshold gate --
       * Vitest can enforce this natively, matching musing's pattern.
       */
      thresholds: {
        statements: 83,
        branches: 73,
        functions: 80,
        lines: 85,
      },
    },
  },
});
