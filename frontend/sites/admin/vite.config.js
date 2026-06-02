import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "/admin/",
  define: {
    __APP_VERSION__: JSON.stringify("0.1.0"),
    __SITE__: JSON.stringify("admin"),
  },
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "../../core"),
      "@components": path.resolve(__dirname, "../../components"),
    },
    dedupe: ["react", "react-dom", "react-router-dom"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  build: {
    outDir: "../../../dist/admin",
    emptyOutDir: true,
  },
});
