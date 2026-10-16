import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
// Сборка статической страницы-схемы континента: npx vite build --config tools/continent/viewer/vite.config.ts
export default defineConfig({
  root: here,
  base: './',
  publicDir: 'public',
  build: { outDir: 'site', emptyOutDir: true, assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
});
