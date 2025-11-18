# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**lama.app** is a React Native mobile application built with Expo 54 implementing the unified plan-based architecture. It runs **real business logic** from `*.core` packages directly in React Native using `one.core.expo` (React Native compatible ONE.core).

This is the **production mobile app** that replaces the legacy `../lama/` app. The UI has been fully migrated from the legacy app with a compatibility layer to work seamlessly with the plan-based architecture.

**Current Status**: Production-ready with full UI migration complete. Runs real business logic and ONE.core natively in React Native.

## Quick Start

```bash
# Install dependencies (references parent monorepo packages)
npm install

# Start Expo development server
npm start

# Start with cleared cache
npm run start:clear

# Run on platforms
npm run ios       # iOS simulator/device
npm run android   # Android emulator/device
npm run web       # Web browser

# Generate native projects (if needed)
npm run prebuild        # Generate iOS/Android folders
npm run prebuild:clean  # Clean and regenerate
```

## Technology Stack

- **Expo SDK**: 54.0.23
- **React**: 19.1.0
- **React Native**: 0.81.5 with New Architecture enabled
- **TypeScript**: 5.9.2
- **Expo Router**: 6.x (file-based routing with tabs)
- **ONE.core**: 0.6.1-beta-3 (via one.core.expo - React Native compatible)
- **Business Logic**: Real plans from chat.core, lama.core, connection.core
- **UI**: Full migration from legacy ../lama app

## Architecture

### Layered Plan-Based System

```
┌─────────────────────────────────────────────────────┐
│ UI Layer (React Native Components)                  │
│ - Legacy components from ../lama/src/components/    │
│ - Tab navigation: Home, Messages, Journal, Devices  │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│ Compatibility Layer                                  │
│ - useInstance() hook                                 │
│ - Translates legacy API to plan-based calls         │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│ Client Layer                                         │
│ - useLamaClient() hook                              │
│ - Type-safe operation invocation                    │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│ Transport Layer                                      │
│ - PlanTransportAdapter                              │
│ - Routes operations to plans                        │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│ Business Logic Layer                                 │
│ - ChatPlan, ContactsPlan (from *.core packages)     │
│ - Platform-agnostic business logic                  │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│ Data Layer                                           │
│ - ONE.core (via one.core.expo)                      │
│ - expo-file-system, expo-crypto, async-storage      │
└─────────────────────────────────────────────────────┘
```

### How It Works

**Key Insight**: We use `one.core.expo` which replaces Node.js APIs with React Native equivalents:
- `fs` → `expo-file-system`
- `crypto` → `expo-crypto`
- `localStorage` → `@react-native-async-storage/async-storage`

This allows the same `*.core` packages to run across Electron, browser, and mobile platforms.

### Transport Adapter

**PlanTransportAdapter** (production):
- Runs business logic from `*.core` packages
- Uses `one.core.expo` for React Native compatibility
- Real data persistence and synchronization
- Initializes ONE.core on startup

## Project Structure

```
lama.app/
├── app/                        # Expo Router pages
│   ├── _layout.tsx            # Root layout with TransportProvider
│   ├── index.tsx              # Entry point (redirects to tabs)
│   ├── (tabs)/                # Tab navigation
│   │   ├── _layout.tsx        # Tab bar configuration
│   │   ├── home.tsx           # Home screen (topics, journal)
│   │   ├── messages.tsx       # Messages/chat list
│   │   ├── journal.tsx        # Journal screen
│   │   └── contacts.tsx       # Devices/contacts
│   └── (screens)/             # Modal screens (settings, etc.)
│
├── src/
│   ├── components/            # UI components (migrated from legacy)
│   │   ├── chat/              # Chat UI (Chat, MessageList, InputToolbar)
│   │   │   ├── Chat.tsx       # Main chat component
│   │   │   ├── MessageList.tsx
│   │   │   ├── InputToolbar.tsx
│   │   │   ├── ChatHeader.tsx
│   │   │   └── TopicList.tsx
│   │   ├── home/              # Home screen components
│   │   │   ├── JournalCard.tsx
│   │   │   └── TopicsCard.tsx
│   │   └── contacts/          # Contact management components
│   │
│   ├── hooks/                 # Custom hooks
│   │   ├── useLamaClient.tsx  # Plan-based client hook (NEW)
│   │   └── useInstance.tsx    # Legacy compatibility hook
│   │
│   └── transport/             # Transport adapter
│       ├── TransportAdapter.ts        # Interface
│       └── PlanTransportAdapter.ts    # Plans adapter
│
├── babel.config.js            # Babel configuration with path aliases
├── tsconfig.json              # TypeScript configuration
└── app.json                   # Expo configuration
```

## Configuration

### TypeScript Path Aliases

Configured in both `tsconfig.json` and `babel.config.js`:

```typescript
// App code
import { useLamaClient } from '@hooks/useLamaClient';
import { useInstance } from '@hooks/useInstance';  // Legacy compatibility
import { PlanTransportAdapter } from '@transport/PlanTransportAdapter';

// Parent monorepo packages (via path aliases)
import { ChatPlan } from '@chat/core/plans/ChatPlan';
import { createDefaultInstance } from '@refinio/one.core/lib/instance';
import type { SHA256Hash } from '@refinio/one.core/lib/util/type-checks';
import type { ConnectionPlan } from '@lama/connection.core/plans/ConnectionPlan';

// Components
import { Chat } from '@components/chat/Chat';
import { TopicList } from '@components/chat/TopicList';
```

### Navigation Structure

The app uses Expo Router with tab-based navigation:

```
/ (index) → redirects to /(tabs)/home

/(tabs)/
  ├── home       - Home screen (topics overview, journal)
  ├── messages   - Messages/chat list (TopicList)
  ├── journal    - Journal screen
  └── contacts   - Devices and contacts

/(screens)/      - Modal screens
  ├── settings   - App settings
  ├── topics/[id] - Individual chat/topic
  └── ...
```

### React Native New Architecture

This app has `"newArchEnabled": true` in app.json, enabling:
- Fabric renderer (new UI layer)
- TurboModules (new native modules system)
- Concurrent rendering features

## Migration from Legacy App

### What Was Migrated

1. **UI Components** (from `../lama/src/components/`):
   - Chat components: Chat.tsx, MessageList, InputToolbar, ChatHeader, TopicList
   - Home components: JournalCard, TopicsCard
   - Contact components: Full contact management UI

2. **Screens** (from `../lama/app/(tabs)/`):
   - Tab-based navigation structure
   - Home, Messages, Journal, Contacts screens

3. **Compatibility Layer**:
   - `useInstance()` hook provides backwards compatibility
   - Translates legacy model API to plan-based API

### Compatibility Hooks

The `useInstance()` hook bridges legacy component API to new plan-based architecture:

```typescript
// Legacy components use this pattern:
const { models } = useInstance();
await models.topicModel.sendMessage(topicId, content);

// The hook translates to:
const client = useLamaClient();
await client.chat.sendMessage({ topicId, content });
```

**Implementation**:
```typescript
// src/hooks/useInstance.tsx
export function useInstance() {
  const client = useLamaClient();

  return {
    instance: { currentState: 'running' },
    models: {
      topicModel: {
        sendMessage: (topicId, content) =>
          client.chat.sendMessage({ topicId, content }),
        getHistory: (topicId, limit) =>
          client.chat.getHistory({ topicId, limit })
      },
      leuteModel: {
        getContacts: () => client.contacts.list()
      }
    },
    isAuthenticated: true,
    authState: 'authenticated'
  };
}
```

This allows gradual migration of components without rewriting everything at once.

### Key Differences from Legacy App

| Aspect | Legacy `../lama` | New `lama.app` (this) |
|--------|------------------|------------------------|
| **Business Logic** | Direct ONE.models access | Plan-based via PlanTransportAdapter |
| **Data Access** | ChatModel, TopicModel instances | useLamaClient() hook |
| **Storage** | one.core (Node.js based) | one.core.expo (React Native) |
| **Initialization** | Complex 3-phase setup | Simple adapter initialization |
| **Models** | Direct model instances | Virtual models via compatibility layer |
| **Architecture** | Tightly coupled | Loosely coupled via plans |

## Plan Operations

### Available Operations

| Domain | Method | Request | Response |
|--------|--------|---------|----------|
| `chat` | `sendMessage` | `{ topicId, content, attachments? }` | `{ messageId, timestamp }` |
| `chat` | `getHistory` | `{ topicId, limit?, before? }` | `{ messages, hasMore, nextCursor? }` |
| `chat` | `exportHistory` | `{ topicId, format }` | `{ data, filename }` |
| `contacts` | `list` | `{}` | `{ contacts }` |

These are real operations from `@chat/core` plans.

### Adding New Operations

1. **Add plan method** in appropriate `*.core` package (e.g., `chat.core`)
2. **Route in adapter** (`src/transport/PlanTransportAdapter.ts`):
   ```typescript
   case 'myDomain':
     return await this.invokeMyDomainPlan(method, request);
   ```

3. **Add to LamaClient interface** in `useLamaClient.tsx`:
   ```typescript
   interface MyDomainClient {
     myMethod: (request: { ... }) => Promise<{ ... }>;
   }
   ```

4. **Update compatibility layer** (optional, if legacy components need it):
   ```typescript
   // In useInstance.tsx
   models: {
     myModel: {
       myMethod: (...args) => client.myDomain.myMethod({ ...args })
     }
   }
   ```

5. **Use in components**:
   ```typescript
   // New way (direct)
   const client = useLamaClient();
   await client.myDomain.myMethod({ ... });

   // Legacy way (via compatibility)
   const { models } = useInstance();
   await models.myModel.myMethod(...);
   ```

## Development Workflow

### Running the App

```bash
# Start development server
npm start

# Platform options:
# - Press 'i' for iOS Simulator
# - Press 'a' for Android Emulator
# - Press 'w' for Web Browser
# - Scan QR code with Expo Go app
```

### Hot Reload

Changes to TypeScript/React files automatically reload. For deeper changes:

```bash
# Clear cache and restart
npm run start:clear
```

### Working with Shared Packages

This app references `*.core` and `packages/*` directly from the parent monorepo via npm `file:` dependencies. Changes to parent packages are automatically reflected after reinstalling:

```bash
# After updating parent packages (e.g., chat.core, lama.core)
npm install

# Clear cache and restart
npm run start:clear
```

No copying or syncing needed - we use the parent packages directly!

### Migrating Components from Legacy

To migrate a component from legacy compatibility to direct plan usage:

**Before** (using compatibility layer):
```typescript
import { useInstance } from '@hooks/useInstance';

function MyComponent() {
  const { models } = useInstance();

  const handleSend = async () => {
    await models.topicModel.sendMessage(topicId, content);
  };
}
```

**After** (using plans directly):
```typescript
import { useLamaClient } from '@hooks/useLamaClient';

function MyComponent() {
  const client = useLamaClient();

  const handleSend = async () => {
    await client.chat.sendMessage({ topicId, content });
  };
}
```

## Common Patterns

### Using Plans

```typescript
import { useLamaClient } from '@hooks/useLamaClient';

function ChatScreen() {
  const client = useLamaClient();

  // Send message - invokes ChatPlan.sendMessage()
  const handleSend = async () => {
    await client.chat.sendMessage({
      topicId: 'topic-123',
      content: 'Hello world'
    });
    // Data is stored via ONE.core
    // Will sync to other devices via CHUM protocol
  };

  // Get history - invokes ChatPlan.getHistory()
  useEffect(() => {
    client.chat.getHistory({ topicId: 'topic-123' })
      .then(result => setMessages(result.messages));
  }, []);
}
```

### Using Legacy Compatibility

```typescript
import { useInstance } from '@hooks/useInstance';

function LegacyComponent() {
  const { models, isAuthenticated } = useInstance();

  // Works exactly like the old app
  const handleSend = async () => {
    await models.topicModel.sendMessage(topicId, content);
  };
}
```

### Real-Time Updates

```typescript
// Subscribe to ONE.core events
useLamaEvents('topicUpdated', (event) => {
  // Reload when topic changes
  client.chat.getHistory({ topicId: event.topicId })
    .then(result => setMessages(result.messages));
});
```

### Error Handling

```typescript
try {
  await client.chat.sendMessage({ topicId, content });
} catch (error) {
  // Errors from ONE.core/plans
  console.error('Failed to send:', error);
  Alert.alert('Error', error.message);
}
```

## Integration with Parent Codebase

This project is part of the LAMA monorepo and follows the same structure as `lama.browser` and `lama.cube`:

```
lama/
├── *.core/              # Business logic packages (referenced directly)
│   ├── chat.core/       # → @chat/core
│   ├── lama.core/       # → @lama/core
│   ├── connection.core/ # → @lama/connection.core
│   ├── mcp.core/        # → @mcp/core
│   └── settings.core/   # → @settings/core
├── packages/            # Core packages (referenced directly)
│   ├── one.core.expo/   # → @refinio/one.core (RN compatible)
│   └── one.models/      # → @refinio/one.models
├── lama.ui/             # Shared UI components
├── lama.electron/       # Desktop app (Electron)
├── lama.browser/        # Browser app (Web)
├── lama.cube/           # Cube app (Electron)
├── lama/                # Legacy mobile app (BEING REPLACED)
└── lama.app/            # THIS PROJECT - New mobile app (React Native)
```

**Package References (via npm file: dependencies):**
```json
{
  "@chat/core": "file:../chat.core",
  "@lama/core": "file:../lama.core",
  "@lama/connection.core": "file:../connection.core",
  "@mcp/core": "file:../mcp.core",
  "@settings/core": "file:../settings.core",
  "@refinio/one.core": "file:../packages/one.core.expo",
  "@refinio/one.models": "file:../packages/one.models"
}
```

**Shared across all platforms:**
- Same business logic (plans in `*.core/`)
- Same data models (`one.models`)
- Same TypeScript types
- Same UI components (`lama.ui/`)

## Design Principles

1. **Plans are the surface** - All functionality exposed as plan operations
2. **Run real business logic** - No mocks, use actual *.core packages from parent monorepo
3. **Shared codebase** - Direct references to parent packages, no duplication
4. **Type safety** - TypeScript interfaces for all requests/responses
5. **Fail fast** - No fallbacks or mitigation, fix the root cause
6. **Platform-agnostic** - Same *.core packages work across Electron, browser, mobile
7. **Gradual migration** - Compatibility layer allows incremental modernization

## Troubleshooting

### Metro bundler errors

```bash
# Clear cache and restart
npx expo start -c
```

### TypeScript path resolution errors

Check that both `tsconfig.json` and `babel.config.js` have matching path configurations:

```bash
# Restart Metro with cleared cache
npx expo start -c
```

### "Cannot find module @refinio/one.core"

Ensure parent monorepo packages are installed:

```bash
npm install
# This installs from file:../packages/* and file:../*.core dependencies
```

If issues persist, verify that parent packages exist:

```bash
ls -la ../packages/one.core.expo
ls -la ../chat.core
ls -la ../lama.core
```

### Expo Router not found

```bash
# Ensure expo-router is installed
npm install expo-router

# Check app.json has expo-router plugin in "plugins" array
```

### React Native Reanimated errors

The babel.config.js includes `react-native-reanimated/plugin` which must be the last plugin. If you add new Babel plugins, ensure reanimated stays last:

```javascript
plugins: [
  ['module-resolver', { /* ... */ }],
  'react-native-reanimated/plugin',  // Must be last!
]
```

### ONE.core initialization errors

If PlanTransportAdapter fails to initialize:

1. Check that `../packages/one.core.expo` exists in parent monorepo
2. Verify expo-file-system, expo-crypto are installed (from one.core.expo deps)
3. Check console logs for specific initialization errors
4. Ensure storage permissions are granted (iOS/Android)

### Plan method not found

If a plan operation fails with "method not found":

1. Check the plan class exports the method (e.g., `ChatPlan.sendMessage`)
2. Verify routing in `PlanTransportAdapter.ts`
3. Ensure packages are up to date (`npm install` to refresh from parent monorepo)

### Legacy component not working

If a migrated component has issues:

1. Check that `useInstance()` hook is imported from `@hooks/useInstance`
2. Verify the compatibility layer includes the needed model methods
3. Consider migrating to direct plan usage with `useLamaClient()`

### Navigation not working

If tab navigation or routing fails:

1. Check that all tab screens exist in `app/(tabs)/`
2. Verify `_layout.tsx` is configured correctly
3. Ensure Expo Router is properly configured in `app.json`

## Performance Considerations

### Initialization Time

- ONE.core initialization happens once on app startup
- Takes 1-3 seconds depending on device
- Shows loading spinner during initialization

### Message Loading

- Messages are loaded on-demand per topic
- Uses pagination for large chat histories
- Cached in memory while topic is active

### Storage

- All data stored locally via expo-file-system
- Automatic sync via CHUM protocol
- No network required for basic operations

## Key Differences from Other Platforms

| Aspect | lama.electron | lama.browser | lama.app (this) |
|--------|---------------|--------------|-----------------|
| ONE.core | Regular one.core (Node.js) | IndexedDB version | one.core.expo (RN compatible) |
| Storage | Node.js fs | IndexedDB | expo-file-system |
| Crypto | Node.js crypto | Web Crypto API | expo-crypto |
| Plans | Direct import | Direct import | Direct import (same!) |
| Native bridge | N/A | N/A | Not needed! Runs natively |
| UI Framework | Electron | React (web) | React Native |

**Key insight**: We don't need a native bridge because `one.core.expo` runs directly in React Native!

## Related Documentation

- `../CLAUDE.md` - Parent monorepo documentation
- `../packages/one.core.expo/README.md` - React Native ONE.core implementation
- `../chat.core/CLAUDE.md` - Chat plan documentation
- `../lama.core/CLAUDE.md` - Core handlers documentation
- `../lama/CLAUDE.md` - Legacy app documentation (for reference)

## Next Steps

1. ✅ Run plans in React Native (DONE!)
2. ✅ Use one.core.expo for React Native compatibility (DONE!)
3. ✅ Remove mocks - use real business logic (DONE!)
4. ✅ Migrate UI from legacy app (DONE!)
5. Replace compatibility hooks with direct plan usage (gradual)
6. Add comprehensive tests
7. Implement remaining plan operations (AI, connections, etc.)
8. Optimize performance and bundle size
9. Add offline support and background sync
10. Prepare for production release
