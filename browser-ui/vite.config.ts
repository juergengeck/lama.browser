import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: './',
  clearScreen: false,
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@model': path.resolve(__dirname, './src/model'),

      // Shared directories (relative to browser-ui/)
      '@shared': path.resolve(__dirname, '../shared'),
      '@worker': path.resolve(__dirname, '../worker'),
      '@lama/core': path.resolve(__dirname, '../../lama.core'),
      '@chat/core': path.resolve(__dirname, '../../chat.core'),

      // CRITICAL: Use the ONE.core packages directly - NO duplication
      '@refinio/one.core': path.resolve(__dirname, '../packages/one.core'),
      '@refinio/one.models': path.resolve(__dirname, '../packages/one.models'),
      '@anthropic-ai/sdk': path.resolve(__dirname, '../node_modules/@anthropic-ai/sdk')
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    // CRITICAL: Dedupe ONE.core to ensure single recipe registry instance
    dedupe: ['react', 'react-dom', '@refinio/one.core', '@refinio/one.models']
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'tweetnacl'],
    exclude: [
      'electron',
      '@refinio/one.core',
      '@refinio/one.models'
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  worker: {
    format: 'es'
    // CRITICAL: Do NOT use inlineDynamicImports or separate rollupOptions
    // This would create a separate bundle with duplicate one.core instances
    // Vite's worker plugin with ?worker syntax ensures proper module sharing
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      external: [
        'ws',
        'dgram'
      ],
      output: {
        format: 'es',
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-avatar']
        }
      }
    }
  },
  server: {
    port: 5174,
    open: true,
    hmr: false,  // Disable HMR - ONE.core worker state doesn't survive hot reloads
    fs: {
      allow: [
        path.resolve(__dirname, '..'),  // Allow parent directory (for worker/, shared/, packages/)
        path.resolve(__dirname, '../..') // Allow grandparent (for lama.core)
      ]
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self' ws://localhost:* http://localhost:* wss://comm.refinio.net wss://comm10.dev.refinio.one wss://*.refinio.net wss://*.refinio.one https://*.refinio.net https://*.refinio.one https://huggingface.co https://*.huggingface.co http://localhost:11434; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
    }
  }
})