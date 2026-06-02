import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/nkhockey/',
  server: {
        port: 5174,
  },
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
    __SITE__: JSON.stringify('nkhockey'),
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, '../../core'),
      '@components': path.resolve(__dirname, '../../components'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: '../../dist/nkhockey'
  }
})
