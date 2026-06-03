import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/mixmusic/',
  define: {
    __APP_VERSION__: JSON.stringify('0.1.0'),
    __SITE__: JSON.stringify('mixmusic'),
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, '../../core'),
      '@components': path.resolve(__dirname, '../../components'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5175,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    outDir: '../../dist/mixmusic',
    emptyOutDir: true,
  },
})
