import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Disable the Vite error overlay — our ErrorBoundary handles errors instead
    hmr: {
      overlay: false,
    },
  },
})
