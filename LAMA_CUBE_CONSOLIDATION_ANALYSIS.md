# lama.cube React Components - Consolidation Analysis

**Date**: November 13, 2025
**Scope**: Complete inventory and consolidation strategy for lama.cube components

## Executive Summary

The lama.cube codebase contains **88 React components** across multiple categories. Analysis shows:
- **39 components (44%)** already consolidated into lama.ui
- **25 components (28%)** ready for immediate consolidation with minimal refactoring
- **23 components (28%)** require architectural changes to abstract Electron dependencies

## Quick Reference: Component Locations

All components are in: `/Users/gecko/src/lama/lama.cube/electron-ui/src/components/`

```
Total: 88 components
├── UI Primitives: 16 files (shadcn/ui)
├── Chat: 9 files
├── Settings: 12 files
├── Top-level Views: 29 files
├── Attachments: 6 files
├── Audit: 4 files
├── KeywordDetail: 5 files
├── TopicSummary: 6 files
└── Media: 1 file
```

---

## SECTION 1: Already Consolidated (39 components)

These components are complete and require no further action.

### UI Primitives (16) - All Migrated
All shadcn/ui wrapper components already in lama.ui/src/components/ui/
- alert-dialog, alert, avatar, badge, button, card, checkbox, dialog
- dropdown-menu, input, label, progress, scroll-area, separator, switch, tabs

### Chat Components (9) - All Migrated
Location: `lama.cube/electron-ui/src/components/chat/`
All already in: `lama.ui/src/components/chat/`
- ChatContext.tsx
- ChatHeader.tsx
- EnhancedMessageBubble.tsx
- EnhancedMessageInput.tsx
- FormattedMessageContent.tsx
- KeywordDisplay.tsx
- KeywordLine.tsx
- MessageContextMenu.tsx
- MessageHistory.tsx

### KeywordDetail (5) - All Migrated
Location: `lama.cube/electron-ui/src/components/KeywordDetail/`
All already in: `lama.ui/src/components/KeywordDetail/`
- AccessControlList.tsx
- KeywordDetailPanel.tsx
- SortControls.tsx
- SubjectItem.tsx
- SubjectList.tsx

### TopicSummary (6) - All Migrated
Location: `lama.cube/electron-ui/src/components/TopicSummary/`
All already in: `lama.ui/src/components/TopicSummary/`
- TopicSummary.tsx, index.tsx, KeywordCloud.tsx
- SubjectList.tsx, SummaryHistory.tsx, WordCloudSettings.tsx

### Other Consolidated (3)
- ParticipantAvatars.tsx - Avatar group display
- ProposalCard.tsx - Single proposal card
- ProposalCarousel.tsx - Proposal list carousel

### Partially Consolidated
- MessageView.tsx - Exists in both locations (lama.ui version should be canonical)

---

## SECTION 2: Ready for Phase 2 Consolidation (25 components)

These are platform-agnostic or require minimal refactoring.

### 2.1 Attachment Components (6 files)
**Location**: `lama.cube/electron-ui/src/components/attachments/`
**Consolidation**: DIRECT or with light abstraction

| Component | Purpose | Platform Deps | Action |
|-----------|---------|---------------|--------|
| AttachmentViewFactory.tsx | Factory pattern for attachment rendering | None | Consolidate as-is |
| ImageAttachmentView.tsx | Image display & preview | Canvas/Image APIs | Consolidate as-is |
| VideoAttachmentView.tsx | HTML5 video player | HTML5 video | Consolidate as-is |
| AudioAttachmentView.tsx | HTML5 audio player | HTML5 audio | Consolidate as-is |
| DocumentAttachmentView.tsx | PDF/text viewer | pdfjs (optional) | Consolidate as-is |
| UnknownAttachmentView.tsx | Fallback UI | None | Consolidate as-is |

**Strategy**: Move to `lama.ui/src/components/attachments/` directly. All dependencies are standard web APIs.

### 2.2 Audit & Trust Components (4 files)
**Location**: `lama.cube/electron-ui/src/components/audit/`
**Consolidation**: DIRECT

| Component | Purpose | Platform Deps | Action |
|-----------|---------|---------------|--------|
| AuditPanel.tsx | Audit trail display | None | Consolidate as-is |
| AuditorBadge.tsx | Auditor identity badge | None | Consolidate as-is |
| AttestationStatus.tsx | Attestation state indicator | None | Consolidate as-is |
| QRCodeDisplay.tsx | QR code renderer | qrcode lib (standard) | Consolidate as-is |

**Strategy**: Move to `lama.ui/src/components/audit/` directly. All are pure UI display components.

### 2.3 Media Component (1 file)
**Location**: `lama.cube/electron-ui/src/components/media/`
**Component**: MediaViewer.tsx
**Status**: Generic media viewer, platform-agnostic
**Action**: Move to `lama.ui/src/components/media/`

### 2.4 Generic Dialogs (2 files)
**Location**: `lama.cube/electron-ui/src/components/`

| Component | Purpose | Platform Deps | Action |
|-----------|---------|---------------|--------|
| InputDialog.tsx | Generic input modal | None | Move as-is |
| UserSelectionDialog.tsx | User picker modal | UI only | Move as-is |

**Action**: Move to `lama.ui/src/components/dialogs/`

### 2.5 Shared Business Logic (1 file)
**Location**: `lama.cube/electron-ui/src/components/`
**Component**: DeviceManager.tsx
**Analysis**: No electron API dependencies detected
**Action**: Move to `lama.ui/src/components/device/` or verify full analysis needed

---

## SECTION 3: Requires Refactoring for Consolidation (23 components)

These components have Electron dependencies that must be abstracted.

### 3.1 Settings Panels (12 files) - Phase 3
**Location**: `lama.cube/electron-ui/src/components/Settings/`
**Challenge**: All depend on `useSettings()` hook with lamaBridge for IPC

**Components**:
1. AccountSettingsPanel.tsx
2. AIConfigPanel.tsx
3. AISettingsPanel.tsx
4. KeywordLineSettings.tsx
5. KeywordSettingsPage.tsx
6. MCPSettings.tsx
7. NetworkSettingsPanel.tsx
8. PrivacySettingsPanel.tsx
9. ProfileSettingsPanel.tsx
10. ProposalSettingsPanel.tsx
11. UISettingsPanel.tsx
12. SettingsErrorBoundary.tsx

**Current Dependency Pattern**:
```typescript
// In Settings Panels
import { useSettings } from '../../hooks/useSettings'
const { settings, updateAI, loading, error } = useSettings()
// This hook uses lamaBridge internally
```

**Refactoring Strategy**:
1. Create abstraction in lama.ui:
   ```typescript
   // lama.ui/src/hooks/useAppSettings.ts
   export interface ISettingsProvider {
     get<T>(key: string): Promise<T>
     set<T>(key: string, value: T): Promise<void>
   }
   
   export function useAppSettings(provider: ISettingsProvider) {
     // Generic settings hook
   }
   ```

2. Implement in lama.cube:
   ```typescript
   // lama.cube/electron-ui/src/hooks/useSettings.ts
   export const useSettings = () => 
     useAppSettings(lamaBridgeSettingsProvider)
   ```

3. Move panels to lama.ui, accepting `ISettingsProvider` prop

**Timeline**: Phase 3, depends on hook abstraction architecture

### 3.2 Chat Views (5 files) - Phase 3
**Location**: `lama.cube/electron-ui/src/components/`

| Component | Size | Issue | Consolidation |
|-----------|------|-------|----------------|
| ChatView.tsx | 23KB | Uses lamaBridge, exists partially in lama.ui | Need to sync versions |
| ChatLayout.tsx | 25KB | Heavy electron use | Abstract layout logic |
| SubjectChatView.tsx | 14KB | Subject-specific, uses lamaBridge | Extract shared logic |
| JournalView.tsx | 5KB | IPC calls for journal | Create IPC abstraction |
| LoginScreen.tsx | 6KB | Platform-specific auth | Create variant system |

**Refactoring**: Need to extract message fetching, topic analysis into platform-agnostic hooks

### 3.3 Contact & Connection Views (5 files) - Phase 3
**Location**: `lama.cube/electron-ui/src/components/`

| Component | Size | Issue |
|-----------|------|-------|
| ContactsView.tsx | 19KB | lamaBridge for contact ops |
| ContactTrustStatus.tsx | 12KB | Trust status via IPC |
| ConnectionsView.tsx | 21KB | Connection list via IPC |
| PendingContacts.tsx | 13KB | Pending requests via IPC |
| (UserSelectionDialog.tsx) | 7KB | UI only - ready for Phase 2 |

**Refactoring**: Create data-fetching abstraction for contacts/connections

### 3.4 Device & Instance Views (6 files) - Phase 3
**Location**: `lama.cube/electron-ui/src/components/`

| Component | Size | Issue | Status |
|-----------|------|-------|--------|
| DevicesView.tsx | 7KB | lamaBridge | NEEDS REFACTORING |
| DeviceManager.tsx | 8KB | Appears clean | READY FOR PHASE 2 |
| DeviceSetup.tsx | 11KB | lamaBridge | NEEDS REFACTORING |
| UnifiedDevicesView.tsx | 33KB | Heavy IPC | Partial in lama.ui |
| InstanceManager.tsx | 12KB | lamaBridge | NEEDS REFACTORING |
| InstancesView.tsx | 18KB | lamaBridge | NEEDS REFACTORING |

**Refactoring**: Abstraction for device/instance data operations

### 3.5 Data & Dashboard Views (3 files) - Phase 3
**Location**: `lama.cube/electron-ui/src/components/`

| Component | Size | Issue |
|-----------|------|-------|
| DataDashboard.tsx | 24KB | Analytics via lamaBridge |
| ObjectHierarchyView.tsx | 19KB | Mostly UI, may be shareable |
| ObjectHierarchyDialog.tsx | 14KB | Modal variant of above |

### 3.6 Configuration Dialogs (2 files) - Phase 3
**Location**: `lama.cube/electron-ui/src/components/`

| Component | Size | Issue |
|-----------|------|-------|
| ProfileDialog.tsx | 3KB | IPC user profile |
| GroupChatDialog.tsx | 8KB | lamaBridge for group ops |
| MCPConfigDialog.tsx | 8KB | IPC for MCP config |

---

## SECTION 4: Consolidation Strategy & Timeline

### Phase 1 (COMPLETE)
- All UI primitives (16)
- Chat components (9)
- KeywordDetail (5)
- TopicSummary (6)
- Misc shared (3)
**Status**: Done, no action needed

### Phase 2 (RECOMMENDED NEXT)
**Timeline**: 1-2 weeks
**Effort**: Low, no architectural changes needed

**Move directly to lama.ui**:
1. Attachments (6 files) → `lama.ui/src/components/attachments/`
2. Audit components (4 files) → `lama.ui/src/components/audit/`
3. MediaViewer (1 file) → `lama.ui/src/components/media/`
4. InputDialog, UserSelectionDialog (2 files) → `lama.ui/src/components/dialogs/`
5. DeviceManager (1 file) → verify then move to `lama.ui/src/components/device/`

**Total**: 14 components, ~50KB code

**Steps**:
1. Copy files to lama.ui
2. Update import paths
3. Add to lama.ui index.ts exports
4. Update lama.cube to import from lama.ui
5. Test in lama.cube

### Phase 3 (ARCHITECTURAL)
**Timeline**: 2-4 weeks
**Effort**: Medium, requires abstraction design

**Create abstraction layers**:
1. Settings Provider interface
   - Move 12 settings panels + abstraction
   - Define ISettingsProvider contract
   - Implement in both lama.cube and lama.browser

2. Data Fetching abstraction
   - Message fetching hook
   - Contact/Connection data hook
   - Device/Instance data hook
   - Proposed hook system for lamaBridge operations

3. Move dependent components:
   - Chat views (5 files)
   - Contact/Connection views (5 files)
   - Device/Instance views (6 files)
   - Data dashboard (1 file)

**Total**: 29 components, ~200KB code

### Phase 4 (CLEANUP)
**Timeline**: 1 week
**Effort**: Low, finish consolidation

**Handle remaining platform-specific**:
1. LoginScreen - Create platform variants
2. SettingsView - Large container, may need refactoring
3. Dialogs needing IPC - Abstract IPC layer

**Total**: 9 components, ~100KB code

---

## SECTION 5: Key Abstraction Patterns Needed

### 5.1 Settings Provider Pattern
```typescript
// lama.ui/src/hooks/useAppSettings.ts
export interface ISettingsProvider {
  getSettings(): Promise<AppSettings>
  updateSettings(key: string, value: unknown): Promise<void>
  updateAI(config: AIConfig): Promise<void>
  // ... other updates
}

export function useAppSettings(provider: ISettingsProvider) {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    provider.getSettings()
      .then(setSettings)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])
  
  return { settings, loading, error, ...updateFunctions }
}

// lama.cube/electron-ui/src/hooks/useSettings.ts
const electronSettingsProvider: ISettingsProvider = {
  getSettings: () => lamaBridge.invoke('settings:get'),
  updateSettings: (key, value) => 
    lamaBridge.invoke('settings:set', { key, value }),
  // ...
}

export const useSettings = () => useAppSettings(electronSettingsProvider)
```

### 5.2 Message Data Hook Pattern
```typescript
// lama.ui/src/hooks/useMessages.ts
export interface IMessageProvider {
  getMessages(conversationId: string): Promise<Message[]>
  sendMessage(params: SendParams): Promise<void>
  // ...
}

export function useMessages(provider: IMessageProvider, conversationId: string) {
  // Generic hook logic
}

// lama.cube implementation
const electronMessageProvider: IMessageProvider = {
  getMessages: (id) => lamaBridge.invoke('messages:get', { id }),
  sendMessage: (params) => lamaBridge.invoke('messages:send', params),
}

export const useLamaMessages = (id: string) => 
  useMessages(electronMessageProvider, id)
```

### 5.3 Platform-Specific Components Pattern
```typescript
// lama.ui/src/components/LoginScreen.tsx
export interface LoginScreenProps {
  onLogin: (userId: string, password: string) => Promise<void>
  onRegister: (name: string, password: string) => Promise<void>
}

export function LoginScreen(props: LoginScreenProps) {
  // Generic UI logic, no platform deps
}

// lama.cube/electron-ui/src/components/LoginScreen.tsx
import { LoginScreen as BaseLoginScreen } from '@lama/ui/components'

export function LoginScreen() {
  const handleLogin = async (userId, password) => {
    // Electron-specific auth
    const result = await lamaBridge.invoke('auth:login', { userId, password })
  }
  
  return <BaseLoginScreen onLogin={handleLogin} onRegister={...} />
}
```

---

## SECTION 6: Dependency Analysis

### Components Using lamaBridge
- ChatView, ChatLayout, SubjectChatView, JournalView
- ContactsView, ConnectionsView, PendingContacts
- DevicesView, DeviceSetup, InstanceManager, InstancesView
- DataDashboard, AISettingsView
- All 12 Settings panels
- All configuration dialogs

### Standard Web APIs (Safe to Consolidate)
- Attachments: Canvas, Image, HTML5 Video/Audio
- Audit: Standard rendering
- MediaViewer: Generic player

### External Libraries (Need in Both)
- react-markdown, marked - Chat rendering
- lucide-react - Icons throughout
- clsx, tailwind-merge - Styling
- dompurify - HTML sanitization
- qrcode - QR code generation

---

## SECTION 7: File Structure After Consolidation

```
lama.ui/src/components/
├── chat/ (9 files) - DONE
├── KeywordDetail/ (5 files) - DONE
├── TopicSummary/ (6 files) - DONE
├── ui/ (16 files) - DONE
├── attachments/ (6 files) - Phase 2
├── audit/ (4 files) - Phase 2
├── media/ (1 file) - Phase 2
├── dialogs/ (2 files) - Phase 2
├── device/ (1 file) - Phase 2
│   └── + Phase 3 device views (6 files)
│   └── + Phase 3 instance views
├── contact/ (NEW) - Phase 3
│   └── ContactsView.tsx (5 files)
│   └── ConnectionsView.tsx
├── settings/ (NEW) - Phase 3
│   └── All 12 panel components
├── MessageView.tsx - DONE
├── ParticipantAvatars.tsx - DONE
├── ProposalCard.tsx - DONE
├── ProposalCarousel.tsx - DONE
├── LoginDeploy.tsx - DONE
└── ... other views - Phase 3/4

lama.ui/src/hooks/
├── useAppSettings.ts (NEW) - Phase 3
├── useMessages.ts (NEW) - Phase 3
├── useContacts.ts (NEW) - Phase 3
├── useDevices.ts (NEW) - Phase 3
└── ... other data hooks

lama.cube/electron-ui/src/components/
├── All platform-specific overrides/wrappers
└── LoginScreen wrapper (if needed)
```

---

## SECTION 8: Next Steps

1. **Immediate**: Phase 2 consolidation (14 components, low risk)
   - Copy 14 files to lama.ui
   - Update imports
   - Test in lama.cube

2. **Short-term**: Design abstraction layer for Phase 3
   - ISettingsProvider interface
   - IMessageProvider interface
   - IDataProvider interfaces for contacts/devices
   - Review with team for consistency

3. **Medium-term**: Execute Phase 3 (29 components)
   - Implement abstraction pattern
   - Move components with hook injection
   - Implement providers in lama.cube
   - Test all platform bridges

4. **Long-term**: Polish Phase 4 (9 components)
   - Create platform variant system
   - Handle remaining dialogs
   - Remove duplicates from lama.cube

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Components | 88 |
| Already Consolidated | 39 (44%) |
| Phase 2 Ready | 14 (16%) |
| Phase 3 Ready | 29 (33%) |
| Phase 4 Polish | 6 (7%) |
| Estimated Migration Effort | 4-6 weeks |
| LOC to Consolidate | ~350KB |
| UI Primitives Shared | 16 |
| Chat Components Shared | 9 |

---

**Document Generated**: 2025-11-13
**Status**: Complete inventory, ready for Phase 2 planning
