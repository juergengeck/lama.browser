# Plan-Based Architecture

## Overview

LAMA uses a **plan-based architecture** where business logic lives in platform-agnostic plan modules, and platform-specific code provides dependency implementations.

## The Three Layers

### 1. lama.ui - Pure UI Components

**Role**: Platform-agnostic UI components (React, TypeScript)

**What it contains**:
- React components
- UI state management
- Styling and layout
- Type definitions for UI props

**What it does NOT contain**:
- Transport layers
- Data fetching logic
- ONE.core integration
- Platform-specific code

**Key Principle**: Components receive data and callbacks as props. They don't fetch data themselves.

```typescript
// ✅ CORRECT - Component receives data as props
interface MessageViewProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
}

export function MessageView({ messages, onSendMessage }: MessageViewProps) {
  // Pure UI logic
}

// ❌ WRONG - Component fetches data itself
export function MessageView() {
  const client = useLamaClient(); // NO! This shouldn't exist
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    client.getMessages(); // NO! Platform-specific logic
  }, []);
}
```

### 2. lama.browser - Direct Plan Usage

**Role**: Browser platform implementation

**Architecture**:
- Plans run directly in browser context
- ONE.core runs in browser (IndexedDB storage)
- No IPC needed - direct function calls

**Pattern**:
```typescript
// connection-setup.ts
import { ConnectionPlan } from '@lama/connection.core';
import { BrowserStorage } from './BrowserStorage';
import { BrowserTransport } from './BrowserTransport';

// Create plan with browser-specific dependencies
const connectionPlan = new ConnectionPlan(
  browserOneCore,
  new BrowserStorage(),   // IndexedDB implementation
  new BrowserTransport()  // WebRTC implementation
);

// Use plan directly
const instances = await connectionPlan.getInstances({});
```

**UI Integration**:
```typescript
// In browser app
const [connections, setConnections] = useState([]);

useEffect(() => {
  // Direct plan access - no IPC
  connectionPlan.getInstances({}).then(setConnections);
}, []);

// Render lama.ui components with data
return <ConnectionList connections={connections} />;
```

### 3. lama.cube - IPC Adapters to Plans

**Role**: Electron platform implementation

**Architecture**:
- **Main Process**: Runs ONE.core with Node.js (file system storage)
- **Renderer Process**: UI only, no ONE.core access
- **IPC Layer**: Thin adapters that expose plan methods via Electron IPC

**Main Process (Node.js)**:
```typescript
// main/ipc/plans/connection.ts
import { ConnectionPlan } from '@lama/connection.core';
import { NodeStorage } from './NodeStorage';
import nodeOneCore from '../../core/node-one-core.js';

// Create plan with Node.js dependencies
const connectionPlan = new ConnectionPlan(
  nodeOneCore,
  new NodeStorage(),  // File system implementation
  webUrl
);

// Export IPC handlers (thin wrappers)
export default {
  async getInstances(event: IpcMainInvokeEvent) {
    const result = await connectionPlan.getInstances({});
    return result.instances;
  },

  async createPairingInvitation(event: IpcMainInvokeEvent, mode?: 'IoM' | 'IoP') {
    return await connectionPlan.createPairingInvitation({ mode, webUrl });
  }
};
```

**Renderer Process (Browser)**:
```typescript
// electron-ui/src/hooks/useConnections.ts
import { useState, useEffect } from 'react';

export function useConnections() {
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    // IPC call to main process
    window.electronAPI.invoke('connection:getInstances')
      .then(setConnections);
  }, []);

  return connections;
}

// In component
function ConnectionsPage() {
  const connections = useConnections();

  // Render lama.ui component with data
  return <ConnectionList connections={connections} />;
}
```

## Key Patterns

### Plan Structure

Plans are platform-agnostic business logic modules that accept dependencies via constructor injection:

```typescript
// @lama/connection.core
export class ConnectionPlan {
  constructor(
    private oneCore: OneCoreInstance,
    private storage: StorageProvider,
    private webUrl?: string
  ) {}

  async getInstances(params: {}): Promise<{ instances: Instance[] }> {
    // Business logic using injected dependencies
    const instances = await this.oneCore.connectionsModel.getInstances();
    return { instances };
  }
}
```

### Platform-Specific Dependencies

Each platform provides implementations of required interfaces:

**Browser**:
```typescript
class BrowserStorage implements StorageProvider {
  async getNodeStorage() {
    // IndexedDB implementation
  }
}
```

**Node.js**:
```typescript
class NodeStorage implements StorageProvider {
  async getNodeStorage() {
    // File system implementation
  }
}
```

### Component Data Flow

```
Platform Layer              Plan Layer                UI Layer
─────────────────          ──────────────           ──────────
lama.browser:
  [Browser Plans] ────────> [Business Logic] ───┐
        ↓                                        │
  [React Hooks]                                  ├──> [lama.ui Components]
        ↓                                        │
  [State Management]                             │
                                                 │
lama.cube:                                       │
  [Main: Node Plans] ───> [Business Logic] ───┐ │
        ↓                                      │ │
  [IPC Handlers]                               │ │
        ↓                                      │ │
  [Renderer: IPC Calls]                        ├─┘
        ↓                                      │
  [React Hooks] ──────────────────────────────┘
        ↓
  [State Management]
```

## Migration Guide

### Removing Transport Abstractions from lama.ui

**Wrong Pattern (to be removed)**:
```typescript
// ❌ lama.ui/src/transport/TransportAdapter.ts
export interface TransportAdapter {
  getMessages(): Promise<Message[]>;
}

// ❌ lama.ui/src/hooks/useLamaClient.ts
export function useLamaClient() {
  return useContext(TransportContext);
}

// ❌ lama.ui/src/components/MessageView.tsx
export function MessageView() {
  const client = useLamaClient();
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    client.getMessages().then(setMessages);
  }, []);
}
```

**Correct Pattern**:
```typescript
// ✅ lama.ui/src/components/MessageView.tsx
interface MessageViewProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
}

export function MessageView({ messages, onSendMessage }: MessageViewProps) {
  // Pure UI - no data fetching
}

// ✅ lama.browser/browser-ui/src/App.tsx
function App() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Direct plan access
    chatPlan.getMessages({}).then(setMessages);
  }, []);

  const handleSend = (content: string) => {
    chatPlan.sendMessage({ content });
  };

  return <MessageView messages={messages} onSendMessage={handleSend} />;
}

// ✅ lama.cube/electron-ui/src/App.tsx
function App() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // IPC to main process
    window.electronAPI.invoke('chat:getMessages').then(setMessages);
  }, []);

  const handleSend = (content: string) => {
    window.electronAPI.invoke('chat:sendMessage', { content });
  };

  return <MessageView messages={messages} onSendMessage={handleSend} />;
}
```

## Principles

1. **lama.ui is pure UI** - No transport, no data fetching, no platform code
2. **Plans are platform-agnostic** - Accept dependencies via constructor
3. **Platforms provide implementations** - Browser uses IndexedDB, Node uses fs
4. **IPC is thin** - Just expose plan methods, no business logic
5. **Components receive props** - Data and callbacks come from parent
6. **No transport abstractions** - Each platform wires up plans directly

## Benefits

- **Reusability**: UI components work on any platform
- **Testability**: Plans can be tested with mock dependencies
- **Simplicity**: No complex transport abstraction layer
- **Performance**: Direct plan access in browser, no IPC overhead
- **Type Safety**: Full TypeScript support with proper types
- **Maintainability**: Business logic in one place (plans)
