import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
  },

  optimizeDeps: {
    include: ['leaflet', 'react-leaflet'],
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
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
          // leaflet + react-leaflet must share the same chunk as vendor (React).
          // Putting them in a separate chunk causes React context (MapContext/useMap)
          // to live in a different module instance from the React hook runtime → crash.
          if (id.includes('node_modules/')) return 'vendor';
        },
      },
    },
  },
});
