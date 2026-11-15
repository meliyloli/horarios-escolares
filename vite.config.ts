import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

const sinUso = new URL('./src/datos/sin-uso.ts', import.meta.url).pathname

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { html2canvas: sinUso, dompurify: sinUso, canvg: sinUso } },
  test: { environment: 'node' },
})
