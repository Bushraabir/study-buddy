import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    darkMode: 'class', // Enable dark mode support
    theme: {
        extend: {

            boxShadow: {
                elegant: '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)', // Soft elegant shadows
            },

        },
    },

    optimizeDeps: {
        include: ['react-plotly.js']
    },

    server: {
        mimeTypes: {
            '.js': 'application/javascript',
        },
    },
});