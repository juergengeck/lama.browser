# Data Model: Browser Platform Migration

**Feature**: Browser Platform Migration
**Date**: 2025-10-18
**Status**: Design Phase

## Overview

This document describes the data entities and message protocols for the browser platform migration. The key architectural change is replacing Electron IPC with Web Worker message passing while maintaining the same ONE.core data structures.

## Core Entities

### 1. Worker Message Protocol

Messages passed between UI thread and Web Worker follow a request/response pattern.

#### WorkerRequest

```typescript
interface WorkerRequest<T = unknown> {
  id: string                    // UUID for correlation
  type: string                  // Message type (e.g., 'onecore:getContacts')
  payload: T                    // Type-specific payload
  timestamp: number             // Request timestamp
  transferables?: Transferable[] // Optional transferable objects
}
```

**Validation Rules**:
- `id` must be a valid UUID v4
- `type` must match registered handler pattern (namespace:action)
- `timestamp` must be within 5 minutes of current time (prevent replay)

**State Transitions**:
- Created → Sent → Acknowledged → Completed/Failed

#### WorkerResponse

```typescript
interface WorkerResponse<T = unknown> {
  id: string                    // Matches request ID
  success: boolean              // Operation result
  data?: T                      // Response data if successful
  error?: WorkerError           // Error details if failed
  timestamp: number             // Response timestamp
  transferables?: Transferable[] // Optional transferable objects
}

interface WorkerError {
  code: string                  // Error code (e.g., 'STORAGE_QUOTA_EXCEEDED')
  message: string               // Human-readable message
  details?: unknown             // Additional error context
  stack?: string                // Stack trace (dev mode only)
}
```

**Validation Rules**:
- `id` must match a pending request
- Either `data` or `error` must be present (XOR)
- `error.code` must match defined error codes

### 2. Browser Storage State

Represents the state of browser storage for quota monitoring.

#### StorageState

```typescript
interface StorageState {
  quota: number                 // Total quota in bytes
  usage: number                 // Current usage in bytes
  percentage: number            // Usage percentage (0-100)
  available: number             // Available bytes
  persistent: boolean           // Is storage persistent?
  lastChecked: number           // Timestamp of last check
  warnings: StorageWarning[]    // Active warnings
}

enum StorageWarningLevel {
  INFO = 'info',               // <80% usage
  WARNING = 'warning',         // 80-95% usage
  CRITICAL = 'critical'        // >95% usage
}

interface StorageWarning {
  level: StorageWarningLevel
  message: string
  threshold: number             // Percentage that triggered warning
  timestamp: number
}
```

**State Transitions**:
- Normal (<80%) → Warning (80-95%) → Critical (>95%)
- Critical can transition to Warning or Normal after cleanup

**Validation Rules**:
- `percentage` must be between 0-100
- `usage` must not exceed `quota`
- `available` must equal `quota - usage`

### 3. Worker Initialization State

Tracks the Web Worker initialization progress.

#### WorkerInitState

```typescript
enum WorkerInitPhase {
  NOT_STARTED = 'not_started',
  LOADING = 'loading',           // Worker script loading
  INITIALIZING = 'initializing', // ONE.core initialization
  READY = 'ready',               // Ready for requests
  ERROR = 'error'                // Failed initialization
}

interface WorkerInitState {
  phase: WorkerInitPhase
  progress?: number              // 0-100 for long operations
  message?: string               // Current operation description
  error?: WorkerError            // Error if phase is ERROR
  startTime: number              // Initialization start timestamp
  readyTime?: number             // Timestamp when ready
}
```

**State Transitions**:
```
NOT_STARTED → LOADING → INITIALIZING → READY
              ↓         ↓             ↓
            ERROR ←───────────────────┘
```

**Validation Rules**:
- State can only move forward (except to ERROR)
- `readyTime` only set when `phase` is READY
- `error` only set when `phase` is ERROR
- `progress` only valid during INITIALIZING phase

### 4. Message Handler Registry

Internal data structure for routing messages to handlers in the worker.

#### HandlerRegistration

```typescript
type MessageHandler<TReq = unknown, TRes = unknown> = (
  payload: TReq,
  context: HandlerContext
) => Promise<TRes>

interface HandlerRegistration {
  type: string                  // Message type (e.g., 'onecore:getContacts')
  handler: MessageHandler       // Handler function
  timeout?: number              // Optional timeout in ms (default: 30000)
  validator?: (payload: unknown) => boolean // Payload validation
}

interface HandlerContext {
  requestId: string             // Request ID for logging
  timestamp: number             // Request timestamp
  oneCore: OneCoreInstance      // Access to ONE.core instance
  services: ServiceRegistry     // Access to services (LLM, MCP, etc.)
}
```

**Validation Rules**:
- `type` must be unique in registry
- `timeout` must be between 1000-300000ms (1s-5min)
- `handler` must return a Promise

## ONE.core Data Structures

These structures remain unchanged from the Electron version - only the storage backend changes from Node.js filesystem to IndexedDB.

### 5. Message (ONE.core Versioned Object)

```typescript
interface Message {
  $type$: 'Message'
  id: string                    // isId: true
  topic: SHA256IdHash<Topic>    // Topic reference
  author: SHA256IdHash<Person>  // Author reference
  content: string               // Message text
  timestamp: number             // Creation timestamp
  attachments?: SHA256Hash<BLOB>[] // Optional file attachments
  replyTo?: SHA256Hash<Message> // Optional reply reference
}
```

**Storage**: IndexedDB OBJECTS store via ONE.core browser storage
**Versioning**: Automatic via ONE.core (version nodes in VHEADS store)

### 6. Topic (ONE.core Versioned Object)

```typescript
interface Topic {
  $type$: 'Topic'
  id: string                    // isId: true
  name: string
  participants: SHA256IdHash<Person>[]
  createdBy: SHA256IdHash<Person>
  created: number
  lastActivity: number
}
```

### 7. Person (ONE.core Versioned Object)

```typescript
interface Person {
  $type$: 'Person'
  email: string                 // isId: true
  name: string
  publicKey: CryptoKey
  profileImage?: SHA256Hash<BLOB>
}
```

### 8. Contact (ONE.core Versioned Object)

```typescript
interface Contact {
  $type$: 'Contact'
  id: string                    // isId: true
  person: SHA256IdHash<Person>
  displayName?: string          // Optional override
  groups: string[]              // Contact groups
  metadata: Record<string, unknown>
}
```

## Message Types & Handlers

### Core Operations

#### `onecore:initialize`
**Request**: `{ credentials: { email: string, password: string } }`
**Response**: `{ success: boolean, personId: SHA256IdHash<Person> }`
**Purpose**: Initialize ONE.core instance in worker

#### `onecore:getStatus`
**Request**: `{}`
**Response**: `{ initialized: boolean, personId?: string, storageState: StorageState }`
**Purpose**: Check worker/ONE.core status

#### `onecore:getContacts`
**Request**: `{}`
**Response**: `{ contacts: Contact[] }`
**Purpose**: Retrieve all contacts

#### `onecore:createContact`
**Request**: `{ email: string, name: string, publicKey: string }`
**Response**: `{ contact: Contact, idHash: SHA256IdHash<Contact> }`
**Purpose**: Create new contact

### Chat Operations

#### `chat:getTopics`
**Request**: `{}`
**Response**: `{ topics: Topic[] }`
**Purpose**: Retrieve all conversation topics

#### `chat:getMessages`
**Request**: `{ topicId: string, limit?: number, before?: number }`
**Response**: `{ messages: Message[], hasMore: boolean }`
**Purpose**: Retrieve messages for a topic

#### `chat:sendMessage`
**Request**: `{ topicId: string, content: string, attachments?: ArrayBuffer[] }`
**Response**: `{ message: Message, messageHash: SHA256Hash<Message> }`
**Purpose**: Send a message in a conversation
**Transferables**: `attachments` (if present)

#### `chat:createTopic`
**Request**: `{ name: string, participantIds: string[] }`
**Response**: `{ topic: Topic, topicIdHash: SHA256IdHash<Topic> }`
**Purpose**: Create new conversation topic

### AI Operations

#### `ai:chat`
**Request**: `{ messages: AIMessage[], model?: string, stream?: boolean }`
**Response**: `{ response: string, analysis?: TopicAnalysis }`
**Purpose**: Send messages to AI assistant

#### `ai:getModels`
**Request**: `{}`
**Response**: `{ models: LLMInfo[] }`
**Purpose**: List available AI models

### Topic Analysis Operations

#### `topicAnalysis:analyzeMessages`
**Request**: `{ topicId: string, messageIds: string[] }`
**Response**: `{ subjects: Subject[], keywords: Keyword[] }`
**Purpose**: Extract subjects and keywords from messages

#### `topicAnalysis:getSummary`
**Request**: `{ topicId: string, version?: number }`
**Response**: `{ summary: Summary }`
**Purpose**: Get topic summary

### Proposal Operations

#### `proposals:getForTopic`
**Request**: `{ topicId: string }`
**Response**: `{ proposals: Proposal[] }`
**Purpose**: Get ranked proposals for current topic

#### `proposals:dismiss`
**Request**: `{ topicId: string, pastSubjectIdHash: SHA256IdHash<Subject> }`
**Response**: `{ success: boolean }`
**Purpose**: Dismiss a proposal for current session

### Storage Operations

#### `storage:getQuota`
**Request**: `{}`
**Response**: `{ state: StorageState }`
**Purpose**: Get current storage quota state

#### `storage:requestPersistent`
**Request**: `{}`
**Response**: `{ granted: boolean }`
**Purpose**: Request persistent storage permission

#### `storage:cleanup`
**Request**: `{ olderThan?: number, types?: string[] }`
**Response**: `{ freedBytes: number, deletedObjects: number }`
**Purpose**: Clean up old data to free space

## Error Codes

Standard error codes across all operations:

- `WORKER_NOT_INITIALIZED`: Worker not ready for requests
- `ONECORE_NOT_INITIALIZED`: ONE.core instance not initialized
- `STORAGE_QUOTA_EXCEEDED`: Browser storage quota exceeded
- `INVALID_PAYLOAD`: Request payload validation failed
- `HANDLER_TIMEOUT`: Operation exceeded timeout limit
- `HANDLER_NOT_FOUND`: No handler registered for message type
- `OPERATION_FAILED`: Generic operation failure (see error.details)
- `NETWORK_ERROR`: Network operation failed (WebSocket, commserver)
- `PERMISSION_DENIED`: User denied required permission
- `UNSUPPORTED_BROWSER`: Browser lacks required capabilities

## Relationships

```
UI Thread
    ↓ WorkerRequest
Worker Thread
    ↓ MessageHandler
ONE.core Browser Storage (IndexedDB)
    ├── OBJECTS store
    │   ├── Message (versioned)
    │   ├── Topic (versioned)
    │   ├── Person (versioned)
    │   └── Contact (versioned)
    ├── VHEADS store (version nodes)
    ├── RMAPS store (reverse maps)
    └── PRIVATE store (encrypted data)
```

## Performance Considerations

1. **Message Payload Size**: Keep under 10KB for optimal performance
2. **Transferables**: Use for large binary data (>1MB) - 45x faster
3. **Batch Operations**: Group related operations to reduce message overhead
4. **Caching**: UI thread maintains cache of frequently accessed data
5. **IndexedDB Transactions**: Use relaxed durability for non-critical writes

## Migration Notes

### From Electron IPC
- Replace `ipcRenderer.invoke()` → `workerClient.send()`
- Replace `ipcMain.handle()` → `registerHandler()`
- Same payload structures where possible for minimal code changes
- Error handling structure maintained

### Data Compatibility
- ONE.core objects remain identical (same recipes, same versioning)
- Storage backend changes: Node.js filesystem → IndexedDB
- No data migration needed if starting fresh
- For migrating existing Electron data: export/import tool required (out of scope)
