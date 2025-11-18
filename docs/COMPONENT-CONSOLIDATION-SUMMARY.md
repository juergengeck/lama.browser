# Component Consolidation Summary - Quick Reference

## By Category

| Category | Count | Status | Action |
|----------|-------|--------|--------|
| Chat Components | 13 | DUPLICATED | Remove lama.browser copies |
| TopicSummary | 6 | DUPLICATED | Remove lama.browser copies |
| KeywordDetail | 5 | DUPLICATED | Remove lama.browser copies |
| Dialogs | 6 | SHOULD CONSOLIDATE | Move to lama.ui |
| Views | 7 | SHOULD CONSOLIDATE | Move to lama.ui |
| Device/Trust | 6 | SHOULD CONSOLIDATE | Move to lama.ui |
| Settings | 8 | MIXED | Move all to lama.ui |
| Attachments | 6 | SHOULD CONSOLIDATE | Move to lama.ui |
| Audit | 4 | ELECTRON-SPECIFIC | Refactor with hooks |
| Utilities | 10 | SHOULD CONSOLIDATE | Move to lama.ui |
| Root Level | 3 | MIXED | Evaluate each |
| **TOTAL** | **87** | | |

## By Status

| Status | Count | % | Action |
|--------|-------|---|--------|
| Already in lama.ui (duplicates) | 23 | 26% | Delete from lama.browser |
| Ready to consolidate | 47 | 54% | Move to lama.ui |
| Platform-specific (needs refactor) | 16 | 18% | Create hooks, then move |
| Deprecated/Unused | 1+ | ? | Remove |
| **TOTAL** | **87** | 100% | |

## Key Metrics

### Import Dependencies
- **@lama/ui**: 30 components already use it (good!)
- **lucide-react**: 40+ components
- **useModel()**: 8 components
- **usePlans()**: 12 components
- **window.electronAPI**: 16 components (Electron-specific)

### Component Reusability
- **Completely platform-agnostic**: 47 (54%)
- **Minor IPC dependencies**: 8 (9%)
- **Major IPC dependencies**: 8 (9%)
- **Already in lama.ui**: 23 (26%)

### Consolidation Effort

**Tier 1 (No refactoring needed)**: 47 components
- Effort: Copy → Update imports → Test
- Time: 2-3 sprints
- Risk: LOW

**Tier 2 (Needs hook extraction)**: 4 components
- Effort: Extract logic → Create hook → Move component
- Time: 1-2 sprints
- Risk: MEDIUM

**Tier 3 (Cleanup)**: Deprecated folders
- Effort: Review → Delete
- Time: 1 sprint
- Risk: LOW

---

## Components by Directory

### Root Level (39 components)

**Chat-Related (3)**
- ChatLayout.tsx - Layout container
- ChatView.tsx - Full chat view
- MessageView.tsx - Message display container

**Dialog/Modal (6)**
- GroupChatDialog.tsx
- UserSelectionDialog.tsx
- ProfileDialog.tsx
- PairingDialog.tsx
- InputDialog.tsx
- ObjectHierarchyDialog.tsx

**View Components (7)**
- ContactsView.tsx
- ConnectionsView.tsx
- JournalView.tsx
- InstancesView.tsx
- VerificationView.tsx
- SubjectChatView.tsx
- ObjectHierarchyView.tsx

**Device/Trust (6)**
- DeviceManager.tsx
- DeviceSetup.tsx
- DevicesView.tsx
- ChainOfTrustView.tsx
- ContactTrustStatus.tsx
- PendingContacts.tsx

**Settings (2)**
- SettingsView.tsx (container)
- AISettingsView.tsx

**Utilities (9)**
- ParticipantAvatars.tsx ★ (already in lama.ui)
- ProposalCard.tsx ★ (already in lama.ui)
- ProposalCarousel.tsx ★ (already in lama.ui)
- ConnectionStatus.tsx
- SyncProgress.tsx
- StorageWarning.tsx
- InstanceManager.tsx
- ErrorBoundary.tsx
- MobileTabBar.tsx
- FaviconBadgeManager.tsx
- AppStateJournal.tsx
- SubscriptionExport.tsx

**Other (2)**
- LoginScreen.tsx ★ (already in lama.ui)
- AuditTrailView.tsx ⚠️ (Electron-specific)
- DataDashboard.tsx
- InvitationAcceptance.tsx
- PurchaseView.tsx

### chat/ (13 files)

All already in lama.ui/src/components/chat/

★ = Already consolidated (duplicate)
⚠️ = Has Electron dependencies
✓ = Ready to consolidate

- ChatContext.tsx ★
- ChatHeader.tsx ★
- EnhancedMessageBubble.tsx ★
- EnhancedMessageInput.tsx ★
- FormattedMessageContent.tsx ★
- KeywordDisplay.tsx ★
- KeywordLine.tsx ★
- LLMErrorRecovery.tsx ★
- MessageContextMenu.tsx ★
- MessageHistory.tsx ★

### TopicSummary/ (6 files)

All already in lama.ui/src/components/TopicSummary/

- index.tsx ★
- TopicSummary.tsx ★
- SubjectList.tsx ★
- KeywordCloud.tsx ★
- SummaryHistory.tsx ★
- WordCloudSettings.tsx ★

### KeywordDetail/ (5 files)

All already in lama.ui/src/components/KeywordDetail/

- KeywordDetailPanel.tsx ★
- SubjectList.tsx ★
- SubjectItem.tsx ★
- AccessControlList.tsx ★
- SortControls.tsx ★

### Settings/ (8 files)

Mixed status, most should consolidate

- LLMSettings.tsx (partially in lama.ui/settings/)
- KeywordLineSettings.tsx ✓
- KeywordSettingsPage.tsx ✓
- SubscriptionSettings.tsx ✓
- ProposalSettings.tsx ✓
- MCPSettings.tsx ✓
- StorageQuota.tsx ✓
- DataCleanup.tsx ✓

### attachments/ (6 files)

Display logic is platform-agnostic

- AttachmentViewFactory.tsx ✓
- ImageAttachmentView.tsx ✓
- VideoAttachmentView.tsx ✓
- AudioAttachmentView.tsx ✓
- DocumentAttachmentView.tsx ✓
- UnknownAttachmentView.tsx ✓

### audit/ (4 files)

IPC-dependent, needs hook abstraction

- AuditPanel.tsx ⚠️
- AuditTrailView.tsx ⚠️
- AttestationStatus.tsx ✓ (display only)
- AuditorBadge.tsx ✓ (display only)
- QRCodeDisplay.tsx ✓

### ui/ (1 file)

- HorizontalTreeView.tsx ✓ (or already in lama.ui)

### Deprecated Folders (TBD)

- FeedForward/ - Status unclear
- WorkerInit/ - Likely legacy
- media/ - Superseded by attachments/

---

## Migration Checklist

### Pre-Migration
- [ ] Review all 87 components
- [ ] Identify all import dependencies
- [ ] Document Electron API usage patterns
- [ ] Plan hook extraction for Tier 2

### Tier 1 Migration (47 components)

For each component:
- [ ] Copy to lama.ui/src/components/{category}/
- [ ] Update all import paths
- [ ] Verify @lama/ui imports work
- [ ] Test component in isolation
- [ ] Remove from lama.browser
- [ ] Update lama.browser imports to use @lama/ui

Verify:
- [ ] No circular dependencies
- [ ] All exports added to lama.ui/src/index.ts
- [ ] Build succeeds in both projects
- [ ] Tests pass

### Tier 2 Migration (4-8 components with hooks)

For each component:
- [ ] Identify IPC calls
- [ ] Create custom hook (e.g., useAuditTrail)
- [ ] Move hook to lama.ui/src/hooks/
- [ ] Implement hook in browser context
- [ ] Move component to lama.ui
- [ ] Test with hook provider

### Post-Migration Cleanup

- [ ] Remove deprecated folders
- [ ] Remove duplicate components from lama.browser
- [ ] Update all import statements
- [ ] Run full test suite
- [ ] Verify builds in all platforms (browser, cube, etc.)
- [ ] Update documentation

---

## Common Issues & Solutions

### Issue: "Module not found" after moving component
**Solution**: Update import paths. Components may use:
```
import { usePlans } from '@lama/ui'  // Works from lama.ui
import { useModel } from '@/model'   // Won't work from lama.ui
```

### Issue: Circular dependencies
**Solution**: Avoid:
- Components importing from model/
- Hooks importing components
- Cross-folder circular imports

Keep hooks in `/hooks`, components in `/components`

### Issue: Electron API not available
**Solution**: If component uses window.electronAPI:
1. Extract to custom hook (e.g., useExport())
2. Move hook to lama.ui/src/hooks/
3. Provide implementation at platform level
4. Component stays platform-agnostic

### Issue: CSS not being imported
**Solution**: Ensure CSS files are also copied:
- EnhancedMessageInput.tsx → EnhancedMessageInput.css
- MessageView.tsx → MessageView.css
- Check all .css imports in components

---

## Success Metrics

After consolidation:
- [ ] 87 components organized in lama.ui
- [ ] lama.browser has ZERO component duplicates
- [ ] Zero circular dependencies
- [ ] All builds pass (browser, cube, etc.)
- [ ] Component exports documented
- [ ] Migration guide updated
- [ ] Team trained on new structure

