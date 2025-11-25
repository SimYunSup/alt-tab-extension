import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const isInternal = mode === 'internal';

  return {
    plugins: [react(), tailwindcss()],
    // Base path differs based on mode
    base: isInternal ? '/web/' : '/',
    build: {
      // Output directory differs based on mode
      outDir: isInternal
        ? resolve(__dirname, '../extension/public/web')
        : resolve(__dirname, 'dist'),
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
  };
})
