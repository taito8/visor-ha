import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
    plugins: [preact()]
  }
})
