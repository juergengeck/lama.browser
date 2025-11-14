# UI Migration Guide: useModel() → usePlans()

This guide shows how to migrate components from platform-specific `useModel()` to platform-agnostic `usePlans()`.

## Overview

**Goal**: Make components platform-agnostic so they can work in browser, Electron, and mobile.

**Pattern**: Replace `model.somePlan.method()` with `plans.somePlan.method()` from `usePlans()`.

## Migration Pattern

### Before (Platform-Specific)
```typescript
import { useModel } from '@/model/index.js'

function MyComponent() {
  const model = useModel()

  useEffect(() => {
    async function loadData() {
      const response = await model.llmConfigPlan.getAllConfigs()
      // ...
    }
    loadData()
  }, [model])
}
```

### After (Platform-Agnostic)
```typescript
import { usePlans } from '@lama/ui'

function MyComponent() {
  const { llmConfig } = usePlans()

  useEffect(() => {
    async function loadData() {
      const response = await llmConfig.getAllConfigs()
      // ...
    }
    loadData()
  }, [llmConfig])
}
```

## Real Example: ChatLayout

### Original Code
```typescript
import { useModel } from '@/model/index.js'

export function ChatLayout() {
  const model = useModel()

  useEffect(() => {
    if (!model.initialized) return

    async function loadContacts() {
      const response = await model.contactsPlan.getContacts()
      // ...
    }
    loadContacts()
  }, [model.initialized])
}
```

### Migrated Code
```typescript
import { useModel } from '@/model/index.js'
import { usePlans } from '@lama/ui'

export function ChatLayout() {
  // Keep Model for platform-specific features (initialized, aiAssistantModel)
  const model = useModel()

  // Use Plans for platform-agnostic operations
  const { contacts } = usePlans()

  useEffect(() => {
    if (!model.initialized) return

    async function loadContacts() {
      // Platform-agnostic - works on browser, Electron, mobile
      const response = await contacts.getContacts()
      // ...
    }
    loadContacts()
  }, [model.initialized, contacts])
}
```

## When to Keep useModel()

You still need `useModel()` for:

1. **Initialization state**: `model.initialized`
2. **Platform-specific features**: `model.aiAssistantModel.topicManager`
3. **Owner ID**: `model.ownerId`
4. **Event listeners**: `model.onOneModelsReady.listen()`

These are browser-specific and not available in Electron IPC or mobile bridges.

## Available Plans

From `usePlans()` you can destructure:

```typescript
const {
  // AI Plans (lama.core)
  ai,                  // AI operations
  aiAssistant,         // AI assistant orchestration
  topicAnalysis,       // Keyword/subject extraction
  proposals,           // Knowledge sharing proposals
  keywordDetail,       // Keyword management
  wordCloudSettings,   // Word cloud settings
  llmConfig,          // LLM configuration
  crypto,             // Cryptographic operations
  audit,              // Audit logging

  // Chat Plans (chat.core)
  chat,               // Messages, conversations
  contacts,           // Contact management
  export: exportPlan, // Export conversations
  feedForward,        // Feed-forward actions

  // Connection Plans (connection.core)
  connection,         // P2P connections, pairing

  // Platform-specific (optional)
  storage,            // Browser: IndexedDB quota
  subscription,       // Browser: Subscription management
  filesystem          // Electron: File dialogs
} = usePlans()
```

## Migration Checklist

For each component:

- [ ] Identify all `model.somePlan.method()` calls
- [ ] Add `import { usePlans } from '@lama/ui'`
- [ ] Add `const { somePlan } = usePlans()`
- [ ] Replace `model.somePlan.method()` with `somePlan.method()`
- [ ] Add `somePlan` to dependency arrays if used in useEffect
- [ ] Keep `useModel()` if using `model.initialized` or platform-specific features
- [ ] Test the component

## Already Platform-Agnostic

These lama.ui components already use dependency injection and don't need migration:

- `LLMSettings` - Takes `llmConfig` prop
- `ModelOnboarding` - Takes `llmConfig` and `aiPlan` props
- `ConversationCard` - Pure presentational, no Plan dependencies
- `ParticipantAvatars` - Pure presentational
- `ProposalCard` - Pure presentational

## Next Components to Migrate

Priority order:

1. ✅ **ChatLayout** - Migrated (contacts)
2. **SettingsView** - Complex, needs careful migration
3. **ChatView** - Uses chat, topicAnalysis
4. **ContactsView** - Uses contacts
5. **DevicesView** - Uses connection
6. **JournalView** - Uses chat

## Testing

After migration:

1. Build succeeds: `npm run build`
2. Component renders without errors
3. All Plan methods work as expected
4. No console errors about missing Plans
5. Behavior identical to pre-migration

## Benefits

✅ **Platform-agnostic** - Component works on browser, Electron, mobile
✅ **Type-safe** - Full TypeScript support
✅ **Flexible** - Platforms provide Plans however they want
✅ **Incremental** - Migrate one component at a time
✅ **Testable** - Easy to mock Plans for testing

## Questions?

See:
- `lama.ui/src/types/plans.ts` - LAMAPlans interface
- `lama.ui/src/contexts/PlansContext.tsx` - usePlans() implementation
- `docs/UI-PLAN-FACADE-STRATEGY.md` - Architecture overview
