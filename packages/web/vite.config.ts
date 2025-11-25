import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Base path for extension embedding - files will be served from /web/
  base: '/web/',
  build: {
    // Output to extension's public folder
    outDir: resolve(__dirname, '../extension/public/web'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
