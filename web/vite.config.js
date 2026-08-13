import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: proxy the REST API to the backend so the browser sees one origin (cookies work).
// Prod: `npm run build` -> web/dist, served by the backend (same origin).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
