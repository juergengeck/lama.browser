# LAMA UI Consolidation Strategy

**Goal**: Migrate all reusable UI components from lama.browser to lama.ui, creating a shared component library for lama.browser, lama.cube, and lama.thin.

**Status**: lama.browser is the "tech settler" - components mature here before moving to lama.ui.

## Architecture Principles

### 1. Platform-Agnostic Components (lama.ui)
Components accept **operations** via props (dependency injection), not platform instances:

```typescript
// ✅ CORRECT - Platform-agnostic
interface LLMSettingsProps {
  llmConfig: LLMConfigOperations  // Interface, not concrete Plan
}

// ❌ WRONG - Platform-coupled
interface LLMSettingsProps {
  model: Model  // Concrete platform instance
}
```

### 2. Platform-Specific Adapters
Each platform provides adapters that implement the required interfaces:

```typescript
// lama.browser
<LLMSettings llmConfig={model.llmConfigPlan} />

// lama.cube
<LLMSettings llmConfig={ipcPlan.llmConfig} />

// lama.thin
<LLMSettings llmConfig={mobileAdapters.llmConfig} />
```

### 3. Component Categories

**Pure Presentational** (no dependencies): Move to lama.ui immediately
- UI primitives (Button, Card, etc.)
- Simple layouts with props only

**Data-Bound** (requires operations): Extract operations interface, then move
- Settings panels (LLMSettings, MCPSettings)
- Data displays (ContactsList, ConversationList)

**Platform-Specific** (browser storage, Electron IPC): Stay in platform folders
- StorageQuota (browser IndexedDB specifics)
- DeviceManager (platform pairing flows)

## Current State Analysis

### ✅ Already in lama.ui (27 components)

**Chat System** (9 components)
- ChatContext, ChatHeader, EnhancedMessageBubble
- EnhancedMessageInput, FormattedMessageContent
- KeywordDisplay, KeywordLine
- MessageContextMenu, MessageHistory

**Keyword/Topic Analysis** (11 components)
- KeywordDetail: AccessControlList, KeywordDetailPanel, SortControls, SubjectItem, SubjectList
- TopicSummary: index, KeywordCloud, SubjectList, SummaryHistory, TopicSummary, WordCloudSettings

**LLM Management** (2 components)
- LLMSettings ✨ (canonical implementation)
- ModelOnboarding

**UI Foundations** (5 components)
- ConversationCard, ConversationList
- LoginDeploy, MessageView, ParticipantAvatars
- ProposalCard, ProposalCarousel

**UI Primitives** (15 components)
- alert-dialog, alert, avatar, badge, button, card
- checkbox, dialog, dropdown-menu, input, label
- progress, scroll-area, separator, tabs, textarea

---

### 📦 Ready to Migrate (Platform-Agnostic)

**Settings Components** (5 components)
- [X] `Settings/LLMSettings.tsx` - Already migrated ✅
- [ ] `Settings/KeywordLineSettings.tsx` - Keyword line configuration
- [ ] `Settings/KeywordSettingsPage.tsx` - Keyword management UI
- [ ] `Settings/MCPSettings.tsx` - MCP server configuration
- [ ] `SettingsView.tsx` - Main settings container (needs refactor)

**Dialog Components** (5 components)
- [ ] `GroupChatDialog.tsx` - Create group chat UI
- [ ] `InputDialog.tsx` - Generic input dialog
- [ ] `PairingDialog.tsx` - Pairing flow UI
- [ ] `ProfileDialog.tsx` - Edit profile UI
- [ ] `UserSelectionDialog.tsx` - User picker

**Status/Display Components** (6 components)
- [ ] `ConnectionStatus.tsx` - Connection indicator
- [ ] `ContactTrustStatus.tsx` - Trust badge display
- [ ] `ErrorBoundary.tsx` - React error boundary
- [ ] `SyncProgress.tsx` - Sync status indicator
- [ ] `InvitationAcceptance.tsx` - Accept invitation UI
- [ ] `PendingContacts.tsx` - Pending contacts list

**Audit Components** (4 components)
- [ ] `audit/AttestationStatus.tsx` - Attestation display
- [ ] `audit/AuditorBadge.tsx` - Auditor badge UI
- [ ] `audit/AuditPanel.tsx` - Audit information panel
- [ ] `audit/QRCodeDisplay.tsx` - QR code display

**Attachment Components** (6 components)
- [ ] `attachments/AttachmentViewFactory.tsx` - Attachment renderer
- [ ] `attachments/AudioAttachmentView.tsx` - Audio player
- [ ] `attachments/DocumentAttachmentView.tsx` - Document viewer
- [ ] `attachments/ImageAttachmentView.tsx` - Image viewer
- [ ] `attachments/UnknownAttachmentView.tsx` - Fallback viewer
- [ ] `attachments/VideoAttachmentView.tsx` - Video player

**Media Components** (1 component)
- [ ] `media/MediaViewer.tsx` - Media gallery viewer

**Other Reusable** (2 components)
- [ ] `ObjectHierarchyView.tsx` - ONE.core object tree display
- [ ] `OllamaCorsHelp.tsx` - Ollama CORS help text

---

### 🔒 Platform-Specific (Stay in lama.browser)

**Browser Storage** (3 components)
- `Settings/StorageQuota.tsx` - IndexedDB quota display (browser API)
- `Settings/DataCleanup.tsx` - IndexedDB cleanup (browser API)
- `StorageWarning.tsx` - Browser storage warnings

**Browser Identity** (2 components)
- `Settings/SubscriptionSettings.tsx` - Browser subscription system
- `SubscriptionExport.tsx` - Browser subscription export
- `VerificationView.tsx` - Browser identity verification
- `PurchaseView.tsx` - Browser purchase flow

**Browser Instances** (2 components)
- `InstanceManager.tsx` - Browser multi-instance UI
- `InstancesView.tsx` - Browser instance list

**Large View Components** (8 components) - Need refactoring first
- `AISettingsView.tsx` - AI settings (monolithic, needs split)
- `ChatLayout.tsx` - Main chat layout (routing logic)
- `ChatView.tsx` - Chat view (state management)
- `ConnectionsView.tsx` - Connections manager (state)
- `ContactsView.tsx` - Contacts list (state)
- `DataDashboard.tsx` - Data analytics (state)
- `DevicesView.tsx` - Device management (state)
- `JournalView.tsx` - App journal (state)
- `SubjectChatView.tsx` - Subject chat (state)

**Device Management** (2 components) - Platform pairing flows
- `DeviceManager.tsx`
- `DeviceSetup.tsx`

**Other Platform-Specific** (3 components)
- `AppStateJournal.tsx` - Browser debugging UI
- `LoginScreen.tsx` - Browser-specific login (vs LoginDeploy which is shared)
- `ObjectHierarchyDialog.tsx` - Debug tool (wrapper around ObjectHierarchyView)

---

## Migration Process

### Phase 1: Quick Wins (Pure Presentational)
**Time**: 1-2 days

Move components that have zero dependencies:
1. **Dialog Components**: InputDialog, UserSelectionDialog
2. **Status Displays**: ConnectionStatus, ContactTrustStatus, ErrorBoundary
3. **Media**: AttachmentViewer components, MediaViewer
4. **Audit**: All 4 audit components
5. **Other**: ObjectHierarchyView, OllamaCorsHelp

**Actions**:
- Copy component to `lama.ui/src/components/`
- Export from `lama.ui/src/index.ts`
- Update lama.browser imports to use `@lama/ui`
- Verify no platform-specific imports (no `window`, `navigator`, etc.)

### Phase 2: Data-Bound Components (Extract Interfaces)
**Time**: 3-5 days

Components that depend on lama.core Plans:
1. **Settings**: MCPSettings, KeywordLineSettings, KeywordSettingsPage
2. **Dialogs**: GroupChatDialog, PairingDialog, ProfileDialog
3. **Status**: SyncProgress, InvitationAcceptance, PendingContacts

**Actions**:
- Define operations interface in `lama.ui/src/types/`
- Update component to use interface instead of concrete Plan
- Move component to lama.ui
- Update platforms to pass Plan instances

**Example**:
```typescript
// lama.ui/src/types/mcp.ts
export interface MCPOperations {
  listServers(): Promise<MCPServer[]>
  addServer(config: MCPServerConfig): Promise<void>
  removeServer(id: string): Promise<void>
  testConnection(id: string): Promise<boolean>
}

// lama.ui/src/components/settings/MCPSettings.tsx
interface MCPSettingsProps {
  mcpConfig: MCPOperations  // Interface, not Plan
}

// lama.browser
<MCPSettings mcpConfig={model.mcpPlan} />
```

### Phase 3: Large View Refactoring (Split & Extract)
**Time**: 1-2 weeks

Large view components need decomposition before migration:
1. **AISettingsView**: Split into smaller settings panels
2. **SettingsView**: Becomes a container, delegates to sub-components
3. **ChatView/ChatLayout**: Extract presentational layer
4. **ContactsView/ConnectionsView**: Extract list components

**Actions**:
- Identify presentational sub-components
- Extract to separate files
- Move presentational parts to lama.ui
- Keep state management in platform

### Phase 4: Platform Integration
**Time**: 1-2 weeks per platform

After lama.browser migration complete:
1. **lama.cube**: Replace old components with lama.ui versions
2. **lama.thin**: Build mobile UI using lama.ui components

---

## Dependency Injection Patterns

### Pattern 1: Operations Interface
Used for: Settings panels, configuration UIs

```typescript
// lama.ui/src/types/operations.ts
export interface LLMConfigOperations {
  getAllConfigs(): Promise<LLMConfig[]>
  updateSystemPrompt(params: {...}): Promise<void>
  // ... other operations
}

// Component accepts interface
export function LLMSettings({ llmConfig }: { llmConfig: LLMConfigOperations }) {
  const configs = await llmConfig.getAllConfigs()
  // ...
}

// Platform provides Plan instance (duck typing)
<LLMSettings llmConfig={model.llmConfigPlan} />
```

### Pattern 2: Render Props / Callbacks
Used for: Dialogs, modals with actions

```typescript
export interface GroupChatDialogProps {
  onCreateGroup: (name: string, participants: string[]) => Promise<void>
  onCancel: () => void
  availableContacts: Contact[]
}

// Platform provides callbacks
<GroupChatDialog
  onCreateGroup={async (name, participants) => {
    await model.chatPlan.createGroup({ name, participants })
  }}
  onCancel={() => setShowDialog(false)}
  availableContacts={contacts}
/>
```

### Pattern 3: Context Provider (for deep trees)
Used for: Chat context, model context

```typescript
// lama.ui provides context structure
export const ChatContext = createContext<ChatOperations>(...)

// Platform provides implementation
<ChatContext.Provider value={model.chatPlan}>
  <ChatView />
</ChatContext.Provider>

// Components deep in tree use context
function MessageInput() {
  const chat = useContext(ChatContext)
  await chat.sendMessage(...)
}
```

---

## Success Criteria

### For Each Component Migration:

✅ **Component is platform-agnostic**
- No imports from platform folders (`@/services`, `@/model`, etc.)
- No browser-specific APIs (`window`, `navigator`, `localStorage`)
- No Electron-specific APIs (`ipcRenderer`, `remote`)

✅ **Component uses dependency injection**
- Operations passed via props (interfaces, not concrete classes)
- Callbacks for actions
- No direct access to Plans or Models

✅ **Component is tested in both platforms**
- Works in lama.browser (original)
- Works in lama.cube (after migration)
- Same behavior, same UI

✅ **Types are exported**
- Props interfaces in `lama.ui/src/types/`
- Operations interfaces in `lama.ui/src/types/`
- Exported from `lama.ui/src/index.ts`

---

## Timeline Estimate

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 | 1-2 days | 20 pure presentational components migrated |
| Phase 2 | 3-5 days | 12 data-bound components migrated |
| Phase 3 | 1-2 weeks | 8 large views refactored and migrated |
| Phase 4 (cube) | 1-2 weeks | lama.cube using lama.ui components |
| Phase 4 (thin) | 1-2 weeks | lama.thin using lama.ui components |

**Total**: ~6-8 weeks for complete consolidation

---

## Migration Checklist Template

For each component:

```markdown
## [ComponentName] Migration

### Pre-Migration
- [ ] Component identified in lama.browser
- [ ] Platform dependencies analyzed
- [ ] Operations interface designed (if needed)

### Migration
- [ ] Component copied to lama.ui/src/components/
- [ ] Platform-specific code removed/abstracted
- [ ] Operations interface implemented
- [ ] Types exported from lama.ui/src/types/
- [ ] Component exported from lama.ui/src/index.ts

### Verification
- [ ] lama.browser updated to import from @lama/ui
- [ ] lama.browser builds successfully
- [ ] Component renders correctly in browser
- [ ] Component behavior unchanged

### Platform Integration
- [ ] lama.cube updated (if applicable)
- [ ] lama.thin updated (if applicable)
```

---

## Next Steps

1. **Start with Phase 1** - Migrate 5 pure presentational components this week
2. **Document learnings** - Update this doc with any new patterns discovered
3. **Create tracking issue** - GitHub issue with checklist for all 40+ components
4. **Establish review process** - PR template for component migrations

## Questions to Resolve

- **Component organization**: Flat structure or grouped by feature?
- **Type co-location**: Types in `/types/` or next to components?
- **Testing strategy**: Unit tests in lama.ui or integration tests in platforms?
- **Version strategy**: How to handle breaking changes to shared components?
