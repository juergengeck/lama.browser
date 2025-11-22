import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['browser-ui/src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@one': path.resolve(__dirname, '../one.discovery/src'),
      '@lama/ui': path.resolve(__dirname, '../lama.ui/src'),
      '@lama/core': path.resolve(__dirname, '../lama.core/dist'),
      '@refinio/refinio-api': path.resolve(__dirname, '../refinio.api/dist'),
    },
  },
});
