import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createConfig(site, port, options = {}) {
  const base   = options.base   || `/${site}/`
  const outDir = options.outDir || `../../dist/${site}`

  return defineConfig({
    plugins: [react()],
    base,
    define: {
      __SITE__: JSON.stringify(site),
    },
    resolve: {
      alias: {
        '@core':       path.resolve(__dirname, 'core'),
        '@components': path.resolve(__dirname, 'components'),
      },
      dedupe: ['react', 'react-dom', 'react-router-dom'],
    },
    server: {
      port,
      proxy: { '/api': 'http://localhost:8000' },
    },
    build: {
      outDir,
      emptyOutDir: true,
    },
  })
}
