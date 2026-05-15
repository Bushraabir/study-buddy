import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react:   ['react', 'react-dom'],
          router:  ['react-router-dom'],
          firebase:['firebase/app', 'firebase/auth', 'firebase/firestore'],
          plotly:  ['react-plotly.js', 'plotly.js'],
        },
      },
    },

    chunkSizeWarningLimit: 1000,

    minify: 'esbuild',
    sourcemap: false,

    assetsInlineLimit: 4096,
  },

  optimizeDeps: {
    include: ['react-plotly.js'],
  },

  server: {
    mimeTypes: {
      '.js': 'application/javascript',
    },
  },
});