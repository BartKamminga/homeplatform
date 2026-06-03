import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify("0.1.0"),
    __SITE__: JSON.stringify("landing"),
  },
  server: {
    port: 5172,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  build: {
    outDir: "../../dist/landing",
    emptyOutDir: true,
  },
});
