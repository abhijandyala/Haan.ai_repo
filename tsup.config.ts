import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false,
  splitting: false,
  treeshake: true,
  external: ['react', 'ink'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
