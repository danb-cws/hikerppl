import { defineConfig } from 'vite';

// Relative base so the built app works under any GitHub Pages path
// (e.g. https://<user>.github.io/hikerppl/) without extra config.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
  },
});
