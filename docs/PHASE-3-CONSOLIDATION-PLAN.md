# Phase 3: Component Consolidation Plan

**Date**: November 13, 2025
**Status**: Ready to Execute
**Branch**: `008-unified-plan-system`

## Executive Summary

Consolidate 100 React components from lama.browser and lama.cube into lama.ui, creating a single shared component library for all platforms.

### Current State

| Platform | Total | Already Done | Ready Now | Needs Refactor | Platform-Specific |
|----------|-------|--------------|-----------|----------------|-------------------|
| lama.browser | 87 | 23 (26%) | 47 (54%) | 16 (18%) | 1 (1%) |
| lama.cube | 88 | 39 (44%) | 14 (16%) | 29 (33%) | 6 (7%) |
| **TOTAL** | **175** | **62 (35%)** | **61 (35%)** | **45 (26%)** | **7 (4%)** |

### Timeline

- **Phase 3A** (1-2 weeks): Consolidate 61 "ready now" components
- **Phase 3B** (2-4 weeks): Create abstractions, consolidate 45 components
- **Phase 3C** (1 week): Handle 7 platform-specific components
- **Total**: 4-7 weeks

---

## Phase 3A: Direct Consolidation (61 components)

### Priority 1: Shared Components (20 components) - Week 1

These exist in both platforms or are high-value shared components.

#### Attachments (6 files)
**Source**: Both platforms have these
**Target**: `lama.ui/src/components/attachments/`

```
AttachmentViewFactory.tsx
ImageAttachmentView.tsx
VideoAttachmentView.tsx
AudioAttachmentView.tsx
DocumentAttachmentView.tsx
UnknownAttachmentView.tsx
```

**Dependencies**: Canvas/Image APIs, HTML5 video/audio (all standard web)
**Risk**: LOW - platform-agnostic
**Effort**: 2 hours

#### Audit Components (4 files)
**Source**: Both platforms
**Target**: `lama.ui/src/components/audit/`

```
AuditPanel.tsx
AuditorBadge.tsx
AttestationStatus.tsx
QRCodeDisplay.tsx
```

**Dependencies**: qrcode library (standard)
**Risk**: LOW - pure UI display
**Effort**: 1 hour

#### Dialogs (6 files)
**Source**: lama.browser primarily
**Target**: `lama.ui/src/components/dialogs/`

```
InputDialog.tsx
UserSelectionDialog.tsx
GroupChatDialog.tsx
ProfileDialog.tsx
PairingDialog.tsx
ObjectHierarchyDialog.tsx
```

**Dependencies**: @radix-ui/react-dialog, form handling
**Risk**: LOW - generic UI patterns
**Effort**: 3 hours

#### Settings (4 files - platform-agnostic ones)
**Source**: lama.browser
**Target**: `lama.ui/src/components/settings/`

```
StorageQuota.tsx
DataCleanup.tsx
MCPSettings.tsx (if no IPC)
SubscriptionSettings.tsx (if no IPC)
```

**Dependencies**: Standard React hooks
**Risk**: LOW
**Effort**: 2 hours

### Priority 2: View Components (25 components) - Week 2

#### Device/Trust Components (6 files)
**Source**: lama.browser
**Target**: `lama.ui/src/components/device/`

```
DeviceManager.tsx
DeviceSetup.tsx
DevicesView.tsx
ChainOfTrustView.tsx
ContactTrustStatus.tsx
PendingContacts.tsx
```

**Dependencies**: Trust chain visualization, device list UI
**Risk**: MEDIUM - may have hidden platform dependencies
**Effort**: 4 hours (requires verification)

#### Contact/Connection Views (7 files)
**Source**: lama.browser
**Target**: `lama.ui/src/components/contacts/`

```
ContactsView.tsx
ConnectionsView.tsx
VerificationView.tsx
ConnectionStatus.tsx
PendingContacts.tsx
InstanceManager.tsx
SubjectChatView.tsx
```

**Dependencies**: Contact list UI, connection status
**Risk**: MEDIUM - check for IPC calls
**Effort**: 5 hours

#### Utility Components (10 files)
**Source**: lama.browser
**Target**: `lama.ui/src/components/` (root or appropriate subdirs)

```
ErrorBoundary.tsx
MobileTabBar.tsx
SyncProgress.tsx
StorageWarning.tsx
FaviconBadgeManager.tsx
AppStateJournal.tsx
SubscriptionExport.tsx
InvitationAcceptance.tsx
PurchaseView.tsx
DataDashboard.tsx
```

**Dependencies**: Various - progress indicators, mobile UI, browser APIs
**Risk**: MEDIUM - some may have platform specifics
**Effort**: 6 hours

#### Media & Other (2 files)
**Source**: lama.cube
**Target**: `lama.ui/src/components/media/`

```
MediaViewer.tsx
ObjectHierarchyView.tsx
```

**Dependencies**: Media playback, hierarchy visualization
**Risk**: LOW
**Effort**: 2 hours

### Priority 3: View/Layout Components (16 components) - Week 2

**Source**: lama.browser
**Target**: `lama.ui/src/components/`

```
ChatLayout.tsx
ChatView.tsx
MessageView.tsx
JournalView.tsx
InstancesView.tsx
SettingsView.tsx
HorizontalTreeView.tsx (ui primitive)
```

**Dependencies**: Layout patterns, routing
**Risk**: MEDIUM - may have platform-specific routing
**Effort**: 8 hours

**Total Phase 3A Effort**: ~33 hours (1-2 weeks)

---

## Phase 3B: Abstraction Layer + Consolidation (45 components)

### Step 1: Design Abstraction Patterns (Week 3)

Create platform-agnostic interfaces in `lama.ui/src/hooks/`

#### 1. Settings Provider Pattern
```typescript
// lama.ui/src/hooks/useAppSettings.ts
export interface ISettingsProvider {
  getSettings(): Promise<AppSettings>
  updateSettings(key: string, value: unknown): Promise<void>
  updateAI(config: AIConfig): Promise<void>
  updateKeywords(config: KeywordConfig): Promise<void>
  updateNetwork(config: NetworkConfig): Promise<void>
  updatePrivacy(config: PrivacyConfig): Promise<void>
}

export function useAppSettings(provider: ISettingsProvider) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    provider.getSettings()
      .then(setSettings)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [provider])

  const updateAI = useCallback(async (config: AIConfig) => {
    await provider.updateAI(config)
    setSettings(prev => prev ? { ...prev, ai: config } : null)
  }, [provider])

  return { settings, loading, error, updateAI, /* ... */ }
}
```

**Implementation**:
```typescript
// lama.cube/electron-ui/src/hooks/useSettings.ts
const electronSettingsProvider: ISettingsProvider = {
  getSettings: () => lamaBridge.invoke('settings:get'),
  updateSettings: (key, value) => lamaBridge.invoke('settings:set', { key, value }),
  updateAI: (config) => lamaBridge.invoke('settings:updateAI', config),
  // ...
}

export const useSettings = () => useAppSettings(electronSettingsProvider)
```

```typescript
// lama.browser/browser-ui/src/hooks/useSettings.ts
const browserSettingsProvider: ISettingsProvider = {
  getSettings: async () => {
    const settings = localStorage.getItem('settings')
    return settings ? JSON.parse(settings) : defaultSettings
  },
  updateSettings: async (key, value) => {
    const current = await browserSettingsProvider.getSettings()
    const updated = { ...current, [key]: value }
    localStorage.setItem('settings', JSON.stringify(updated))
  },
  // ...
}

export const useSettings = () => useAppSettings(browserSettingsProvider)
```

#### 2. Message Data Provider Pattern
```typescript
// lama.ui/src/hooks/useMessages.ts
export interface IMessageProvider {
  getMessages(conversationId: string): Promise<Message[]>
  sendMessage(params: SendMessageParams): Promise<void>
  deleteMessage(messageId: string): Promise<void>
  subscribeToMessages(conversationId: string, callback: (msg: Message) => void): () => void
}

export function useMessages(provider: IMessageProvider, conversationId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    provider.getMessages(conversationId)
      .then(msgs => {
        setMessages(msgs)
        unsubscribe = provider.subscribeToMessages(conversationId, (newMsg) => {
          setMessages(prev => [...prev, newMsg])
        })
      })
      .finally(() => setLoading(false))

    return () => unsubscribe?.()
  }, [provider, conversationId])

  return { messages, loading, sendMessage: provider.sendMessage }
}
```

#### 3. Contact/Connection Provider Pattern
```typescript
// lama.ui/src/hooks/useContacts.ts
export interface IContactProvider {
  getContacts(): Promise<Contact[]>
  getConnections(): Promise<Connection[]>
  addContact(contact: ContactParams): Promise<void>
  removeContact(contactId: string): Promise<void>
  getPendingContacts(): Promise<Contact[]>
}

export function useContacts(provider: IContactProvider) {
  // Similar pattern to above
}
```

#### 4. Device/Instance Provider Pattern
```typescript
// lama.ui/src/hooks/useDevices.ts
export interface IDeviceProvider {
  getDevices(): Promise<Device[]>
  getInstances(): Promise<Instance[]>
  switchInstance(instanceId: string): Promise<void>
  removeDevice(deviceId: string): Promise<void>
}

export function useDevices(provider: IDeviceProvider) {
  // Similar pattern
}
```

**Effort**: 2-3 days to design and implement all provider interfaces

### Step 2: Move Settings Panels (12 components) - Week 3-4

**Source**: lama.cube (all use `useSettings()`)
**Target**: `lama.ui/src/components/settings/`

```
AccountSettingsPanel.tsx
AIConfigPanel.tsx
AISettingsPanel.tsx
KeywordLineSettings.tsx
KeywordSettingsPage.tsx
MCPSettings.tsx
NetworkSettingsPanel.tsx
PrivacySettingsPanel.tsx
ProfileSettingsPanel.tsx
ProposalSettingsPanel.tsx
UISettingsPanel.tsx
SettingsErrorBoundary.tsx
```

**Process**:
1. Create `useAppSettings()` in lama.ui
2. Update each panel to accept `ISettingsProvider` via props or context
3. Move to lama.ui
4. Implement platform-specific providers in lama.cube and lama.browser
5. Update platform code to use consolidated panels

**Risk**: MEDIUM - settings are central to both platforms
**Effort**: 8-12 hours

### Step 3: Move Chat Views (5 components) - Week 4

**Source**: Both platforms
**Target**: `lama.ui/src/components/chat/` (extend existing)

```
ChatView.tsx (sync versions)
ChatLayout.tsx
SubjectChatView.tsx
JournalView.tsx
LoginScreen.tsx (variant system)
```

**Dependencies**: `useMessages()`, `usePlans()` abstractions
**Risk**: HIGH - core functionality
**Effort**: 12-16 hours

### Step 4: Move Contact/Device Views with Dependencies (11 components) - Week 5

**Source**: lama.cube, lama.browser
**Target**: `lama.ui/src/components/`

```
ContactsView.tsx (with useContacts)
ConnectionsView.tsx (with useConnections)
ContactTrustStatus.tsx
PendingContacts.tsx

DevicesView.tsx (with useDevices)
DeviceSetup.tsx
UnifiedDevicesView.tsx
InstanceManager.tsx
InstancesView.tsx
```

**Dependencies**: Provider implementations
**Risk**: MEDIUM
**Effort**: 10-12 hours

### Step 5: Configuration Dialogs (4 components) - Week 5

**Source**: lama.cube
**Target**: `lama.ui/src/components/dialogs/`

```
ProfileDialog.tsx (needs IPC abstraction)
GroupChatDialog.tsx (needs lamaBridge abstraction)
MCPConfigDialog.tsx (needs IPC abstraction)
```

**Dependencies**: Various platform bridges
**Risk**: MEDIUM
**Effort**: 4-6 hours

**Total Phase 3B Effort**: 80-100 hours (2-4 weeks)

---

## Phase 3C: Platform-Specific Components (7 components)

### Approach: Platform Variant System

Create base components in lama.ui with platform-specific implementations.

#### LoginScreen Pattern
```typescript
// lama.ui/src/components/LoginScreen.tsx
export interface LoginScreenProps {
  onLogin: (userId: string, password: string) => Promise<void>
  onRegister: (name: string, password: string) Promise<void>
  onForgotPassword?: () => void
  variant?: 'electron' | 'browser'
}

export function LoginScreen(props: LoginScreenProps) {
  // Generic UI logic, no platform deps
}

// lama.cube/electron-ui/src/components/LoginScreen.tsx
import { LoginScreen as BaseLoginScreen } from '@lama/ui'

export function LoginScreen() {
  const handleLogin = async (userId, password) => {
    const result = await lamaBridge.invoke('auth:login', { userId, password })
    // Handle result
  }

  return <BaseLoginScreen onLogin={handleLogin} variant="electron" />
}
```

**Components**:
- LoginScreen.tsx (both platforms)
- AISettingsView.tsx (Electron-specific, but base can be shared)
- AuditTrailView.tsx (IPC dependency)
- SettingsView.tsx (large container, create variants)

**Effort**: 16-20 hours (1 week)

---

## Migration Checklist

### Pre-Migration
- [ ] Review both analysis documents
- [ ] Create feature branch: `feature/phase-3-consolidation`
- [ ] Set up parallel PR review process
- [ ] Verify lama.ui builds successfully

### Phase 3A: Week 1-2
- [ ] Consolidate attachments (6 files)
- [ ] Consolidate audit components (4 files)
- [ ] Consolidate dialogs (6 files)
- [ ] Consolidate settings (4 platform-agnostic files)
- [ ] Test in both lama.cube and lama.browser
- [ ] Create PR #1: "Phase 3A: Consolidate 20 shared components"

### Phase 3A: Week 2
- [ ] Consolidate device/trust (6 files)
- [ ] Consolidate contacts/connections (7 files)
- [ ] Consolidate utilities (10 files)
- [ ] Consolidate media (2 files)
- [ ] Test in both platforms
- [ ] Create PR #2: "Phase 3A: Consolidate 25 view components"

### Phase 3B: Week 3
- [ ] Design ISettingsProvider interface
- [ ] Design IMessageProvider interface
- [ ] Design IContactProvider interface
- [ ] Design IDeviceProvider interface
- [ ] Implement providers in both platforms
- [ ] Create PR #3: "Phase 3B: Add provider abstraction layer"

### Phase 3B: Week 3-4
- [ ] Move 12 settings panels with provider injection
- [ ] Update lama.cube to use consolidated panels
- [ ] Update lama.browser to use consolidated panels
- [ ] Test settings in both platforms
- [ ] Create PR #4: "Phase 3B: Consolidate settings panels"

### Phase 3B: Week 4-5
- [ ] Consolidate chat views (5 files)
- [ ] Consolidate contact/device views (11 files)
- [ ] Consolidate config dialogs (4 files)
- [ ] Test all views in both platforms
- [ ] Create PR #5: "Phase 3B: Consolidate remaining views"

### Phase 3C: Week 6
- [ ] Create platform variant system
- [ ] Implement LoginScreen variants
- [ ] Implement other platform-specific variants
- [ ] Test all variants
- [ ] Create PR #6: "Phase 3C: Platform-specific components"

### Post-Migration
- [ ] Delete duplicate components from lama.browser
- [ ] Delete duplicate components from lama.cube
- [ ] Update all imports to use @lama/ui
- [ ] Full build test (both platforms)
- [ ] Integration tests
- [ ] Update documentation
- [ ] Create PR #7: "Phase 3: Cleanup and documentation"

---

## Success Criteria

✅ All 100+ components consolidated into lama.ui
✅ Zero duplicates in platform codebases
✅ Both lama.cube and lama.browser build successfully
✅ Both platforms run without errors
✅ All integration tests pass
✅ Provider abstraction pattern documented
✅ Component usage documented

---

## Risk Mitigation

### High-Risk Areas
1. **Settings panels**: Central to both platforms
   - Mitigation: Thorough provider testing, feature flags

2. **Chat views**: Core functionality
   - Mitigation: Parallel implementation, gradual rollout

3. **Platform-specific dependencies**: Hidden IPC calls
   - Mitigation: Static analysis, runtime checks

### Testing Strategy
1. **Unit tests**: For each consolidated component
2. **Integration tests**: Provider implementations
3. **E2E tests**: Full user workflows in both platforms
4. **Manual testing**: Settings, chat, connections in both platforms

### Rollback Plan
- Keep duplicate components until PR approved
- Feature flags for new consolidated components
- Git tags before each major merge
- Document known issues per phase

---

## File Structure After Phase 3

```
lama.ui/src/
├── components/
│   ├── chat/                  # DONE + 5 new from Phase 3B
│   ├── KeywordDetail/         # DONE
│   ├── TopicSummary/          # DONE
│   ├── ui/                    # DONE (shadcn primitives)
│   ├── attachments/           # Phase 3A (6 files)
│   ├── audit/                 # Phase 3A (4 files)
│   ├── dialogs/               # Phase 3A (6 files) + Phase 3B (4 files)
│   ├── settings/              # Phase 3A (4 files) + Phase 3B (12 files)
│   ├── device/                # Phase 3A (6 files) + Phase 3B (5 files)
│   ├── contacts/              # Phase 3A (7 files) + Phase 3B (4 files)
│   ├── media/                 # Phase 3A (2 files)
│   ├── MessageView.tsx        # DONE
│   ├── ParticipantAvatars.tsx # DONE
│   ├── ProposalCard.tsx       # DONE
│   ├── ProposalCarousel.tsx   # DONE
│   ├── LoginDeploy.tsx        # DONE
│   ├── LoginScreen.tsx        # Phase 3C (base)
│   └── ... utilities          # Phase 3A (10 files)
│
├── hooks/
│   ├── usePlans.ts            # Existing
│   ├── useAppSettings.ts      # Phase 3B NEW
│   ├── useMessages.ts         # Phase 3B NEW
│   ├── useContacts.ts         # Phase 3B NEW
│   ├── useDevices.ts          # Phase 3B NEW
│   └── ... other hooks
│
└── types/
    ├── providers.ts           # Phase 3B NEW (all provider interfaces)
    └── ... existing types
```

---

## Next Steps

1. **Review this plan** with the team
2. **Create feature branch**: `feature/phase-3-consolidation`
3. **Start with Phase 3A, Priority 1**: Attachments + Audit (10 files, 3 hours)
4. **Iterate quickly**: Small PRs, frequent merges
5. **Track progress**: Update this doc with checkmarks as we go

---

## Effort Summary

| Phase | Components | Hours | Duration |
|-------|------------|-------|----------|
| Phase 3A (Priority 1) | 20 | 8 | Week 1 |
| Phase 3A (Priority 2-3) | 41 | 25 | Week 2 |
| Phase 3B (Abstraction) | - | 20 | Week 3 |
| Phase 3B (Settings) | 12 | 10 | Week 3-4 |
| Phase 3B (Views) | 20 | 26 | Week 4-5 |
| Phase 3B (Dialogs) | 4 | 5 | Week 5 |
| Phase 3C (Variants) | 7 | 18 | Week 6 |
| **TOTAL** | **104** | **112 hours** | **4-6 weeks** |

---

**Document Status**: Ready for execution
**Last Updated**: November 13, 2025
**Next Review**: After Phase 3A completion
