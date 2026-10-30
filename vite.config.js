import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs, so a build runs from any path — a subfolder on an
  // internal static host, not just a domain root.
  base: './',
  server: { port: 5178 },
})
