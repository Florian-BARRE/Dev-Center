/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["@testing-library/jest-dom"],
  },
  server: {
    proxy: {
      "/api": {
        // BACKEND_URL is injected by docker-compose.dev.yml (http://idh-app:8000).
        // Falls back to localhost for local npm run dev without Docker.
        target: process.env.BACKEND_URL ?? "http://localhost:8000",
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying for /api/v1/bridge/{group_id}/logs
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
