import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/study-buddy/',
  optimizeDeps: {
    include: ['react-plotly.js'],
  },
  server: {
    mimeTypes: {
      '.js': 'application/javascript',
    },
  },
});
