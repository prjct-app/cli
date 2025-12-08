import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Use high ports to avoid conflicts with dev servers
const WEB_PORT = parseInt(process.env.PRJCT_WEB_PORT || '9472', 10)
const API_PORT = parseInt(process.env.PRJCT_PORT || '9471', 10)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: WEB_PORT,
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true
      },
      '/ws': {
        target: `ws://localhost:${API_PORT}`,
        ws: true
      }
    }
  }
})
