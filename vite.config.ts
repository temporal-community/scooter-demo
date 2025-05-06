import tailwindcss from '@tailwindcss/vite'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Phaser uses these global variables
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'global': 'globalThis',
  },
  optimizeDeps: {
    include: ['phaser']
  },
  build: {
    commonjsOptions: {
      include: [/phaser/, /node_modules/]
    }
  }
})
