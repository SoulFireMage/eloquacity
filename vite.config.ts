import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Relative base + hash routing lets the build run from any GitHub Pages path.
export default defineConfig({
  base: './',
  plugins: [preact()],
  test: { environment: 'node' },
} as any);
