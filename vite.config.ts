import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Cross-origin isolation lets the on-device speech model use several threads.
const isolation = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { headers: isolation },
  preview: { headers: isolation },
  worker: { format: 'es' },
})
