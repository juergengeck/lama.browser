import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],

  // Root is project root, index.html loads /browser-ui/src/main.tsx
  root: '.',

  // Build configuration for UI
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    },
    sourcemap: true
  },

  // Resolve paths - align with browser-ui/tsconfig.json
  resolve: {
    alias: {
      // Main UI alias - relative to browser-ui/src/
      '@': resolve(__dirname, './browser-ui/src'),
      '@components': resolve(__dirname, './browser-ui/src/components'),
      '@lib': resolve(__dirname, './browser-ui/src/lib'),
      '@hooks': resolve(__dirname, './browser-ui/src/hooks'),
      '@services': resolve(__dirname, './browser-ui/src/services'),
      '@model': resolve(__dirname, './browser-ui/src/model'),

      // CRITICAL: lama.core uses @refinio imports but has no node_modules
      // Point to parent's node_modules for single ONE.core instance
      '@refinio/one.core': resolve(__dirname, './node_modules/@refinio/one.core'),
      '@refinio/one.models': resolve(__dirname, './node_modules/@refinio/one.models'),
      '@anthropic-ai/sdk': resolve(__dirname, './node_modules/@anthropic-ai/sdk')
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    // CRITICAL: Dedupe ONE.core to ensure single recipe registry instance
    dedupe: ['react', 'react-dom', '@refinio/one.core', '@refinio/one.models']
  },

  // Development server
  server: {
    port: 3000,
    open: true,
    headers: {
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self' ws://localhost:* http://localhost:* wss://comm.refinio.net wss://comm10.dev.refinio.one wss://*.refinio.net wss://*.refinio.one https://*.refinio.net https://*.refinio.one https://huggingface.co https://*.huggingface.co http://localhost:11434; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline';"
    }
  },

  // Optimize deps
  optimizeDeps: {
    include: ['react', 'react-dom', 'tweetnacl'],
    exclude: ['@refinio/one.core', '@refinio/one.models'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },

  // Define globals
  define: {
    global: 'globalThis'
  }
})
