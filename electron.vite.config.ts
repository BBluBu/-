import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [
      react(),
      {
        name: 'development-csp',
        apply: 'serve',
        // Vite 的 React 热更新入口与动态样式仅在开发时需要内联支持。
        transformIndexHtml: (html) => html
          .replace("script-src 'self';", "script-src 'self' 'unsafe-inline';")
          .replace("style-src 'self';", "style-src 'self' 'unsafe-inline';")
      }
    ]
  }
})
