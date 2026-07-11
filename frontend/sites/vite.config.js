import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const APPS = ['landing', 'admin', 'nkhockey', 'mixmusic', 'dontforget', 'account', 'tournix', 'fiets', 'poulebord', 'beatload']

function spaFallback() {
  return {
    name: 'spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const app = APPS.find(a => req.url?.startsWith(`/${a}/`))
        if (app && !req.url.includes('.')) {
          req.url = `/${app}/index.html`
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), spaFallback()],
  root: __dirname,
  base: '/',
  resolve: {
    alias: {
      '@core':       path.resolve(__dirname, '../core'),
      '@components': path.resolve(__dirname, '../components'),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  server: {
    port: 5172,
    open: '/landing/',
    proxy: { '/api': 'http://localhost:8000' },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        landing:    path.resolve(__dirname, 'landing/index.html'),
        admin:      path.resolve(__dirname, 'admin/index.html'),
        nkhockey:   path.resolve(__dirname, 'nkhockey/index.html'),
        mixmusic:   path.resolve(__dirname, 'mixmusic/index.html'),
        dontforget: path.resolve(__dirname, 'dontforget/index.html'),
        account:    path.resolve(__dirname, 'account/index.html'),
        tournix:    path.resolve(__dirname, 'tournix/index.html'),
        fiets:      path.resolve(__dirname, 'fiets/index.html'),
        poulebord:  path.resolve(__dirname, 'poulebord/index.html'),
        beatload:   path.resolve(__dirname, 'beatload/index.html'),
      },
    },
  },
})
