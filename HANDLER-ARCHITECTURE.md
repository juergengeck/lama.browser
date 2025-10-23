# Handler Architecture - Transport-Agnostic Pattern

## Overview

LAMA uses a **transport-agnostic handler architecture** inspired by `refinio.api`. Business logic lives in pure TypeScript classes that can be used from **both Electron IPC and Web Worker** contexts.

## Directory Structure

```
lama.browser/
├── handlers/               # Pure business logic (NEW)
│   ├── OneCoreHandler.ts   # ONE.core operations
│   ├── ChatHandler.ts      # Chat operations
│   ├── AIHandler.ts        # AI operations
│   └── ...
│
├── main/ipc/handlers/      # Electron IPC adapters (THIN LAYER)
│   ├── one-core.ts         # Maps ipcMain.handle() → OneCoreHandler
│   ├── chat.ts             # Maps ipcMain.handle() → ChatHandler
│   └── ...
│
└── worker/messages/        # Worker message adapters (THIN LAYER)
    ├── one-core.ts         # Maps messageRegistry.register() → OneCoreHandler
    ├── chat.ts             # Maps messageRegistry.register() → ChatHandler
    └── ...
```

## Pattern

### 1. Pure Handler Class (`/handlers/OneCoreHandler.ts`)

```typescript
/**
 * OneCoreHandler - Pure business logic
 * No dependencies on Electron or Worker APIs
 */
export class OneCoreHandler {
  private leuteModel: LeuteModel;
  private channelManager: ChannelManager;

  constructor(leuteModel: LeuteModel, channelManager: ChannelManager) {
    this.leuteModel = leuteModel;
    this.channelManager = channelManager;
  }

  /**
   * Get contacts - pure business logic
   */
  async getContacts(request: GetContactsRequest): Promise<GetContactsResponse> {
    // Business logic only - no IPC, no worker messages
    const contacts = await this.leuteModel.getContacts();
    return { success: true, contacts };
  }
}

// Request/Response types
export interface GetContactsRequest {
  // Request parameters
}

export interface GetContactsResponse {
  success: boolean;
  contacts?: Contact[];
  error?: string;
}
```

### 2. Electron IPC Adapter (`/main/ipc/handlers/one-core.ts`)

```typescript
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { OneCoreHandler } from '../../../handlers/OneCoreHandler.js';
import nodeOneCore from '../../core/node-one-core.js';

// Create handler instance
const oneCoreHandler = new OneCoreHandler(
  nodeOneCore.leuteModel,
  nodeOneCore.channelManager
);

// Electron IPC registration (THIN ADAPTER)
export default {
  async getContacts(event: IpcMainInvokeEvent): Promise<any> {
    // Map IPC call → handler method
    const response = await oneCoreHandler.getContacts({});
    return response;
  }
};
```

### 3. Worker Message Adapter (`/worker/messages/one-core.ts`)

```typescript
import { messageRegistry } from '../message-registry.js';
import { OneCoreHandler } from '../../handlers/OneCoreHandler.js';
import workerOneCore from '../core/worker-one-core.js';

// Create handler instance
const oneCoreHandler = new OneCoreHandler(
  workerOneCore.leuteModel,
  workerOneCore.channelManager
);

// Worker message registration (THIN ADAPTER)
messageRegistry.register('onecore:getContacts', async (payload) => {
  // Map worker message → handler method
  const response = await oneCoreHandler.getContacts(payload);
  return response;
});
```

## Benefits

1. **Single Source of Truth**: Business logic written once, used in both platforms
2. **Testable**: Handlers can be unit tested without Electron or Worker setup
3. **Type Safe**: Request/Response types defined in handler, used by both adapters
4. **Maintainable**: Changes to business logic happen in one place
5. **Consistent**: Both platforms execute identical logic
6. **Portable**: Handlers can be used in future platforms (mobile, CLI, etc.)

## Migration Strategy

### Phase 1: Create Pure Handlers
1. Extract business logic from `/main/ipc/handlers/` into `/handlers/`
2. Remove all Electron dependencies (`IpcMainInvokeEvent`, `ipcMain`, etc.)
3. Define clear Request/Response interfaces
4. Export handler classes

### Phase 2: Update Electron Adapters
1. Keep existing `/main/ipc/handlers/` files as thin adapters
2. Import handler classes from `/handlers/`
3. Map IPC calls to handler methods
4. Return handler responses

### Phase 3: Create Worker Adapters
1. Create new `/worker/messages/` files
2. Import same handler classes from `/handlers/`
3. Map worker messages to handler methods
4. Return handler responses

## Example: OneCoreHandler

### Pure Handler
```typescript
// handlers/OneCoreHandler.ts
export class OneCoreHandler {
  async getContacts(req: GetContactsRequest): Promise<GetContactsResponse> {
    const contacts = await this.leuteModel.getContacts();
    return { success: true, contacts };
  }

  async createContact(req: CreateContactRequest): Promise<CreateContactResponse> {
    const contact = await this.leuteModel.createContact(req.email, req.name);
    return { success: true, contact };
  }
}
```

### Electron Adapter
```typescript
// main/ipc/handlers/one-core.ts
import { OneCoreHandler } from '../../../handlers/OneCoreHandler.js';

const handler = new OneCoreHandler(...models);

export default {
  getContacts: (event) => handler.getContacts({}),
  createContact: (event, params) => handler.createContact(params)
};
```

### Worker Adapter
```typescript
// worker/messages/one-core.ts
import { OneCoreHandler } from '../../handlers/OneCoreHandler.js';

const handler = new OneCoreHandler(...models);

messageRegistry.register('onecore:getContacts', () => handler.getContacts({}));
messageRegistry.register('onecore:createContact', (params) => handler.createContact(params));
```

## Handler Initialization

Handlers need ONE.core models (LeuteModel, ChannelManager, etc.). These are initialized differently per platform:

**Electron (Node.js)**:
```typescript
import nodeOneCore from '../../core/node-one-core.js';
const handler = new OneCoreHandler(
  nodeOneCore.leuteModel,
  nodeOneCore.channelManager
);
```

**Worker (Browser)**:
```typescript
import workerOneCore from '../core/worker-one-core.js';
const handler = new OneCoreHandler(
  workerOneCore.leuteModel,
  workerOneCore.channelManager
);
```

## Testing

Handlers can be unit tested without transport layer:

```typescript
import { OneCoreHandler } from '../handlers/OneCoreHandler';

test('getContacts returns contacts', async () => {
  const mockLeuteModel = createMockLeuteModel();
  const handler = new OneCoreHandler(mockLeuteModel, ...);

  const response = await handler.getContacts({});

  expect(response.success).toBe(true);
  expect(response.contacts).toHaveLength(2);
});
```

## Inspiration

This pattern is based on **refinio.api** (`/reference/refinio.api`), which uses the same architecture:
- Pure handler classes in `src/handlers/`
- QUIC transport adapter in `src/server/QuicVCServer.ts`
- HTTP REST adapter in `src/server/HttpRestServer.ts`

Both adapters use the same `ObjectHandler`, `ProfileHandler`, etc.
