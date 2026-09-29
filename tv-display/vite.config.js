import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Cho phép mọi thiết bị TV / di động trong mạng LAN kết nối
    port: 5174,
  }
})
