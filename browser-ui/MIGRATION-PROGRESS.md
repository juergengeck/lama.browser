# UI Migration Progress: useModel() → usePlans()

## Migration Status: IN PROGRESS ✅

### Overview

Successfully migrated **8 components** and **4 hooks** to use platform-agnostic `usePlans()` pattern. Build passes with no TypeScript errors (4.01s build time).

### Completed Migrations ✅

#### 1. ContactsView Component
**File**: `src/components/ContactsView.tsx`
**Plans Used**: `contacts`, `connection`
**Changes**:
- ✅ Replaced `model.contactsPlan.getContacts()` with `contacts.getContacts()`
- ✅ Replaced `model.iomPlan.createPairingInvitation()` with `connection.createPairingInvitation()`
- ✅ Updated imports to include `usePlans` from `@lama/ui`
- ✅ Kept `useModel()` for platform-specific features (`model.initialized`)

**Before**:
```typescript
const model = useModel()
const result = await model.contactsPlan.getContacts()
```

**After**:
```typescript
const model = useModel() // Keep for initialized state
const { contacts, connection } = usePlans()
const result = await contacts.getContacts()
```

#### 2. useMessages Hook
**File**: `src/hooks/useMessages.ts`
**Plans Used**: `chat`
**Changes**:
- ✅ Replaced `model.chatPlan.getMessages()` with `chat.getMessages()`
- ✅ Replaced `model.chatPlan.sendMessage()` with `chat.sendMessage()`
- ✅ Updated dependency arrays to use `chat` instead of `model`
- ✅ Kept `useModel()` for platform-specific features (`model.initialized`, `model.channelManager`)

**Before**:
```typescript
const model = useModel()
const response = await model.chatPlan.getMessages({...})
```

**After**:
```typescript
const model = useModel() // Keep for initialized, channelManager
const { chat } = usePlans()
const response = await chat.getMessages({...})
```

#### 3. useChatSubjects Hook
**File**: `src/hooks/useChatSubjects.ts`
**Plans Used**: `topicAnalysis`
**Changes**:
- ✅ Replaced `model.topicAnalysisPlan.getSubjects()` with `topicAnalysis.getSubjects()`
- ✅ Updated to use `usePlans()` for platform-agnostic operations
- ✅ Kept `getModel()` for initialization check

**Before**:
```typescript
const model = getModel()
const response = await model.topicAnalysisPlan.getSubjects({...})
```

**After**:
```typescript
const model = getModel() // Keep for initialized check
const { topicAnalysis } = usePlans()
const response = await topicAnalysis.getSubjects({...})
```

#### 4. ChatView Component
**File**: `src/components/ChatView.tsx`
**Plans Used**: (via hooks)
**Changes**:
- ✅ Uses migrated `useMessages()` hook (now platform-agnostic)
- ✅ Uses migrated `useChatSubjects()` hook (now platform-agnostic)
- ✅ No direct changes needed - migration happened at hook level

#### 5. KeywordDetailPanel Component
**File**: `src/components/KeywordDetail/KeywordDetailPanel.tsx`
**Plans Used**: `keywordDetail`
**Changes**:
- ✅ Replaced `model.keywordDetailPlan.updateKeywordAccessState()` with `keywordDetail.updateKeywordAccessState()`
- ✅ Updated imports to include `usePlans` from `@lama/ui`
- ✅ Kept `useModel()` for initialization check
- ✅ Uses migrated `useKeywordDetails()` hook

**Before**:
```typescript
const model = useModel()
await model.keywordDetailPlan.updateKeywordAccessState({...})
```

**After**:
```typescript
const model = useModel() // Keep for initialized check
const { keywordDetail } = usePlans()
await keywordDetail.updateKeywordAccessState({...})
```

#### 6. useKeywordDetails Hook
**File**: `src/hooks/useKeywordDetails.ts`
**Plans Used**: `keywordDetail`
**Changes**:
- ✅ Replaced `window.electronAPI.invoke('keywordDetail:getKeywordDetails')` with `keywordDetail.getKeywordDetails()`
- ✅ Removed Electron IPC dependency
- ✅ Now platform-agnostic (works in browser, Electron, mobile)
- ✅ Updated dependency array to include `keywordDetail`

**Before**:
```typescript
const response = await window.electronAPI.invoke('keywordDetail:getKeywordDetails', {...})
```

**After**:
```typescript
const { keywordDetail } = usePlans()
const response = await keywordDetail.getKeywordDetails({...})
```

#### 7. GroupChatDialog Component
**File**: `src/components/GroupChatDialog.tsx`
**Plans Used**: `contacts`
**Changes**:
- ✅ Replaced `model.contactsPlan.getContacts()` with `contacts.getContacts()`
- ✅ Platform-agnostic contact loading for group chat creation
- ✅ Kept `useModel()` for platform-specific features (initialized, ownerId)

**Before**:
```typescript
const model = useModel()
const result = await model.contactsPlan.getContacts()
```

**After**:
```typescript
const model = useModel() // Keep for initialized, ownerId
const { contacts: contactsPlan } = usePlans()
const result = await contactsPlan.getContacts()
```

#### 8. MessageView Component
**File**: `src/components/MessageView.tsx`
**Plans Used**: `contacts`
**Changes**:
- ✅ Replaced `model.contactsPlan.getContacts()` with `contacts.getContacts()`
- ✅ Platform-agnostic contact name loading for message display
- ✅ Updated dependency array to include `contacts`
- ✅ Kept `useModel()` for initialization check

**Before**:
```typescript
const model = useModel()
const result = await model.contactsPlan.getContacts()
```

**After**:
```typescript
const model = useModel() // Keep for initialized check
const { contacts } = usePlans()
const result = await contacts.getContacts()
```

### Build Status ✅

```bash
$ npm run build
✓ 4160 modules transformed
✓ built in 4.16s
```

**Result**: No TypeScript errors, build successful!

### Migration Summary

**Components Migrated**: 8
- ContactsView ✅
- ChatView ✅ (via hooks)
- KeywordDetailPanel ✅
- GroupChatDialog ✅
- MessageView ✅
- DataDashboard ✅ (Session 4)
- InstancesView ✅ (Session 4)
- InvitationAcceptance ✅ (Session 4)

**Hooks Migrated**: 4
- useMessages ✅
- useChatSubjects ✅
- useKeywordDetails ✅
- ChatLayout contact enrichment ✅

**Plans Now Platform-Agnostic**:
- `contacts` - Contact management (used by 6 components now!)
- `connection` - P2P connections, pairing invitations (3 components)
- `chat` - Messages, conversations, send/receive (3 components + 1 hook)
- `topicAnalysis` - AI subject extraction
- `keywordDetail` - Keyword details, access control

### Remaining Components 🚧

These components still use `model.somePlan` and should be migrated next:

1. **JournalView** - Uses mock data (skip for now)
   - Currently returns mock data, no real plan usage yet

2. **SettingsView** - Complex, uses multiple plans
   - Needs: `llmConfig`, `crypto`, `contacts`
   - High priority - main settings interface

3. **TopicSummary components** - Use `model.topicAnalysisPlan`
   - Needs: `topicAnalysis.getSummary()`, `topicAnalysis.getSubjects()`
   - Medium priority - AI analysis features

4. **DevicesView** - May use Electron-specific patterns
   - Check if using `window.electronAPI` (Electron-specific, not browser-compatible)
   - Lower priority - investigate compatibility first

### Migration Pattern

**3-line migration for any component**:

```typescript
// 1. Import
import { usePlans } from '@lama/ui'

// 2. Destructure
const { llmConfig } = usePlans()

// 3. Use
await llmConfig.getAllConfigs()
```

### Benefits Achieved

✅ **Platform-agnostic** - 5 components + 4 hooks now work on browser, Electron, mobile
✅ **Type-safe** - Full TypeScript support via LAMAPlans interface
✅ **No additional abstraction** - Plans already provide the facade
✅ **Incremental** - Both useModel() and usePlans() work simultaneously
✅ **Build successful** - No TypeScript errors (4.16s build time)
✅ **Proven pattern** - 5 different components migrated successfully
✅ **Electron IPC eliminated** - useKeywordDetails now platform-agnostic (was Electron-specific)
✅ **Consistent API** - contacts plan used by 4 different components with same interface

### Architecture

```
lama.ui (Platform-Agnostic Components)
  ↓
usePlans() → LAMAPlans interface
  ↓
{ llmConfig, chat, contacts, ... }
  ↑
PlansProvider (lama.browser/App.tsx)
  ↑
modelToPlans() helper
  ↑
Model (browser-specific ONE.core instance)
```

### Next Steps

1. Continue migrating remaining components (SettingsView, KeywordDetailPanel, etc.)
2. Test all migrated components thoroughly
3. Future: Create IPC wrapper for lama.cube (Electron)
4. Future: Create native bridge for lama.thin (Mobile)

### Documentation

- **Migration Guide**: `MIGRATION-GUIDE.md` - Complete guide with examples
- **Plans Interface**: `lama.ui/src/types/plans.ts` - LAMAPlans TypeScript definitions
- **Plans Context**: `lama.ui/src/contexts/PlansContext.tsx` - usePlans() implementation
- **Platform Integration**: `lama.browser/browser-ui/src/App.tsx` - PlansProvider setup

### Files Changed (Session 2)

7. `/lama.browser/browser-ui/src/components/KeywordDetail/KeywordDetailPanel.tsx` - Migrated keywordDetail plan
8. `/lama.browser/browser-ui/src/hooks/useKeywordDetails.ts` - Migrated from Electron IPC to keywordDetail plan
9. `/lama.browser/browser-ui/MIGRATION-PROGRESS.md` - Updated with new migrations

### Files Changed (Session 3)

10. `/lama.browser/browser-ui/src/components/GroupChatDialog.tsx` - Migrated contacts plan
11. `/lama.browser/browser-ui/src/components/MessageView.tsx` - Migrated contacts plan
12. `/lama.browser/browser-ui/MIGRATION-PROGRESS.md` - Updated with Session 3 migrations

### Session 4 Migrations ✅

#### 9. DataDashboard Component
**File**: `src/components/DataDashboard.tsx`
**Plans Used**: `chat`, `contacts`
**Changes**:
- ✅ Replaced `model.chatPlan.getConversations()` with `chat.getConversations()`
- ✅ Replaced `model.chatPlan.getMessages()` with `chat.getMessages()` (3 occurrences)
- ✅ Replaced `model.contactsPlan.getContacts()` with `contacts.getContacts()`
- ✅ Platform-agnostic data statistics gathering

**Before**:
```typescript
const convsResult = await model.chatPlan.getConversations()
const messagesResult = await model.chatPlan.getMessages({ topicId: conv.id })
const contactsResult = await model.contactsPlan.getContacts()
```

**After**:
```typescript
const model = useModel() // Keep for initialized check
const { chat, contacts } = usePlans()
const convsResult = await chat.getConversations()
const messagesResult = await chat.getMessages({ topicId: conv.id })
const contactsResult = await contacts.getContacts()
```

#### 10. InstancesView Component
**File**: `src/components/InstancesView.tsx`
**Plans Used**: `contacts`, `connection`
**Changes**:
- ✅ Replaced `model.contactsPlan.getContacts()` with `contactsPlan.getContacts()`
- ✅ Replaced `model.iomPlan.createPairingInvitation()` with `connection.createPairingInvitation()`
- ✅ Platform-agnostic device and contact management
- ✅ Kept `useModel()` for platform-specific features (initialized, ownerId)

**Before**:
```typescript
const model = useModel()
const result = await model.contactsPlan.getContacts()
await model.iomPlan.createPairingInvitation({})
```

**After**:
```typescript
const model = useModel() // Keep for initialized, ownerId
const { contacts: contactsPlan, connection } = usePlans()
const result = await contactsPlan.getContacts()
await connection.createPairingInvitation({})
```

#### 11. InvitationAcceptance Component
**File**: `src/components/InvitationAcceptance.tsx`
**Plans Used**: `connection`
**Changes**:
- ✅ **Removed `model` prop requirement** - now platform-agnostic
- ✅ Replaced `props.model.connectionPlan.acceptPairingInvitation()` with `connection.acceptPairingInvitation()`
- ✅ Uses `useModel()` internally for initialization checks
- ✅ Updated `App.tsx` to remove model prop when rendering InvitationAcceptance

**Before**:
```typescript
// Component signature
type InvitationAcceptanceProps = {
  model: Model
  invitationUrl: string
  onComplete: (success: boolean) => void
}

// Usage
const result = await props.model.connectionPlan.acceptPairingInvitation({...})

// App.tsx
<InvitationAcceptance model={model} invitationUrl={...} onComplete={...} />
```

**After**:
```typescript
// Component signature (no model prop!)
type InvitationAcceptanceProps = {
  invitationUrl: string
  onComplete: (success: boolean) => void
}

// Usage
const model = useModel() // Keep for initialized, ownerId
const { connection } = usePlans()
const result = await connection.acceptPairingInvitation({...})

// App.tsx
<InvitationAcceptance invitationUrl={...} onComplete={...} />
```

### Build Status ✅

```bash
$ npm run build
✓ 4160 modules transformed
✓ built in 4.01s
```

**Result**: No TypeScript errors, build successful!

### Files Changed (Session 4)

13. `/lama.browser/browser-ui/src/components/DataDashboard.tsx` - Migrated chat + contacts plans (4 calls total)
14. `/lama.browser/browser-ui/src/components/InstancesView.tsx` - Migrated contacts + connection plans
15. `/lama.browser/browser-ui/src/components/InvitationAcceptance.tsx` - Migrated connection plan, removed model prop
16. `/lama.browser/browser-ui/src/App.tsx` - Updated InvitationAcceptance usage (removed model prop)
17. `/lama.browser/browser-ui/MIGRATION-PROGRESS.md` - Updated with Session 4 migrations

---

**Last Updated**: 2025-01-11 (Session 4 complete)
**Status**: Incremental migration in progress
**Build**: ✅ Passing (4.01s)
**Total Migrated**: 8 components, 4 hooks (12 total items)
**Contacts Plan**: Now used by 5 components (ContactsView, GroupChatDialog, MessageView, ChatLayout, InstancesView, DataDashboard)
**Connection Plan**: Now used by 3 components (ContactsView, InstancesView, InvitationAcceptance)
**Chat Plan**: Now used by 3 components + 1 hook (ChatView via useMessages, DataDashboard)
