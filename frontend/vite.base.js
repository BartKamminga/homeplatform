// frontend/vite.base.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createConfig(site, port, base, outDir, version = "0.1.0") {
  return defineConfig({
    plugins: [react()],
    base,
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __SITE__: JSON.stringify(site),
    },
    resolve: {
      alias: {
        "@core": path.resolve(__dirname, "core"),
        "@components": path.resolve(__dirname, "components"),
      },
      dedupe: ["react", "react-dom", "react-router-dom"],
    },
    server: {
      port,
      proxy: { "/api": "http://localhost:8000" },
    },
    build: {
      outDir,
      emptyOutDir: true,
    },
  });
}
