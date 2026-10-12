import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Cho phep Smart TV va thiet bi trong mang LAN ket noi
    port: 5173,
    allowedHosts: true, // Cho phep truy cap tu moi duong link tunnel va IP dien thoai
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
})
