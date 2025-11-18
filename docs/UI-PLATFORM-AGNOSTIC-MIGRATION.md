# UI Platform-Agnostic Migration (2025-01-12)

## Summary

Migrated platform-agnostic UI infrastructure from `lama.ui` to `lama.core/ui/` to enable code reuse across Web, Electron, and React Native (Expo) platforms.

## What Changed

### Files Moved: `lama.ui/src/` → `lama.core/ui/`

| What | From | To |
|------|------|-----|
| **Contexts** | `lama.ui/src/contexts/` | `lama.core/ui/contexts/` |
| **Types** | `lama.ui/src/types/` | `lama.core/ui/types/` |
| **Transport** | `lama.ui/src/transport/` | `lama.core/ui/transport/` |
| **Routing** | `lama.ui/src/routing/` | `lama.core/ui/routing/` |

### What Stayed in lama.ui (Web-Only)

```
lama.ui/src/
├── components/       # All UI components (shadcn/ui, Radix UI)
├── styles/           # CSS files (Tailwind, etc.)
├── hooks/            # React hooks using web APIs
└── lib/              # Web-specific utilities
```

**Reason:** These depend on DOM, CSS, or web-specific libraries (not compatible with React Native).

## Migration Guide

### For Component Developers

#### Before (lama.ui only)

```typescript
// Old imports (only worked in lama.ui)
import { usePlans } from '../contexts/PlansContext'
import type { LAMAPlans } from '../types/plans'
import type { LLMConfig } from '../types/llm'
```

#### After (cross-platform)

```typescript
// New imports (work in Web, Electron, React Native)
import { usePlans } from '@lama/core/ui/contexts/PlansContext'
import type { LAMAPlans } from '@lama/core/ui/types/plans'
import type { LLMConfig } from '@lama/core/ui/types/llm'
```

### For Platform Developers

#### lama.ui (Web) - No Changes Needed

lama.ui already re-exports from lama.core:

```typescript
// lama.ui/src/index.ts
export * from '@lama/core/ui/contexts/PlansContext'
export * from '@lama/core/ui/types/plans'
export * from '@lama/core/ui/types/llm'
export * from '@lama/core/ui/routing'
```

**Usage stays the same:**
```typescript
import { usePlans } from '@lama/ui'  // ✅ Still works!
```

#### lama.cube (Electron) - Use lama.core Directly

```typescript
// Electron renderer can now import directly
import { PlansProvider } from '@lama/core/ui/contexts/PlansContext'
import { IPCTransportAdapter } from '@lama/core/ui/transport/IPCTransportAdapter'
import type { LAMAPlans } from '@lama/core/ui/types/plans'

// Create Plans using IPC
const transport = new IPCTransportAdapter()
const plans: LAMAPlans = { /* ... */ }

<PlansProvider plans={plans}>
  <App />
</PlansProvider>
```

#### lama.native (React Native/Expo) - NEW Platform

```typescript
// Future React Native app
import { PlansProvider } from '@lama/core/ui/contexts/PlansContext'
import { HTTPTransportAdapter } from '@lama/core/ui/transport/HTTPTransportAdapter'
import type { LAMAPlans } from '@lama/core/ui/types/plans'

// Use HTTP transport or native bridge
const transport = new HTTPTransportAdapter({
  baseUrl: 'http://localhost:3000'
})

const plans: LAMAPlans = { /* ... */ }

<PlansProvider plans={plans}>
  <NativeApp />
</PlansProvider>
```

## Breaking Changes

### ✅ NO Breaking Changes for End Users

All existing lama.ui imports continue to work through re-exports.

### ⚠️ Internal Import Paths Changed

**Components using old paths must update:**

```diff
- import { usePlans } from '../contexts/PlansContext'
+ import { usePlans } from '@lama/core/ui/contexts/PlansContext'

- import type { LAMAPlans } from '../types/plans'
+ import type { LAMAPlans } from '@lama/core/ui/types/plans'

- import type { LLMConfig } from '../../types/llm'
+ import type { LLMConfig } from '@lama/core/ui/types/llm'
```

## Technical Details

### TransportAdapter Interface Change

**Before:** Different return types across adapters
```typescript
// IPCTransportAdapter returned Promise<T>
// HTTPTransportAdapter returned Promise<OperationResponse<T>>
// 😞 Inconsistent!
```

**After:** Consistent return type
```typescript
interface TransportAdapter {
  invoke<TRequest, TResponse>(
    operation: string,
    request: TRequest
  ): Promise<OperationResponse<TResponse>>  // ✅ Consistent!
}
```

**Benefits:**
- Structured error handling (no throwing exceptions)
- Consistent error codes across platforms
- Better error details and stack traces

### TypeScript Configuration

**lama.core/tsconfig.json:**
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",  // Added for .tsx support
    // ...
  },
  "include": [
    "ui/**/*.ts",
    "ui/**/*.tsx"  // Added
  ]
}
```

**lama.core/package.json:**
```json
{
  "exports": {
    "./ui/contexts/*": "./dist/ui/contexts/*",
    "./ui/types/*": "./dist/ui/types/*",
    "./ui/transport/*": "./dist/ui/transport/*",
    "./ui/routing/*": "./dist/ui/routing/*"
  },
  "peerDependencies": {
    "react": "^18.2.0"  // Added
  }
}
```

**lama.ui/tsconfig.json:**
```json
{
  "compilerOptions": {
    "paths": {
      "@lama/core/*": ["../lama.core/*"]  // Added
    }
  }
}
```

**lama.ui/package.json:**
```json
{
  "dependencies": {
    "@lama/core": "file:../lama.core"  // Added
  }
}
```

## Build Process

### lama.core

```bash
cd lama.core
npm run build   # Compiles plans/ AND ui/ to dist/
```

**Output:**
```
dist/
├── plans/       # Business logic
├── services/    # LLM services
├── models/      # Data models
└── ui/          # 🆕 UI infrastructure
    ├── contexts/
    ├── types/
    ├── transport/
    └── routing/
```

### lama.ui

```bash
cd lama.ui
npm run typecheck  # Type-checks components using @lama/core types
```

## Platform Compatibility Matrix

| Feature | Web | Electron | React Native | CLI |
|---------|-----|----------|--------------|-----|
| **PlansContext** | ✅ | ✅ | ✅ | N/A |
| **LAMAPlans types** | ✅ | ✅ | ✅ | ✅ |
| **HTTPTransportAdapter** | ✅ | ✅ | ✅ | ✅ |
| **IPCTransportAdapter** | ❌ | ✅ | ❌ | ❌ |
| **StdioTransportAdapter** | ❌ | ❌ | ❌ | ✅ |
| **Routing (Context)** | ✅ | ✅ | ✅ | N/A |
| **BrowserHistoryAdapter** | ✅ | ✅ | ❌ | N/A |
| **React Native Router** | ❌ | ❌ | 🔜 | N/A |

## Benefits

### 1. **Code Reuse Across Platforms**

```typescript
// Same code works in Web, Electron, React Native
function ChatView() {
  const { chat } = usePlans()
  const messages = await chat.getMessages({ topicId })
  return <MessageList messages={messages} />
}
```

### 2. **Type Safety Everywhere**

Single source of truth for TypeScript types:
- No duplicate type definitions
- Consistent Plan interfaces
- Compile-time validation across platforms

### 3. **Smaller Platform Packages**

Each platform imports only what it needs:
- Web apps bundle only HTTP transport
- Electron bundles only IPC transport
- React Native bundles only HTTP or native bridge

### 4. **Testable Without Platform**

Test UI logic without Electron/Web/RN environment:

```typescript
// Pure React testing - no DOM, no native modules
import { render } from '@testing-library/react'
import { PlansProvider } from '@lama/core/ui/contexts/PlansContext'

const mockPlans: LAMAPlans = { /* ... */ }

test('chat view renders messages', () => {
  render(
    <PlansProvider plans={mockPlans}>
      <ChatView topicId="test" />
    </PlansProvider>
  )
  // ...
})
```

### 5. **Future-Proof Architecture**

Ready for new platforms:
- React Native mobile apps
- VS Code extensions
- Tauri desktop apps
- CLI tools with TUI

## Rollout Plan

### Phase 1: lama.core Migration ✅ **COMPLETE**

- [x] Move contexts/ to lama.core/ui/contexts/
- [x] Move types/ to lama.core/ui/types/
- [x] Move transport/ to lama.core/ui/transport/
- [x] Move routing/ to lama.core/ui/routing/
- [x] Update lama.core exports and tsconfig
- [x] Fix transport adapter type consistency
- [x] Build and verify compilation

### Phase 2: lama.ui Integration ✅ **COMPLETE**

- [x] Add @lama/core dependency to lama.ui
- [x] Update lama.ui/src/index.ts to re-export
- [x] Update component imports (AuditTrailView, ChainOfTrustView, etc.)
- [x] Remove old directories from lama.ui
- [x] Verify typecheck passes

### Phase 3: lama.cube Adoption 🔜 **NEXT**

- [ ] Update Electron renderer to use @lama/core/ui imports
- [ ] Replace custom IPC types with TransportAdapter
- [ ] Verify IPC communication works with new OperationResponse format
- [ ] Update main process IPC handlers to return OperationResponse

### Phase 4: lama.native (Expo) 🔮 **FUTURE**

- [ ] Create lama.native package
- [ ] Implement React Native UI components
- [ ] Create ReactNativeRouterAdapter
- [ ] Test HTTP transport with backend server
- [ ] Consider native bridge transport for offline-first

## Documentation

- **Architecture Overview**: `lama.core/ui/README.md`
- **This Migration Guide**: `docs/UI-PLATFORM-AGNOSTIC-MIGRATION.md`
- **lama.core Guide**: `lama.core/CLAUDE.md`
- **Transport Adapters**: `lama.core/ui/transport/TransportAdapter.ts`
- **Plans Interface**: `lama.core/ui/types/plans.ts`

## FAQ

### Q: Do I need to update my lama.ui components?

**A:** No, if you're importing from `@lama/ui`. The package re-exports everything.

**Example:**
```typescript
import { usePlans } from '@lama/ui'  // ✅ Still works!
```

Only internal component imports need updating (from `../contexts/...` to `@lama/core/ui/...`).

### Q: Can I still use lama.ui components in Electron?

**A:** Yes! lama.ui components (shadcn/ui, etc.) work in Electron because Electron has a full browser environment.

### Q: Will React Native use the same UI components?

**A:** No. React Native needs different UI primitives (View, Text, Pressable instead of div, span, button). But it will use the same **infrastructure** (PlansContext, types, transport).

### Q: What about TypeScript types from ONE.core or chat.core?

**A:** Those remain in their respective packages. The lama.core/ui/ layer only contains **UI infrastructure types** (Plans interfaces, LLM config, routing).

### Q: Why OperationResponse instead of throwing errors?

**A:** Structured error handling is more predictable across platforms:
- Consistent error codes
- Better error details (stack, context)
- No try/catch boilerplate
- Works well with async/await

## Related Changes

This migration is part of the broader **unified Plans system** architecture:

1. **Platform-agnostic Plans** (lama.core, chat.core, connection.core)
2. **UI Infrastructure** (lama.core/ui - this migration)
3. **Platform Implementations** (lama.ui, lama.cube, lama.native)
4. **Transport Abstraction** (IPC, HTTP, native bridge)

See also:
- [Plans API Coverage](../specs/008-unified-plan-system/)
- [Pure Plan Architecture](./PURE-PLAN-ARCHITECTURE-REFACTORING.md)
- [UI Consolidation Strategy](./UI-CONSOLIDATION-STRATEGY.md)

## Contributors

- Migration executed: 2025-01-12
- Author: Claude Code
- Reviewer: [To be assigned]

---

**Status**: ✅ **Migration Complete - Ready for Expo Integration**
