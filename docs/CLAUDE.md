# CLAUDE.md

Quick reference for working with the LAMA codebase. See `docs/` for detailed documentation.

## Overview

**LAMA** (Local AI Messaging Assistant) is a platform-agnostic P2P messaging system built on ONE.core. Monorepo with platform-agnostic core libraries and platform-specific implementations.

## Repository Structure

```
lama/
├── *.core/              # Platform-agnostic business logic
│   ├── lama.core/       # AI services, LLM integration
│   ├── chat.core/       # Chat/messaging plans
│   ├── connection.core/ # P2P connection management
│   └── mcp.core/        # Model Context Protocol
├── lama.*/              # Platform implementations
│   ├── lama.cube/       # Electron (Node.js)
│   ├── lama.browser/    # Browser/web
│   └── lama.ui/         # Shared UI components
├── packages/            # ONE.core, ONE.models
├── test/                # Integration tests
├── specs/               # Feature specifications
└── docs/                # Detailed documentation
```

## Essential Commands

```bash
# Root - Integration tests
pnpm test

# *.core/ - Build platform-agnostic libraries
pnpm build          # TypeScript → JavaScript (in-place)
pnpm watch          # Watch mode

# lama.cube (Electron)
pnpm electron       # Run app
pnpm build:all      # Build main + UI
pnpm dist           # Create installer
```

## Core Principles

1. **Platform-Agnostic Core**: `*.core/` uses dependency injection, no platform-specific imports
2. **Plans not Handlers**: `ChatPlan`, `ContactsPlan` (except legacy `lama.core`)
3. **No Fallbacks**: Fail fast and throw - fix problems, don't mitigate
4. **ONE.core Helpers First**: Use `one.helpers`, branded types (`SHA256Hash<T>`, `SHA256IdHash<T>`)
5. **Build vs Runtime**: Core imports ONE.core at build-time, platforms provide instances at runtime

## Quick Patterns

### Platform-Agnostic Core

```typescript
// ✅ Core library with dependency injection
export class ChatPlan {
  constructor(private nodeOneCore: any) {}
  async sendMessage(params) { /* business logic */ }
}

// ✅ Platform instantiates
const plan = new ChatPlan(nodeOneCore);
```

### IPC Pattern (Electron)

```typescript
// lama.cube/main/ipc/plans/chat.ts
import { ChatPlan } from '@lama/core/plans/ChatPlan.js';
const plan = new ChatPlan(nodeOneCore);
export const chatPlans = {
  async sendMessage(event, params) {
    return await plan.sendMessage(params);  // Fail fast
  }
};
```

### Creating Versioned Objects

```typescript
// 1. Define + extend type system
interface Subject { $type$: 'Subject'; id: string; }
declare module '@OneObjectInterfaces' {
  export interface OneVersionedObjectInterfaces { Subject: Subject; }
}

// 2. Create recipe with isId: true
const recipe = { $type$: 'Recipe', name: 'Subject', rule: [{ itemprop: 'id', isId: true }] };
await registerRecipes([recipe]);

// 3. Store then post
await storeVersionedObject(subject);
await channelManager.postToChannel(topicId, subject);
```

## Channel Architecture

**P2P (2 participants)**: Single shared channel, person-based access
**Group (3+)**: One channel per participant, group-based access

## Version Sync

Update order: `packages/` → `*.core/packages/` → platforms → test in lama.cube

Versions:
```
@refinio/one.core:   0.6.1-beta-3
@refinio/one.models: 14.1.0-beta-5
```

## Common Pitfalls

1. Missing `rules: []` in recipe arrays → crashes
2. `postToChannel()` without `storeVersionedObject()` first → not synced
3. Hash type confusion → `SHA256Hash` ≠ `SHA256IdHash`
4. Platform code in `*.core/` → breaks platform-agnostic design
5. Fallbacks/mitigations → violates "fail fast" principle

## Documentation

- **Architecture**: `docs/ARCHITECTURE-SUMMARY.md`, `ARCHITECTURE.md`
- **Recipes**: `docs/RECIPES.md`, `docs/one-core-fundamentals.md`
- **Testing**: `docs/TESTING.md`
- **Config**: `docs/config-quickstart.md`, `docs/config-platform-support.md`
- **Platform-specific**: `lama.cube/CLAUDE.md`, `*.core/CLAUDE.md`
- **Features**: `specs/*/spec.md`, `specs/*/quickstart.md`

## Key Technologies

- **ONE.core**: Content-addressed storage, SHA-256 hashes, versioned objects
- **CHUM**: Transport-agnostic sync protocol
- **LLM**: Multi-provider (Ollama, Claude, LM Studio), streaming, pre-warming
- **P2P**: WebSocket (CommServer relay), future QUIC/QuicVC
- **MCP**: Model Context Protocol for tool integration
