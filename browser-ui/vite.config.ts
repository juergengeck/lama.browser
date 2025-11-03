import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { apiPlugin } from './vite-plugin-api'

export default defineConfig({
  base: '/',
  clearScreen: false,
  publicDir: 'public',  // Include public/ files in build (for _redirects)
  plugins: [
    react(),
    apiPlugin()
  ],
  resolve: {
    alias: [
      // CRITICAL: Order matters - more specific paths must come first
      // Map lama.ui's internal @/ imports to lama.ui (for ui components)
      { find: /^@\/components\/ui\/(.*)$/, replacement: path.resolve(__dirname, '../../lama.ui/src/components/ui/$1') },
      { find: '@/lib/utils', exact: true, replacement: path.resolve(__dirname, '../../lama.ui/src/lib/utils') },

      // Local aliases for browser-ui
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@components', replacement: path.resolve(__dirname, './src/components') },
      { find: '@lib', replacement: path.resolve(__dirname, './src/lib') },
      { find: '@hooks', replacement: path.resolve(__dirname, './src/hooks') },
      { find: '@services', replacement: path.resolve(__dirname, './src/services') },
      { find: '@model', replacement: path.resolve(__dirname, './src/model') },

      // Shared directories
      { find: '@shared', replacement: path.resolve(__dirname, '../shared') },
      { find: '@worker', replacement: path.resolve(__dirname, '../worker') },
      { find: '@lama/core', replacement: path.resolve(__dirname, '../../lama.core') },
      { find: '@lama/ui', replacement: path.resolve(__dirname, '../../lama.ui/src') },
      { find: '@chat/core', replacement: path.resolve(__dirname, '../../chat.core') },

      // CRITICAL: Use the ONE.core packages directly - NO duplication
      { find: '@refinio/one.core', replacement: path.resolve(__dirname, '../packages/one.core') },
      { find: '@refinio/one.models', replacement: path.resolve(__dirname, '../packages/one.models') },

      // Stub out Claude for browser builds (CORS restrictions)
      { find: '@anthropic-ai/sdk', replacement: path.resolve(__dirname, './src/stubs/claude-stub.ts') }
    ],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    // CRITICAL: Dedupe ONE.core to ensure single recipe registry instance
    dedupe: ['react', 'react-dom', '@refinio/one.core', '@refinio/one.models']
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'tweetnacl',
      // CRITICAL: Include ONE.core modules that need deduplication
      // This forces Vite to treat them as a single module instance
      '@refinio/one.core/lib/object-recipes',
      '@refinio/one.core/lib/util/object'
    ],
    exclude: [
      'electron'
      // NOTE: Removed one.core/one.models from exclude to allow optimization and deduplication
      // They need to be optimized to ensure single module instance across the app
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    },
    // Force dedupe of ONE.core to prevent multiple instances
    force: true
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
    emptyOutDir: true,  // Clean dist before every build
    sourcemap: false,  // No source maps in production
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
    strictPort: true,  // Fail if port is busy instead of switching to another port
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