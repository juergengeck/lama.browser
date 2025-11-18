# Architecture Summary

Quick reference for LAMA architecture principles.

## Core Principles

### 1. Platform-Agnostic Core

All `*.core/` libraries are platform-agnostic with dependency injection:

```typescript
// ✅ Core library
export class ChatPlan {
  constructor(private nodeOneCore: any, private stateManager?: any) {}
  async sendMessage(params) { /* business logic */ }
}

// ✅ Platform creates instances
const chatPlan = new ChatPlan(nodeOneCore, stateManager);
```

**Never** import platform-specific code in core libraries.

### 2. Build-Time vs Runtime Dependencies

Core libraries use `@refinio/one.core` at **build-time only**. Platforms provide instances at **runtime**.

### 3. Terminology: "Plans" not "Handlers"

- Class names: `ChatPlan`, `ContactsPlan`
- File names: `ChatPlan.ts`, `ContactsPlan.ts`
- Directory: `plans/` (not `handlers/`)

Exception: `lama.core` still uses "Handler" terminology.

### 4. No Fallbacks - Fail Fast

- If operation fails, throw immediately
- Fix root cause, don't work around it
- No retry loops without understanding
- No artificial delays

### 5. ONE.core Helpers First

- Use `one.helpers` instead of reimplementing
- Use branded types: `SHA256Hash<T>`, `SHA256IdHash<T>`
- Follow ONE.core patterns

## Architecture Patterns

### Channel Architecture

**P2P (2 participants)**:
- Single shared channel
- Channel owner: `null`
- Person-based access

**Group (3+ participants)**:
- One channel per participant
- Each owns their channel
- Group-based access

### Transport Layers

```
Application:  [CHUM Sync Protocol]
                     |
Protocol:     [ConnectionsModel]
                     |
              ---------------
              |             |
Transport:  [QUIC]    [WebSocket]
          (future)     (current)
```

### IPC Pattern (Electron)

```typescript
// lama.cube/main/ipc/plans/chat.ts
import { ChatPlan } from '@lama/core/plans/ChatPlan.js';
const plan = new ChatPlan(nodeOneCore, stateManager);

export const chatPlans = {
  async sendMessage(event, params) {
    return await plan.sendMessage(params);  // Fail fast
  }
};
```

## Repository Structure

```
lama/
├── *.core/              # Platform-agnostic business logic
├── lama.*/              # Platform implementations
├── connection.*/        # Transport implementations
├── packages/            # Shared dependencies
├── test/                # Integration tests
└── specs/               # Feature specifications
```

## Version Synchronization

All projects use synchronized ONE.core/ONE.models versions. Update in order:
1. `packages/one.core` and `packages/one.models`
2. All `*.core/packages/`
3. Platform implementations
4. Test in lama.cube first (canary)

## Related Documentation

- Full architecture: `ARCHITECTURE.md`
- ONE.core recipes: `docs/RECIPES.md`
- Testing: `docs/TESTING.md`
- Configuration: `docs/config-quickstart.md`
