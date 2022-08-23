import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: new URL('src/index.ts', import.meta.url).pathname,
      formats: ['es'],
    },

    target: 'esnext',
  },
});
