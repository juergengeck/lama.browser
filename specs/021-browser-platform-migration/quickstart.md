# Quickstart: Browser Platform Migration

**Feature**: Browser Platform Migration
**Branch**: `021-browser-platform-migration`
**Last Updated**: 2025-10-18

## Overview

This guide provides step-by-step instructions for implementing the browser platform migration. Follow these steps in order.

## Prerequisites

- Node.js 18+ installed
- Modern browser (Chrome 90+, Safari 14+, Firefox 88+, Edge 90+)
- Access to lama.browser repository
- Basic understanding of Web Workers and IndexedDB

## Directory Structure

```
lama.browser/
├── specs/021-browser-platform-migration/   # You are here
│   ├── spec.md                            # Feature specification
│   ├── plan.md                            # Implementation plan
│   ├── research.md                        # Technical research
│   ├── data-model.md                      # Data structures
│   ├── quickstart.md                      # This file
│   └── contracts/                         # TypeScript contracts
│       ├── worker-messages.ts
│       └── storage-api.ts
```

## Step 1: Install Dependencies

```bash
cd /Users/gecko/src/lama/lama.browser

# Install root dependencies
npm install

# Add browser-specific dependencies
npm install --save-dev vite vitest @vitest/ui playwright @playwright/test

# Ensure TypeScript and build tools are current
npm install --save-dev typescript@latest @types/node@latest
```

## Step 2: Create Shared Types

Copy the contract definitions to the shared directory:

```bash
# Create shared directory structure
mkdir -p shared/types
mkdir -p shared/utils

# Copy contract files
cp specs/021-browser-platform-migration/contracts/worker-messages.ts shared/types/
cp specs/021-browser-platform-migration/contracts/storage-api.ts shared/types/
```

## Step 3: Set Up Vite Configuration

Create `vite.config.ts` in project root:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],

  // Separate build for UI and Worker
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        worker: resolve(__dirname, 'worker/index.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'worker'
            ? 'worker.js'
            : '[name].[hash].js'
        }
      }
    }
  },

  // Worker configuration
  worker: {
    format: 'es',
    plugins: []
  },

  // Resolve paths
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
      '@worker': resolve(__dirname, 'worker'),
      '@ui': resolve(__dirname, 'browser-ui/src')
    }
  },

  // Development server
  server: {
    port: 3000,
    open: true
  }
})
```

## Step 4: Create Worker Entry Point

Create `worker/index.ts`:

```typescript
import type { WorkerRequest, WorkerResponse } from '@shared/types/worker-messages'

// ONE.core browser platform import
import '@refinio/one.core/lib/system/load-browser.js'

console.log('[Worker] Initializing Web Worker...')

// Message handler registry
const handlers = new Map<string, (payload: unknown) => Promise<unknown>>()

// Register handlers (implement in step 5)
function registerHandler(
  type: string,
  handler: (payload: unknown) => Promise<unknown>
): void {
  handlers.set(type, handler)
}

// Message router
self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  const startTime = performance.now()

  try {
    // Find handler
    const handler = handlers.get(request.type)
    if (!handler) {
      throw new Error(`No handler registered for type: ${request.type}`)
    }

    // Execute handler
    const data = await handler(request.payload)

    // Send success response
    const response: WorkerResponse = {
      id: request.id,
      success: true,
      data,
      timestamp: Date.now()
    }

    self.postMessage(response, request.transferables || [])

    console.log(
      `[Worker] ${request.type} completed in ${(performance.now() - startTime).toFixed(2)}ms`
    )
  } catch (error) {
    // Send error response
    const response: WorkerResponse = {
      id: request.id,
      success: false,
      error: {
        code: 'OPERATION_FAILED',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      timestamp: Date.now()
    }

    self.postMessage(response)

    console.error(`[Worker] ${request.type} failed:`, error)
  }
})

console.log('[Worker] Web Worker initialized and ready')
```

## Step 5: Create Worker Client (UI Side)

Create `browser-ui/src/services/worker-client.ts`:

```typescript
import type {
  WorkerRequest,
  WorkerResponse,
  MessageType,
  MessageTypeMap
} from '@shared/types/worker-messages'

class WorkerClient {
  private worker: Worker | null = null
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }>()

  private static readonly DEFAULT_TIMEOUT = 30000 // 30 seconds

  /**
   * Initialize the worker
   */
  async init(): Promise<void> {
    if (this.worker) {
      console.warn('[WorkerClient] Worker already initialized')
      return
    }

    // Create worker
    this.worker = new Worker(
      new URL('../../../worker/index.ts', import.meta.url),
      { type: 'module' }
    )

    // Listen for responses
    this.worker.addEventListener('message', this.handleResponse.bind(this))

    // Listen for errors
    this.worker.addEventListener('error', (error) => {
      console.error('[WorkerClient] Worker error:', error)
    })

    console.log('[WorkerClient] Worker initialized')
  }

  /**
   * Send type-safe request to worker
   */
  async send<T extends MessageType>(
    type: T,
    payload: MessageTypeMap[T]['request'],
    transferables?: Transferable[]
  ): Promise<MessageTypeMap[T]['response']> {
    if (!this.worker) {
      throw new Error('Worker not initialized. Call init() first.')
    }

    // Create request
    const request: WorkerRequest = {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: Date.now(),
      transferables
    }

    // Create promise
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id)
        reject(new Error(`Request timeout: ${type}`))
      }, WorkerClient.DEFAULT_TIMEOUT)

      // Store pending request
      this.pendingRequests.set(request.id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout
      })

      // Send to worker
      this.worker!.postMessage(request, transferables || [])
    })
  }

  /**
   * Handle response from worker
   */
  private handleResponse(event: MessageEvent<WorkerResponse>): void {
    const response = event.data
    const pending = this.pendingRequests.get(response.id)

    if (!pending) {
      console.warn('[WorkerClient] Received response for unknown request:', response.id)
      return
    }

    // Clear timeout
    clearTimeout(pending.timeout)

    // Remove from pending
    this.pendingRequests.delete(response.id)

    // Resolve or reject
    if (response.success) {
      pending.resolve(response.data)
    } else {
      const error = new Error(response.error?.message || 'Unknown error')
      ;(error as any).code = response.error?.code
      ;(error as any).details = response.error?.details
      pending.reject(error)
    }
  }

  /**
   * Terminate worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Worker terminated'))
    }
    this.pendingRequests.clear()
  }
}

// Export singleton instance
export const workerClient = new WorkerClient()
```

## Step 6: Update React Hooks

Replace Electron IPC calls with worker client. Example for `useContacts`:

```typescript
// BEFORE (Electron IPC)
const contacts = await window.electronAPI.invoke('onecore:getContacts')

// AFTER (Worker Client)
import { workerClient } from '../services/worker-client'

const contacts = await workerClient.send('onecore:getContacts', {})
```

## Step 7: Initialize Worker in App

Update `browser-ui/src/App.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { workerClient } from './services/worker-client'

function App() {
  const [workerReady, setWorkerReady] = useState(false)

  useEffect(() => {
    // Initialize worker
    workerClient.init()
      .then(() => {
        console.log('Worker initialized')
        setWorkerReady(true)
      })
      .catch((error) => {
        console.error('Worker initialization failed:', error)
      })

    // Cleanup on unmount
    return () => {
      workerClient.terminate()
    }
  }, [])

  if (!workerReady) {
    return <div>Loading worker...</div>
  }

  return (
    // Your app UI
  )
}
```

## Step 8: Test Basic Communication

Create a simple test to verify worker communication:

```typescript
// tests/integration/worker-communication.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { workerClient } from '../../browser-ui/src/services/worker-client'

describe('Worker Communication', () => {
  beforeAll(async () => {
    await workerClient.init()
  })

  afterAll(() => {
    workerClient.terminate()
  })

  it('should get worker status', async () => {
    const response = await workerClient.send('onecore:getStatus', {})
    expect(response).toHaveProperty('initialized')
  })
})
```

Run tests:
```bash
npm run test
```

## Step 9: Run Development Server

```bash
# Start Vite dev server
npm run dev

# Open browser to http://localhost:3000
# Check browser console for worker initialization messages
```

## Step 10: Verify Browser Storage

Open browser DevTools:

1. Go to **Application** tab → **IndexedDB**
2. Look for `one-core` database
3. Expand to see object stores: `objects`, `vheads`, `rmaps`, `private`
4. Verify objects are being stored as you use the app

## Common Issues

### Worker Not Loading
**Error**: `Failed to load worker script`
**Solution**: Ensure Vite is configured correctly and worker file path is correct

### TypeScript Errors
**Error**: `Cannot find module '@shared/types'`
**Solution**: Add path alias to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["./shared/*"]
    }
  }
}
```

### Storage Quota Exceeded
**Error**: `QuotaExceededError`
**Solution**: Request persistent storage or implement cleanup:
```typescript
await workerClient.send('storage:requestPersistent', {})
```

### ONE.core Import Errors
**Error**: `Module not found: @refinio/one.core/lib/system/browser`
**Solution**: Ensure ONE.core packages are properly linked/installed

## Next Steps

After completing this quickstart:

1. Implement remaining message handlers (see `data-model.md`)
2. Migrate all Electron IPC handlers to worker handlers
3. Update all React hooks to use worker client
4. Add storage quota monitoring
5. Implement data cleanup strategies
6. Add comprehensive tests
7. Deploy to a web server for browser access

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [ONE.core Documentation](./packages/one.core/README.md)

## Getting Help

If you encounter issues:

1. Check browser console for worker initialization messages
2. Verify IndexedDB is accessible (DevTools → Application → IndexedDB)
3. Review research.md for technical deep dives
4. Check data-model.md for message protocol details
