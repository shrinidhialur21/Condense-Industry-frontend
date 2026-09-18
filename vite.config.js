import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    modulePreload: {
      // Rollup preloads a dynamic import's dependencies if the chunk that calls
      // import() is itself eagerly loaded (every dashboard here is). The 3D scene
      // is 190KB gzipped and must stay a true click-to-load cost, not a hidden
      // preload tax on every other dashboard — so it's excluded here explicitly.
      resolveDependencies: (filename, deps) => deps.filter(dep => !dep.includes('three-3d')),
    },
    // Code-split each industry dashboard into its own chunk so the browser
    // only loads what the user clicks on.
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Each industry dashboard is its own async chunk
          const industries = [
            'ev', 'automotive', 'aviation', 'manufacturing',
            'logistics', 'bfsi', 'retail', 'healthcare', 'energy',
            'stockexchange', 'travel',
          ];
          for (const ind of industries) {
            if (id.includes(`/industries/${ind}/`)) return `industry-${ind}`;
          }
          // Recharts in its own chunk (large but only loaded on demand)
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-')) return 'recharts';
          // three.js + react-three-fiber/drei — only pulled in by Manufacturing's
          // lazy-loaded 3D scene. Keep them OUT of the eager "vendor" chunk so
          // every other dashboard's initial load stays exactly as fast as before.
          const threeDeps = [
            'node_modules/three', 'node_modules/@react-three', 'node_modules/@react-spring/three',
            'node_modules/camera-controls', 'node_modules/detect-gpu', 'node_modules/its-fine',
            'node_modules/maath', 'node_modules/meshline', 'node_modules/stats.js', 'node_modules/stats-gl',
            'node_modules/suspend-react', 'node_modules/troika-three-text', 'node_modules/troika-three-utils',
            'node_modules/troika-worker-utils', 'node_modules/use-sync-external-store', 'node_modules/zustand',
            'node_modules/@types/three', 'node_modules/@types/stats.js',
          ];
          if (threeDeps.some(dep => id.includes(dep))) return 'three-3d';
          if (id.includes('node_modules/')) return 'vendor';
        },
      },
    },
  },
});
