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
      // Local aliases for browser-ui
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@components', replacement: path.resolve(__dirname, './src/components') },
      { find: '@lib', replacement: path.resolve(__dirname, './src/lib') },
      { find: '@hooks', replacement: path.resolve(__dirname, './src/hooks') },
      { find: '@services', replacement: path.resolve(__dirname, './src/services') },
      { find: '@model', replacement: path.resolve(__dirname, './src/model') },

      // Shared directories within this package
      { find: '@shared', replacement: path.resolve(__dirname, '../shared') },
      { find: '@worker', replacement: path.resolve(__dirname, '../worker') },

      // Stub out Node.js modules for browser builds (CORS restrictions)
      { find: '@anthropic-ai/sdk', replacement: path.resolve(__dirname, './src/stubs/claude-stub.ts') },
      // Stub out Node.js-only WhatsApp libraries
      { find: '@whiskeysockets/baileys', replacement: path.resolve(__dirname, './src/stubs/baileys-stub.ts') },
      { find: '@whiskeysockets/libsignal-node', replacement: path.resolve(__dirname, './src/stubs/libsignal-stub.ts') },

      // lamejs CJS modules have circular dependencies that break ESM bundling
      // Use the pre-bundled version which self-contains all dependencies
      { find: 'lamejs', replacement: path.resolve(__dirname, '../../lama.ui/src/lib/lamejs-shim.ts') },

      // CRITICAL: Use the webpack-built transformers.js dist directly
      // The v4 alpha from GitHub needs webpack build - esbuild pre-bundling breaks Chatterbox registration
      // Path is relative to monorepo root since pnpm hoists dependencies
      { find: '@huggingface/transformers', replacement: path.resolve(__dirname, '../../../node_modules/@huggingface/transformers/dist/transformers.js') }
    ],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    // CRITICAL: Dedupe ONE.core to ensure single recipe registry instance
    dedupe: ['react', 'react-dom', '@refinio/one.core', '@refinio/one.models']
  },
  define: {
    global: 'globalThis',
    // Required for Node.js polyfills (util, assert) that leak through baileys dependencies
    'process.env': {},
    'process.version': '"v20.0.0"',
    'process.platform': '"browser"'
  },
  optimizeDeps: {
    // CRITICAL: Include worker files in entries so Vite scans them for dependencies
    // at startup, not when the worker is first loaded (which triggers reload)
    entries: [
      './index.html',
      './src/workers/local-llm.worker.ts',
      './src/workers/tts.worker.ts'
    ],
    include: [
      'react',
      'react-dom',
      'tweetnacl',
      'scrypt-js',
      // CRITICAL: Include ONE.core modules that need deduplication
      // This forces Vite to treat them as a single module instance
      '@refinio/one.core/lib/object-recipes',
      '@refinio/one.core/lib/util/object',
      '@refinio/one.core/lib/system/browser/crypto-scrypt',
      '@refinio/one.core/lib/system/browser/storage-crypto'
    ],
    exclude: [
      'electron',
      // CRITICAL: Exclude transformers.js from esbuild pre-bundling
      // We alias it to the webpack-built dist which has proper Chatterbox registration
      '@huggingface/transformers',
      // qrcode-terminal has legacy octal escapes that break strict mode
      'qrcode-terminal'
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    },
    // Force dedupe of ONE.core to prevent multiple instances
    // NOTE: force: true was removed - it causes re-optimization on every restart
    // and triggers page reloads when worker dependencies are discovered
    force: false
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        // Ensure transformers.js is fully inlined in the worker bundle
        inlineDynamicImports: true
      }
    }
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,  // Clean dist before every build
    sourcemap: false,  // No source maps in production
    rollupOptions: {
      external: [
        'ws',
        // qrcode-terminal has legacy octal escapes that break strict mode
        'qrcode-terminal'
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
        path.resolve(__dirname, '../..'), // Allow grandparent (for lama.core, chat.core, etc.)
        path.resolve(__dirname, '../../packages') // Allow packages directory (symlink target)
      ]
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      // CSP: blob: in script-src required for ONNX Runtime WebGPU backend
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self' ws: http: https: wss://comm.refinio.net wss://comm10.dev.refinio.one wss://*.refinio.net wss://*.refinio.one https://*.refinio.net https://*.refinio.one https://huggingface.co https://*.huggingface.co https://cdn-lfs.hf.co https://cdn-lfs-us-1.hf.co; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:;"
    }
  }
})