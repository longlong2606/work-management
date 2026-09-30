import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Cho phép Smart TV và thiết bị trong mạng LAN kết nối
    port: 5173,
  }
})
