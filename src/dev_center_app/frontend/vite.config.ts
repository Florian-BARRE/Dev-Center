import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In local host development, backend is usually localhost:8000.
// In Docker Compose development, dev-center-frontend resolves backend by service name.
const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    // Host must be 0.0.0.0 for containerized development.
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      // Proxy HTTP and WebSocket upgrades for backend API routes.
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
});
