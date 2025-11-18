# LAMA Browser Component Analysis & Consolidation Guide

## Executive Summary

This document provides a comprehensive inventory of all React components in `lama.browser` (browser-ui/src/components) and identifies which ones are candidates for consolidation into the shared `lama.ui` component library.

**Current Status:**
- Total components in lama.browser: 87 (.tsx files)
- Components already in lama.ui: 40
- Candidates for consolidation: 47 (54%)
- Platform-specific (Electron-only): 16 (18%)
- Already consolidated/duplicated: 23 (26%)

---

## Directory Structure Overview

```
lama.browser/browser-ui/src/components/
├── Chat Components (chat/)           [13 files] - MOSTLY CONSOLIDATED
├── Attachment Handlers (attachments/)[6 files]  - PLATFORM-SPECIFIC
├── Audit Trail (audit/)              [4 files] - SHOULD CONSOLIDATE
├── Keyword Management (KeywordDetail/)[5 files]- ALREADY IN LAMA.UI
├── Settings (Settings/)              [8 files] - MIXED
├── Topic Analysis (TopicSummary/)    [6 files] - ALREADY IN LAMA.UI
├── UI Primitives (ui/)               [1 file]  - SHARED
├── Root Level Components             [33 files]- MIXED
└── Deprecated Folders
    ├── FeedForward/
    ├── WorkerInit/
    └── media/
```

---

## Component Inventory

### ALREADY CONSOLIDATED INTO LAMA.UI (23 components)

These components exist in both lama.browser AND lama.ui - migration complete but duplicate copies remain.

#### Chat Components (13 files)
**Location:** `/lama.browser/browser-ui/src/components/chat/`
**Status:** DUPLICATED - Already in lama.ui/src/components/chat/

1. **ChatContext.tsx**
   - React Context for chat state management
   - Provides conversation data, messages, participants
   - Platform-agnostic, ready for shared use

2. **ChatHeader.tsx**
   - Displays conversation name, subject badges, message count
   - Horizontal scrolling for subjects with chevron navigation
   - Export functionality (Markdown, HTML with Microdata)
   - Imports: @lama/ui (Button, Badge, DropdownMenu)

3. **EnhancedMessageBubble.tsx**
   - Message display with rich formatting
   - Handles proposals, keywords, formatting
   - Platform-agnostic rendering

4. **EnhancedMessageInput.tsx**
   - Web-compatible message input with drag-drop support
   - Subject hashtag detection and suggestions
   - Trust-aware attachment handling
   - HTML5 File API integration

5. **FormattedMessageContent.tsx**
   - Markdown rendering with code highlighting
   - HTML sanitization with DOMPurify
   - Shared UI component, platform-agnostic

6. **KeywordDisplay.tsx**
   - Visual keyword/subject display
   - Badge-based rendering
   - Shared primitive component

7. **KeywordLine.tsx**
   - Inline keyword display in messages
   - Platform-agnostic

8. **MessageContextMenu.tsx**
   - Right-click menu for message actions
   - Copy, reply, delete, react options
   - Shared UI component

9. **MessageHistory.tsx**
   - Message list with infinite scroll
   - Timestamp formatting, sender avatars
   - Platform-agnostic

10. **LLMErrorRecovery.tsx**
    - Error recovery UI for LLM failures
    - Retry logic display
    - Platform-agnostic

**Dependencies:**
- lucide-react (icons)
- @lama/ui (Button, Badge, DropdownMenu, Dialog)
- marked (Markdown parsing)
- react-markdown
- highlight.js (code syntax highlighting)
- DOMPurify (HTML sanitization)

#### Topic Analysis Components (5 files)
**Location:** `/lama.browser/browser-ui/src/components/TopicSummary/`
**Status:** DUPLICATED - Already in lama.ui/src/components/TopicSummary/

1. **TopicSummary.tsx**
   - Main component for topic analysis display
   - Shows summary, subjects, keywords
   - History navigation

2. **SubjectList.tsx**
   - List of identified subjects in conversation
   - Merge and edit capabilities
   - Links to keywords

3. **KeywordCloud.tsx**
   - Visual word cloud representation
   - Size/color based on frequency/confidence
   - Interactive filtering

4. **SummaryHistory.tsx**
   - Version history browser
   - Timeline of summary updates
   - Diff view between versions

5. **WordCloudSettings.tsx**
   - Configuration for word cloud visualization
   - Threshold, size, color settings
   - Live preview

**Dependencies:**
- lucide-react
- @lama/ui (Button, Card, Slider, Dialog)
- Chart libraries (if applicable)
- Platform-agnostic

#### Keyword Management Components (5 files)
**Location:** `/lama.browser/browser-ui/src/components/KeywordDetail/`
**Status:** DUPLICATED - Already in lama.ui/src/components/KeywordDetail/

1. **KeywordDetailPanel.tsx**
   - Main panel for keyword detail view
   - Uses usePlans() for platform-agnostic data access
   - Shows keyword info, usage, related keywords

2. **SubjectList.tsx**
   - List of subjects using this keyword
   - Sort and filter controls
   - Click to view subject details

3. **SubjectItem.tsx**
   - Individual subject display
   - Metadata: count, date, trust level

4. **AccessControlList.tsx**
   - Access control management UI
   - Add/remove access entries
   - User selection

5. **SortControls.tsx**
   - Sort and filter controls
   - Platform-agnostic dropdown/button UI

**Dependencies:**
- @lama/ui components
- usePlans() hook from @lama/ui
- lucide-react

---

### SHOULD CONSOLIDATE INTO LAMA.UI (47 components)

These components are platform-agnostic and should be moved to lama.ui for shared use.

#### Group 1: Core Chat/Message Components (NOT YET IN LAMA.UI)

1. **MessageView.tsx**
   - Main message display and input container
   - Uses EnhancedMessageInput and EnhancedMessageBubble
   - Handles message sending, attachment management
   - **Dependencies:** useModel(), usePlans(), attachment services
   - **Platform-agnostic:** YES - uses hooks for data access

2. **ChatView.tsx**
   - Full chat view with participants, layout, controls
   - Renders message list, input field, headers
   - **Status:** Main view component, should be in lama.ui
   - **Dependencies:** Messages, conversation data

3. **ChatLayout.tsx**
   - Layout container for chat components
   - Sidebar/main content organization
   - **Status:** Layout primitive, should be shared

#### Group 2: Dialog/Modal Components

4. **GroupChatDialog.tsx**
   - Create/edit group chat
   - Participant selection, settings
   - **Platform-agnostic:** YES

5. **UserSelectionDialog.tsx**
   - Select users for group chat
   - Contact search, filtering
   - Uses usePlans() for contacts
   - **Platform-agnostic:** YES

6. **ProfileDialog.tsx**
   - User profile display/edit
   - Avatar, name, contact info
   - **Status:** Dialog component, shared UI

7. **PairingDialog.tsx**
   - Device pairing UI
   - QR code display, confirmation
   - **Platform-agnostic:** YES (QR just display)

8. **InputDialog.tsx**
   - Generic input dialog
   - Text input prompt, validation
   - **Reusable:** Generic primitive

9. **ObjectHierarchyDialog.tsx**
   - Browse object hierarchy
   - Tree view navigation
   - **Platform-agnostic:** YES

#### Group 3: View Components (Main Navigation Views)

10. **ContactsView.tsx**
    - List/manage contacts
    - Search, filter, add contacts
    - Uses usePlans() for contacts plan
    - **Platform-agnostic:** YES

11. **ConnectionsView.tsx**
    - Display P2P connections status
    - Connection management UI
    - **Platform-agnostic:** YES

12. **JournalView.tsx**
    - Conversation journal/history
    - Topic/conversation browser
    - **Status:** Main view component

13. **SettingsView.tsx**
    - Main settings container
    - Navigation to different settings pages
    - **Status:** View container

14. **InstancesView.tsx**
    - Multiple instance management
    - Instance list, create, delete
    - **Platform-agnostic:** YES (display + hooks)

15. **PurchaseView.tsx**
    - Payment/subscription UI
    - **Status:** View component

16. **VerificationView.tsx**
    - Verification process UI
    - Step-by-step verification
    - **Platform-agnostic:** YES

#### Group 4: Device/Trust Components

17. **DeviceManager.tsx**
    - Device list and management
    - Add, remove, trust devices
    - **Platform-agnostic:** Display only

18. **DeviceSetup.tsx**
    - Initial device setup wizard
    - Multi-step setup process
    - **Platform-agnostic:** YES

19. **DevicesView.tsx**
    - Main devices view/list
    - **Status:** View component, should consolidate

20. **ChainOfTrustView.tsx**
    - Display trust chain
    - Signatures, verification status
    - **Platform-agnostic:** YES

21. **ContactTrustStatus.tsx**
    - Trust status indicator
    - Visual trust level display
    - **Reusable:** YES, small component

22. **PendingContacts.tsx**
    - List pending contact requests
    - Accept/reject UI
    - **Platform-agnostic:** YES

#### Group 5: Data Display Components

23. **DataDashboard.tsx**
    - Statistics/metrics dashboard
    - Charts, summaries
    - **Status:** Display component

24. **InvitationAcceptance.tsx**
    - Accept invitation UI
    - Verify invitation, create account
    - **Platform-agnostic:** YES

25. **SyncProgress.tsx**
    - Sync progress indicator
    - Progress bar, status messages
    - **Reusable:** Small, generic

26. **StorageWarning.tsx**
    - Storage quota warning
    - Disk space indicator
    - **Reusable:** Generic alert

27. **ObjectHierarchyView.tsx**
    - Display object hierarchy
    - Tree view of data structure
    - **Platform-agnostic:** YES

28. **LoginScreen.tsx**
    - Login/register UI
    - Form inputs, validation
    - **Platform-agnostic:** YES
    - **Note:** This is pre-consolidated in lama.ui

29. **SubjectChatView.tsx**
    - Chat view focused on one subject
    - Filter messages by subject
    - **Platform-agnostic:** YES

#### Group 6: Attachment Handlers (Platform-Specific, Shared Display Logic)

30. **ImageAttachmentView.tsx**
    - Display image attachments
    - Zoom, lightbox
    - **Reusable:** Display only, platform-agnostic

31. **VideoAttachmentView.tsx**
    - Display video attachments
    - Video player UI
    - **Reusable:** Platform-agnostic

32. **AudioAttachmentView.tsx**
    - Display audio attachments
    - Audio player UI
    - **Reusable:** Platform-agnostic

33. **DocumentAttachmentView.tsx**
    - Display document attachments
    - PDF viewer integration
    - **Reusable:** Platform-agnostic

34. **UnknownAttachmentView.tsx**
    - Fallback for unknown attachment types
    - Download button, metadata
    - **Reusable:** YES

35. **AttachmentViewFactory.tsx**
    - Factory pattern for attachment type handling
    - Router to correct view component
    - **Reusable:** YES

#### Group 7: Settings Components

36. **LLMSettings.tsx**
    - LLM configuration UI
    - Model selection, API key setup
    - **Status:** Partially in lama.ui (settings/)
    - **Note:** Already being consolidated

37. **KeywordLineSettings.tsx**
    - Settings for keyword line display
    - Threshold, colors
    - **Reusable:** YES

38. **KeywordSettingsPage.tsx**
    - Full keyword settings page
    - Uses usePlans() for data
    - **Platform-agnostic:** YES

39. **SubscriptionSettings.tsx**
    - Subscription/payment settings
    - **Status:** Settings page

40. **ProposalSettings.tsx**
    - Proposal algorithm settings
    - Weights, thresholds, config
    - **Platform-agnostic:** YES

41. **MCPSettings.tsx**
    - MCP (Model Context Protocol) settings
    - Tool management, configuration
    - Uses useModel()
    - **Platform-agnostic:** YES

42. **StorageQuota.tsx**
    - Storage quota display
    - Usage visualization, limits
    - **Reusable:** YES

43. **DataCleanup.tsx**
    - Data cleanup UI
    - Delete old conversations, etc.
    - **Platform-agnostic:** YES

#### Group 8: Misc/Utility Components

44. **ParticipantAvatars.tsx**
    - Display participant avatars
    - Already in lama.ui but duplicate
    - **Status:** Already consolidated

45. **ProposalCard.tsx**
    - Single proposal display card
    - Already in lama.ui but duplicate
    - **Status:** Already consolidated

46. **ProposalCarousel.tsx**
    - Swipeable proposal carousel
    - Already in lama.ui but duplicate
    - **Status:** Already consolidated

47. **ConnectionStatus.tsx**
    - Connection status indicator
    - Online/offline badge
    - **Reusable:** YES

48. **InstanceManager.tsx**
    - Manage multiple instances
    - Instance switching, create/delete
    - **Platform-agnostic:** YES

49. **SubscriptionExport.tsx**
    - Export subscription data
    - Format selection, download
    - **Platform-agnostic:** YES

50. **FaviconBadgeManager.tsx**
    - Update favicon with notification badge
    - **Status:** Browser API usage, might be browser-specific
    - **Platform-agnostic:** YES (favicon is standard web API)

51. **AppStateJournal.tsx**
    - Journal of app state changes
    - Debug/history view
    - **Platform-agnostic:** YES

52. **ErrorBoundary.tsx**
    - React error boundary wrapper
    - Error display, recovery
    - **Reusable:** YES, generic pattern

53. **MobileTabBar.tsx**
    - Mobile bottom navigation
    - Responsive tabs
    - **Reusable:** YES, responsive component
    - **Status:** Should consolidate

---

### PLATFORM-SPECIFIC COMPONENTS (16 components)

These components have Electron/IPC dependencies and cannot be directly consolidated. However, they should be refactored to use hooks/abstraction.

#### Electron-Dependent Components

1. **AuditTrailView.tsx**
   - Audit log display
   - **Electron dependency:** window.electronAPI.invoke() for audit logs
   - **Refactor approach:** Create useAuditTrail() hook in lama.ui
   - **Status:** Move to lama.ui with hook-based data access

2. **AuditPanel.tsx** (audit/)
   - Audit panel component
   - **Electron dependency:** IPC calls for audit data
   - **Refactor approach:** Use useAuditTrail() hook

3. **AttestationStatus.tsx** (audit/)
   - Attestation status display
   - **Status:** Display only, move to lama.ui

4. **AuditorBadge.tsx** (audit/)
   - Badge showing auditor status
   - **Status:** Display only, move to lama.ui

5. **QRCodeDisplay.tsx** (audit/)
   - QR code rendering
   - **Dependencies:** qrcode.react library
   - **Status:** Can move to lama.ui (standard React component)

6. **MediaViewer.tsx** (media/)
   - Media viewing component
   - **Status:** Deprecated folder, may not be in use

7. **HorizontalTreeView.tsx** (ui/)
   - Tree view for horizontal layout
   - **Status:** UI primitive, move to lama.ui
   - **Note:** May already be referenced in lama.ui

#### Components with Minor IPC Dependencies

These have localized IPC calls that can be extracted to hooks:

8. **ChatHeader.tsx** (in lama.browser, NOT lama.ui version)
   - Export functionality using window.electronAPI
   - **Refactor:** Extract export logic to useExport() hook
   - **Status:** lama.ui version doesn't have export (Electron-specific)

9. **LoginScreen.tsx**
   - Has hardcoded test credentials
   - **Status:** Already in lama.ui, but Electron version has debug code

10. **AISettingsView.tsx**
    - AI model settings with Electron IPC
    - **Status:** Should consolidate with hook-based architecture

---

### DEPRECATED/UNUSED COMPONENTS (needs cleanup)

Located in deprecated folders:

1. **FeedForward/** - Status unknown, appears unused
2. **WorkerInit/** - Worker initialization, may be legacy
3. **media/** - Media handling, may be superseded by attachments/

---

## Consolidation Priority Matrix

### Tier 1: HIGH PRIORITY (Move immediately, no conflicts)
- 47 components identified as platform-agnostic
- No IPC dependencies or easily extractable
- Ready to move to lama.ui today

**Components:**
```
Dialog/Modal Components (8):
- GroupChatDialog.tsx
- UserSelectionDialog.tsx
- ProfileDialog.tsx
- PairingDialog.tsx
- InputDialog.tsx
- ObjectHierarchyDialog.tsx

View Components (7):
- ContactsView.tsx
- ConnectionsView.tsx
- JournalView.tsx
- InstancesView.tsx
- VerificationView.tsx
- SubjectChatView.tsx
- ObjectHierarchyView.tsx

Device/Trust Components (6):
- DeviceManager.tsx
- DeviceSetup.tsx
- DevicesView.tsx
- ChainOfTrustView.tsx
- PendingContacts.tsx
- ContactTrustStatus.tsx

Data Display Components (5):
- DataDashboard.tsx
- InvitationAcceptance.tsx
- SyncProgress.tsx
- StorageWarning.tsx
- InstanceManager.tsx

Settings Components (5):
- KeywordLineSettings.tsx
- KeywordSettingsPage.tsx
- SubscriptionSettings.tsx
- ProposalSettings.tsx
- DataCleanup.tsx

Utility Components (3):
- ConnectionStatus.tsx
- SubscriptionExport.tsx
- FaviconBadgeManager.tsx
- AppStateJournal.tsx
- ErrorBoundary.tsx
- MobileTabBar.tsx

Attachments (6) - Display logic is shared:
- ImageAttachmentView.tsx
- VideoAttachmentView.tsx
- AudioAttachmentView.tsx
- DocumentAttachmentView.tsx
- UnknownAttachmentView.tsx
- AttachmentViewFactory.tsx
```

### Tier 2: MEDIUM PRIORITY (Refactor first, then move)
Components with Electron dependencies that need hook extraction:

1. **AuditTrailView.tsx** → useAuditTrail()
2. **audit/** components → useAudit()
3. **ChatHeader.tsx (export)** → useExport()
4. **AISettingsView.tsx** → useAISettings()

### Tier 3: VERIFY/CLEANUP
- Deprecated folders (FeedForward, WorkerInit, media)
- Duplicate components already in lama.ui
- Components with unclear purpose

---

## Dependency Analysis

### Most Common Dependencies (Tier 1 components)

**UI Framework:**
- react, react-dom
- @lama/ui (already using, good sign)
- lucide-react (icons)

**Data Access (Platform-agnostic):**
- usePlans() hook from @lama/ui
- useModel() hook from lama.browser's context
- Model hooks (custom)

**Utilities:**
- marked (Markdown)
- react-markdown
- highlight.js
- DOMPurify
- react-swipeable
- tailwindcss-animate

**External Libraries:**
- @radix-ui/* (already in lama.ui)
- class-variance-authority
- clsx/tailwind-merge

### NO Direct Electron Imports (Good!)

Most Tier 1 components DON'T directly import:
- `electron` or `ipcRenderer`
- `window.electronAPI` (localized in few components)
- Node.js modules

This is excellent for consolidation!

---

## Migration Strategy

### Phase 1: Identify & Categorize (COMPLETE)
- All 87 components categorized
- Dependencies mapped
- Platform-specific code identified

### Phase 2: Consolidate Tier 1 (47 components)

**Steps:**
1. Create feature branches for each category
2. Copy components to lama.ui maintaining structure
3. Update imports (ensure @lama/ui references work)
4. Remove duplicates from lama.browser
5. Update lama.browser's imports to use @lama/ui
6. Test in both browser and cube contexts

**Timeline:** 2-3 sprints

### Phase 3: Refactor Tier 2 (4 components)

**Steps:**
1. Extract IPC logic to custom hooks
2. Create hook in lama.ui (e.g., useAuditTrail)
3. Inject implementation at platform level
4. Move component to lama.ui with hook dependency
5. Test across platforms

**Timeline:** 1-2 sprints

### Phase 4: Cleanup & Verification

**Steps:**
1. Remove deprecated folders
2. Verify no circular dependencies
3. Test full build in both contexts
4. Update exports in lama.ui/src/index.ts

---

## Component Export Organization (lama.ui)

### Current Structure
```
lama.ui/src/components/
├── chat/                    [13 files] - Chat UI components
├── KeywordDetail/           [5 files]  - Keyword management
├── TopicSummary/            [6 files]  - Topic analysis
├── settings/                [3 files]  - Settings pages
├── device/                  [4 files]  - Device/trust UI
├── journal/                 [3 files]  - Journal/export
├── ui/                      [15 files] - Primitives (buttons, cards, etc.)
├── LoginDeploy.tsx          - Login screen
├── MessageView.tsx          - Main message view
├── ParticipantAvatars.tsx   - Avatar display
├── ProposalCard.tsx         - Proposal display
└── ProposalCarousel.tsx     - Proposal carousel
```

### Proposed New Structure (After Consolidation)
```
lama.ui/src/components/
├── chat/                    [13 files] - Chat UI components
├── contacts/                [4 files]  - NEW: Contact management
│   ├── ContactsView.tsx
│   ├── UserSelectionDialog.tsx
│   ├── PendingContacts.tsx
│   └── ContactTrustStatus.tsx
├── device/                  [6 files]  - Device/trust UI
│   ├── DeviceManager.tsx
│   ├── DeviceSetup.tsx
│   ├── DevicesView.tsx
│   ├── ChainOfTrustView.tsx
│   ├── AssemblySupplyView.tsx
│   └── UnifiedDevicesView.tsx
├── dialogs/                 [6 files]  - NEW: Common dialogs
│   ├── GroupChatDialog.tsx
│   ├── ProfileDialog.tsx
│   ├── PairingDialog.tsx
│   ├── InputDialog.tsx
│   ├── ObjectHierarchyDialog.tsx
│   └── UserSelectionDialog.tsx (or move to contacts)
├── journal/                 [5 files]  - Journal/conversation export
│   ├── ConversationList.tsx
│   ├── ConversationCard.tsx
│   ├── ChatExport.tsx
│   ├── SubscriptionExport.tsx
│   └── JournalView.tsx
├── KeywordDetail/           [5 files]  - Keyword management
├── TopicSummary/            [6 files]  - Topic analysis
├── settings/                [8 files]  - Settings pages
│   ├── LLMSettings.tsx
│   ├── KeywordLineSettings.tsx
│   ├── KeywordSettingsPage.tsx
│   ├── SubscriptionSettings.tsx
│   ├── ProposalSettings.tsx
│   ├── MCPSettings.tsx
│   ├── StorageQuota.tsx
│   └── DataCleanup.tsx
├── ui/                      [15 files] - Primitives
├── LoginDeploy.tsx
├── MessageView.tsx
├── ParticipantAvatars.tsx
├── ProposalCard.tsx
├── ProposalCarousel.tsx
├── ChatView.tsx
├── ChatLayout.tsx
├── ConnectionsView.tsx
├── InstancesView.tsx
├── DataDashboard.tsx
├── VerificationView.tsx
├── ObjectHierarchyView.tsx
├── SubjectChatView.tsx
├── ErrorBoundary.tsx
├── MobileTabBar.tsx
├── SyncProgress.tsx
├── StorageWarning.tsx
├── ConnectionStatus.tsx
├── InstanceManager.tsx
├── FaviconBadgeManager.tsx
├── AppStateJournal.tsx
└── attachments/             [6 files]  - Attachment viewers
    ├── ImageAttachmentView.tsx
    ├── VideoAttachmentView.tsx
    ├── AudioAttachmentView.tsx
    ├── DocumentAttachmentView.tsx
    ├── UnknownAttachmentView.tsx
    └── AttachmentViewFactory.tsx
```

---

## Quick Reference: Component List by Path

### lama.browser Components Ready for Consolidation

**Total: 87 files**

```
Root Level (33):
AISettingsView.tsx
AppStateJournal.tsx
AuditTrailView.tsx
ChatLayout.tsx
ChatView.tsx
ConnectionStatus.tsx
ConnectionsView.tsx
ContactsView.tsx
ContactTrustStatus.tsx
DataDashboard.tsx
DeviceManager.tsx
DeviceSetup.tsx
DevicesView.tsx
ErrorBoundary.tsx
FaviconBadgeManager.tsx
GroupChatDialog.tsx
InputDialog.tsx
InstanceManager.tsx
InstancesView.tsx
InvitationAcceptance.tsx
JournalView.tsx
LoginScreen.tsx
MessageView.tsx
MobileTabBar.tsx
ObjectHierarchyDialog.tsx
ObjectHierarchyView.tsx
PairingDialog.tsx
ParticipantAvatars.tsx
PendingContacts.tsx
ProfileDialog.tsx
PurchaseView.tsx
SettingsView.tsx
StorageWarning.tsx
SubjectChatView.tsx
SubscriptionExport.tsx
SyncProgress.tsx
UserSelectionDialog.tsx
VerificationView.tsx
ChainOfTrustView.tsx

chat/ (13):
ChatContext.tsx
ChatHeader.tsx
EnhancedMessageBubble.tsx
EnhancedMessageInput.tsx
FormattedMessageContent.tsx
KeywordDisplay.tsx
KeywordLine.tsx
LLMErrorRecovery.tsx
MessageContextMenu.tsx
MessageHistory.tsx

attachments/ (6):
AttachmentViewFactory.tsx
AudioAttachmentView.tsx
DocumentAttachmentView.tsx
ImageAttachmentView.tsx
UnknownAttachmentView.tsx
VideoAttachmentView.tsx

audit/ (4):
AuditPanel.tsx
AuditorBadge.tsx
AttestationStatus.tsx
QRCodeDisplay.tsx

KeywordDetail/ (5):
AccessControlList.tsx
KeywordDetailPanel.tsx
SortControls.tsx
SubjectItem.tsx
SubjectList.tsx

Settings/ (8):
DataCleanup.tsx
KeywordLineSettings.tsx
KeywordSettingsPage.tsx
LLMSettings.tsx
MCPSettings.tsx
ProposalSettings.tsx
StorageQuota.tsx
SubscriptionSettings.tsx

TopicSummary/ (6):
index.tsx
KeywordCloud.tsx
SubjectList.tsx
SummaryHistory.tsx
TopicSummary.tsx
WordCloudSettings.tsx

ui/ (1):
HorizontalTreeView.tsx

ProposalCard.tsx
ProposalCarousel.tsx
```

---

## Key Takeaways

1. **47 of 87 components** (54%) are ready for immediate consolidation
2. **23 components** (26%) are already duplicated in lama.ui
3. **16 components** (18%) have Electron-specific code that needs refactoring
4. **Most components don't directly use Electron APIs** - good separation of concerns!
5. **Data access is already platform-agnostic** via hooks (usePlans, useModel)
6. **Attachment handlers have shared display logic** that should be in lama.ui
7. **Audit components can be refactored** to use hooks instead of direct IPC

---

## Next Steps

1. Create PR template for component consolidation
2. Establish code review checklist for:
   - Import path verification
   - Dependency validation
   - Hook usage patterns
   - CSS/styling consistency
3. Set up lama.ui build validation
4. Plan rollout schedule across teams
5. Create migration guide for dependent projects

