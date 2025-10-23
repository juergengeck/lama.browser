# Storage Implementation for Browser Platform

## Overview

The browser platform uses ONE.core's IndexedDB-based storage system running in a Web Worker. This document describes the storage cleanup and management implementations.

## Storage Architecture

```
┌─────────────────────────────────────────┐
│         Browser UI Thread                │
│    (calls storage:cleanup, etc.)         │
└──────────────────┬──────────────────────┘
                   │ Worker Messages
                   ▼
┌─────────────────────────────────────────┐
│          Web Worker                      │
│   worker/messages/storage.ts             │
│                                          │
│   ┌──────────────────────────────────┐  │
│   │ Storage Message Handlers         │  │
│   │ - handleGetQuota()              │  │
│   │ - handleRequestPersistent()      │  │
│   │ - handleCleanup()                │  │
│   │ - handleGetStats()               │  │
│   └──────────────┬───────────────────┘  │
│                  │                       │
│                  ▼                       │
│   ┌──────────────────────────────────┐  │
│   │ ONE.core Browser Storage         │  │
│   │ @refinio/one.core/lib/system/    │  │
│   │        browser/storage-base.js   │  │
│   │                                  │  │
│   │ - deleteStorage()                │  │
│   │ - listAllObjectHashes()          │  │
│   │ - listAllIdHashes()              │  │
│   │ - listAllReverseMapNames()       │  │
│   └──────────────┬───────────────────┘  │
│                  │                       │
│                  ▼                       │
│   ┌──────────────────────────────────┐  │
│   │   IndexedDB API                  │  │
│   │   (Browser Native)               │  │
│   └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Implemented Storage Operations

### 1. Get Quota (`storage:getQuota`)

**Purpose**: Retrieve current browser storage quota information

**Implementation**: Uses `quotaMonitor.getState()`

**Returns**:
```typescript
{
  quota: number,        // Total available storage
  usage: number,        // Currently used storage
  percentage: number,   // Usage percentage
  available: number,    // Remaining storage
  persistent: boolean,  // Persistent storage granted?
  warnings: string[]    // Quota warnings
}
```

### 2. Request Persistent Storage (`storage:requestPersistent`)

**Purpose**: Request browser to grant persistent storage (prevents automatic cleanup)

**Implementation**: Uses `quotaMonitor.requestPersistent()`

**Returns**:
```typescript
{
  granted: boolean,
  message: string
}
```

### 3. Storage Cleanup (`storage:cleanup`)

**Purpose**: Clean up storage to free space

**Implementation**: Real cleanup using ONE.core APIs

#### Complete Storage Wipe (For Testing)

```typescript
// Request
{
  options: {
    completeWipe: true,
    dryRun: false  // Set to true to test without deleting
  }
}

// Response
{
  success: true,
  freedBytes: 52428800,  // Bytes freed
  itemsDeleted: -1,      // -1 indicates complete wipe
  details: {
    completeWipe: true,
    requiresRestart: true  // Worker must be restarted
  }
}
```

**Process**:
1. Shuts down ONE.core worker instance
2. Calls `deleteStorage(instanceIdHash)` from ONE.core
3. Deletes entire IndexedDB database
4. Returns freed bytes estimate from quota

**Use Case**: Testing fresh state, clearing all data

#### Selective Cleanup (Future)

```typescript
// Request
{
  options: {
    olderThan: 1234567890,  // Timestamp
    types: ['Message'],      // Object types to clean
    dryRun: false
  }
}
```

**Status**: ⏳ Not yet implemented

**Planned Process**:
1. Use `listAllObjectHashes()` to get all objects
2. Check object metadata for age/type
3. Delete objects matching criteria
4. Delete orphaned BLOBs
5. Compact version history

### 4. Storage Statistics (`storage:getStats`)

**Purpose**: Get detailed storage usage statistics

**Implementation**: Uses ONE.core storage list functions

**Returns**:
```typescript
{
  databases: [
    { name: "one-core#<instanceIdHash>", version: 1 }
  ],
  stores: {
    objects: {
      count: 1523,
      description: "All versioned and unversioned objects"
    },
    idHashes: {
      count: 342,
      description: "ID hashes for versioned objects"
    },
    rmaps: {
      count: 127,
      description: "Reverse maps for object lookups"
    }
  },
  quota: {
    total: 107374182400,    // ~100GB
    used: 52428800,         // ~50MB
    available: 107321753600,
    percentage: 0.05,
    persistent: true
  },
  total: 52428800
}
```

**Data Sources**:
- `listAllObjectHashes()` - Count of all stored objects
- `listAllIdHashes()` - Count of versioned object IDs
- `listAllReverseMapNames()` - Count of reverse map entries
- `indexedDB.databases()` - IndexedDB database list
- `quotaMonitor.getState()` - Quota information

## Key Differences from Electron/Node.js

### Electron (File System)
- Storage: File system (unlimited)
- Cleanup: Can delete individual files
- Stats: Directory sizes via fs.stat
- Persistence: Always persistent

### Browser (IndexedDB in Worker)
- Storage: IndexedDB (quota limited)
- Cleanup: Must use ONE.core APIs
- Stats: Must query IndexedDB stores
- Persistence: Must request from browser

## Technical Considerations

### 1. Worker Context

All storage operations run in Web Worker:
- ✅ No UI blocking during cleanup
- ✅ Can handle large operations
- ⚠️ Cannot directly access main thread storage
- ⚠️ Must use message passing

### 2. IndexedDB Limitations

- **Quota Management**: Browser enforces storage quotas
- **No Direct File Access**: All operations through IndexedDB API
- **Transaction-based**: All ops must be in transactions
- **Async Only**: No synchronous storage operations

### 3. Cleanup Considerations

**Complete Wipe**:
- Requires worker shutdown (releases IndexedDB handles)
- Deletes entire database via `indexedDB.deleteDatabase()`
- Worker must be restarted after wipe
- Fast and reliable for testing

**Selective Cleanup** (future):
- Must enumerate all objects
- Check metadata for each object
- Delete objects one by one
- More complex but preserves wanted data

## Usage Examples

### Test with Complete Wipe

```typescript
// From UI thread
const result = await workerClient.send('storage:cleanup', {
  options: {
    completeWipe: true,
    dryRun: false
  }
})

if (result.details.requiresRestart) {
  // Restart worker or reload app
  window.location.reload()
}
```

### Dry Run (Test Without Deleting)

```typescript
const result = await workerClient.send('storage:cleanup', {
  options: {
    completeWipe: true,
    dryRun: true  // Won't actually delete
  }
})

console.log(`Would free ${result.freedBytes} bytes`)
```

### Get Storage Stats

```typescript
const stats = await workerClient.send('storage:getStats', {})

console.log(`Total objects: ${stats.stores.objects.count}`)
console.log(`Storage used: ${stats.quota.used} bytes`)
console.log(`Storage available: ${stats.quota.available} bytes`)
```

### Monitor Quota

```typescript
const quota = await workerClient.send('storage:getQuota', {})

if (quota.percentage > 80) {
  console.warn('Storage is getting full!')

  // Request persistent storage
  const persistent = await workerClient.send('storage:requestPersistent', {})
  if (persistent.granted) {
    console.log('Persistent storage granted - data is protected')
  }
}
```

## Future Enhancements

### Selective Cleanup Implementation

```typescript
// Target implementation
async function selectiveCleanup(options: {
  olderThan?: number
  types?: string[]
}) {
  // 1. List all objects
  const allHashes = await listAllObjectHashes()

  // 2. Filter by criteria
  const toDelete = []
  for (const hash of allHashes) {
    const type = await getFileType(hash)
    const metadata = await getObjectMetadata(hash)

    if (shouldDelete(metadata, options)) {
      toDelete.push(hash)
    }
  }

  // 3. Delete filtered objects
  let freedBytes = 0
  for (const hash of toDelete) {
    const size = await fileSize(hash)
    await deleteObject(hash)
    freedBytes += size
  }

  return { freedBytes, itemsDeleted: toDelete.length }
}
```

### Automatic Cleanup Triggers

- Monitor quota automatically
- Clean up when reaching 80% quota
- Prioritize oldest messages first
- Keep recent data and important objects

### Compaction

- Compact version history (keep last N versions)
- Remove orphaned BLOBs
- Optimize IndexedDB stores

## References

- ONE.core Browser Storage: `@refinio/one.core/lib/system/browser/storage-base.ts`
- IndexedDB API: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- Storage Standard: https://storage.spec.whatwg.org/
- Implementation: `/worker/messages/storage.ts`
- Types: `/shared/types/worker-messages.ts` (StorageMessages namespace)
