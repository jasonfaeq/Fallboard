import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Single-file build: `npm run build` produces dist/index.html you can open directly.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
})
