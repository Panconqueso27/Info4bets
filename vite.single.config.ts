import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

// Build en un solo archivo (fuentes e imágenes como data URI) para publicar la versión web.
export default mergeConfig(
  base,
  defineConfig({
    build: { outDir: 'dist-web', assetsInlineLimit: 100_000_000, cssCodeSplit: false },
  }),
);
