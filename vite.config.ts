/// <reference types="vitest/config" />
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        'test-3d': path.resolve(import.meta.dirname, 'test-3d/index.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // main.tsx only mounts the app, and components/ui is generated shadcn code.
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test-setup.ts',
        'src/main.tsx',
        'src/components/ui/**',
      ],
      reporter: ['text', 'html', 'json-summary'],
    },
  },
});
