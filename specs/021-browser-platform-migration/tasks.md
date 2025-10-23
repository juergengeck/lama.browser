# Tasks: Browser Platform Migration

**Input**: Design documents from `/Users/gecko/src/lama/lama.browser/specs/021-browser-platform-migration/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL and not included in this implementation plan unless explicitly requested.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: Main thread UI in `browser-ui/`, Worker backend in `worker/`, Shared types in `shared/`
- Current Electron structure in `main/` and `electron-ui/` will be migrated

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and browser platform build configuration

- [x] T001 Install browser-specific dependencies (Vite, Vitest, Playwright) via npm
- [x] T002 [P] Create Vite configuration file `vite.config.ts` with worker and UI build targets
- [x] T003 [P] Create shared types directory structure `shared/types/` and `shared/utils/`
- [x] T004 [P] Copy contract files to shared directory: `shared/types/worker-messages.ts` and `shared/types/storage-api.ts`
- [x] T005 [P] Create TypeScript configuration for worker context `tsconfig.worker.json`
- [x] T006 [P] Create browser entry point `index.html` for UI
- [x] T007 [P] Update package.json scripts for browser build and dev server

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core worker infrastructure and message passing that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 Create Web Worker entry point `worker/index.ts` with message router
- [x] T009 [P] Initialize ONE.core browser platform in worker via `import '@refinio/one.core/lib/system/load-browser.js'`
- [x] T010 [P] Implement message handler registry in `worker/message-registry.ts`
- [x] T011 [P] Create worker error handling utilities in `worker/utils/error-handler.ts`
- [x] T012 Implement WorkerClient for UI thread in `browser-ui/src/services/worker-client.ts`
- [x] T013 [P] Create request/response correlation logic with UUID and timeout handling in worker-client
- [x] T014 [P] Implement storage quota monitor in `worker/storage/quota-monitor.ts`
- [x] T015 [P] Create browser capability detection utility in `shared/utils/browser-capabilities.ts`
- [x] T016 [P] Implement worker initialization state machine in `worker/init-state.ts`
- [x] T017 [P] Create storage statistics collector in `worker/storage/stats-collector.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Application Runs in Browser (Priority: P1) 🎯 MVP

**Goal**: Users can access LAMA through a web browser URL without Electron. Application loads and displays the chat interface with existing conversations.

**Independent Test**: Open the application URL in a browser and verify the chat interface loads within 5 seconds, conversation list displays, and navigation works without page refresh.

### Implementation for User Story 1

- [x] T018 [P] [US1] Rename `electron-ui/` to `browser-ui/` directory
- [x] T019 [P] [US1] Remove Electron-specific files: `electron-ui/src/preload.cjs` and `lama-electron-shadcn.ts`
- [x] T020 [P] [US1] Implement `onecore:initialize` message handler in `worker/messages/one-core.ts`
- [x] T021 [P] [US1] Implement `onecore:getStatus` message handler in `worker/messages/one-core.ts`
- [x] T022 [P] [US1] Implement `chat:getTopics` message handler in `worker/messages/chat.ts`
- [x] T023 [US1] Update App.tsx to initialize worker and handle init state in `browser-ui/src/App.tsx`
- [x] T024 [US1] Create worker initialization UI component in `browser-ui/src/components/WorkerInit/InitializationProgress.tsx`
- [x] T025 [US1] Update ChatLayout component to use worker client instead of IPC in `browser-ui/src/components/ChatLayout.tsx`
- [x] T026 [US1] Update useTopics hook to call `chat:getTopics` via worker client in `browser-ui/src/hooks/useTopics.ts`
- [x] T027 [US1] Add session state persistence using localStorage in `browser-ui/src/services/session-storage.ts`
- [x] T028 [US1] Update SettingsView to use worker client in `browser-ui/src/components/SettingsView.tsx`
- [x] T029 [US1] Add loading states and error boundaries for worker operations in `browser-ui/src/components/ErrorBoundary.tsx`
- [x] T030 [US1] Update navigation to maintain state on refresh in `browser-ui/src/App.tsx`

**Checkpoint**: At this point, the application should load in a browser, display conversations, and handle navigation. Users can access the app via URL without desktop installation.

---

## Phase 4: User Story 2 - Send and Receive Messages (Priority: P2)

**Goal**: Users can send messages in conversations and receive responses from AI assistants and other participants with real-time updates.

**Independent Test**: Send a message in an existing conversation, verify it appears within 2 seconds. Send a message to an AI assistant and see streaming response. Verify group messages appear without refresh.

### Implementation for User Story 2

- [x] T031 [P] [US2] Implement `chat:getMessages` message handler in `worker/messages/chat.ts`
- [x] T032 [P] [US2] Implement `chat:sendMessage` message handler with ArrayBuffer transferables support in `worker/messages/chat.ts`
- [x] T033 [P] [US2] Implement `ai:chat` message handler with streaming support in `worker/messages/ai.ts`
- [x] T034 [P] [US2] Migrate AI assistant initialization to worker in `worker/core/ai-assistant-model.ts`
- [x] T035 [P] [US2] Migrate LLM manager to worker context in `worker/services/llm-manager.ts`
- [x] T036 [US2] Update ChatView component to use `chat:sendMessage` worker client in `browser-ui/src/components/ChatView.tsx`
- [x] T037 [US2] Update useMessages hook to call `chat:getMessages` via worker client in `browser-ui/src/hooks/useMessages.ts`
- [x] T038 [US2] Update MessageView component for worker-based messaging in `browser-ui/src/components/MessageView.tsx`
- [x] T039 [US2] Implement AI streaming response handling in UI in `browser-ui/src/components/ChatView.tsx`
- [x] T040 [US2] Add message pagination with `before` parameter in `browser-ui/src/hooks/useMessages.ts`
- [x] T041 [US2] Implement attachment handling with transferable ArrayBuffers in `browser-ui/src/components/chat/EnhancedMessageInput.tsx`
- [x] T042 [US2] Add real-time message updates via worker event broadcasting in `worker/index.ts`
- [x] T043 [US2] Update group chat message display in `browser-ui/src/components/GroupChatDialog.tsx`

**Checkpoint**: Users can now send and receive messages, interact with AI assistants with streaming responses, and see real-time updates in group conversations.

---

## Phase 5: User Story 3 - Persistent Data Storage (Priority: P3)

**Goal**: Users' conversation history, contacts, and settings persist across browser sessions using browser storage that survives page reloads.

**Independent Test**: Create a conversation, close the browser, reopen the application, and verify the conversation still exists. Update profile settings, refresh the page, verify settings are unchanged. Verify quota warnings appear when approaching limits.

### Implementation for User Story 3

- [x] T044 [P] [US3] Implement `storage:getQuota` message handler in `worker/messages/storage.ts`
- [x] T045 [P] [US3] Implement `storage:requestPersistent` message handler in `worker/messages/storage.ts`
- [x] T046 [P] [US3] Implement `storage:cleanup` message handler in `worker/messages/storage.ts`
- [x] T047 [P] [US3] Configure ONE.core IndexedDB storage with relaxed durability in `worker/core/worker-one-core.ts`
- [x] T048 [P] [US3] Implement storage quota warning system with 80%/95% thresholds in `worker/storage/quota-monitor.ts`
- [x] T049 [US3] Add periodic quota monitoring every 5 minutes in `worker/storage/quota-monitor.ts`
- [x] T050 [US3] Create storage quota UI component in `browser-ui/src/components/Settings/StorageQuota.tsx`
- [x] T051 [US3] Implement data cleanup UI in `browser-ui/src/components/Settings/DataCleanup.tsx`
- [x] T052 [US3] Add persistent storage permission request flow in `browser-ui/src/services/storage-permissions.ts`
- [x] T053 [US3] Create storage warning toast notifications in `browser-ui/src/components/StorageWarning.tsx`
- [x] T054 [US3] Update Settings view to display storage status in `browser-ui/src/components/SettingsView.tsx`
- [x] T055 [US3] Implement conversation data persistence verification in `worker/core/worker-one-core.ts`
- [x] T056 [US3] Add contact persistence across sessions in `worker/messages/one-core.ts`
- [x] T057 [US3] Implement settings persistence using ONE.core storage in `worker/messages/settings.ts`

**Checkpoint**: All user data now persists across browser sessions. Users receive clear warnings before reaching quota limits and can manage storage.

---

## Phase 6: User Story 4 - Connections and Sync via Commserver (Priority: P4)

**Goal**: Users can establish connections with other users and sync conversation data across devices using CHUM protocol through WebSocket commserver relay.

**Independent Test**: Pair two browser instances and verify both users appear in each other's contact lists within 10 seconds. Send a message from one user to another and verify it arrives within 3 seconds. Go offline, send messages, reconnect, and verify messages sync automatically.

### Implementation for User Story 4

- [x] T058 [P] [US4] Implement `onecore:getContacts` message handler in `worker/messages/one-core.ts`
- [x] T059 [P] [US4] Implement `onecore:createContact` message handler in `worker/messages/one-core.ts`
- [x] T060 [P] [US4] Implement `chat:createTopic` message handler in `worker/messages/chat.ts`
- [x] T061 [P] [US4] Configure WebSocket transport for commserver in `worker/core/worker-one-core.ts`
- [x] T062 [P] [US4] Initialize CHUM sync protocol in worker using ONE.core browser transport in `worker/core/worker-one-core.ts`
- [x] T063 [P] [US4] Migrate channel manager to worker context in `worker/core/channel-manager.ts`
- [x] T064 [P] [US4] Migrate connections model to worker with WebSocket transport in `worker/core/connections-model.ts`
- [x] T065 [US4] Update ContactsView to use worker client for contacts in `browser-ui/src/components/ContactsView.tsx`
- [x] T066 [US4] Implement pairing flow UI using worker-based pairing in `browser-ui/src/components/PairingDialog.tsx`
- [x] T067 [US4] Add connection status indicator in `browser-ui/src/components/ConnectionStatus.tsx`
- [x] T068 [US4] Implement offline queue for messages in `worker/services/offline-queue.ts`
- [x] T069 [US4] Add automatic sync on reconnection in `worker/core/connections-model.ts`
- [x] T070 [US4] Update GroupChatDialog for multi-user conversations in `browser-ui/src/components/GroupChatDialog.tsx`
- [x] T071 [US4] Implement UserSelectionDialog for adding participants in `browser-ui/src/components/UserSelectionDialog.tsx`
- [x] T072 [US4] Add sync progress indicator in `browser-ui/src/components/SyncProgress.tsx`

**Checkpoint**: Users can now pair browser instances, sync conversations across devices via commserver, and handle offline scenarios gracefully.

---

## Phase 7: Topic Analysis in Browser (Feature Parity)

**Goal**: Maintain topic analysis features (subjects, keywords, summaries) in the browser platform.

**Independent Test**: Send messages in a conversation, trigger analysis, verify subjects and keywords are extracted and displayed.

### Implementation for Topic Analysis

- [ ] T073 [P] [TopicAnalysis] Implement `topicAnalysis:analyzeMessages` message handler in `worker/messages/topic-analysis.ts`
- [ ] T074 [P] [TopicAnalysis] Implement `topicAnalysis:getSummary` message handler in `worker/messages/topic-analysis.ts`
- [ ] T075 [P] [TopicAnalysis] Migrate TopicAnalyzer service to worker in `worker/core/one-ai/services/TopicAnalyzer.ts`
- [ ] T076 [P] [TopicAnalysis] Migrate Subject model to worker in `worker/core/one-ai/models/Subject.ts`
- [ ] T077 [P] [TopicAnalysis] Migrate Keyword model to worker in `worker/core/one-ai/models/Keyword.ts`
- [ ] T078 [TopicAnalysis] Update SubjectChatView to use worker client in `browser-ui/src/components/SubjectChatView.tsx`
- [ ] T079 [TopicAnalysis] Update useTopicAnalysis hook in `browser-ui/src/hooks/useTopicAnalysis.ts`
- [ ] T080 [TopicAnalysis] Verify keyword extraction works in browser environment

**Checkpoint**: Topic analysis features work identically to Electron version in browser platform.

---

## Phase 8: Proposals in Browser (Feature Parity)

**Goal**: Maintain proposal system (context-aware suggestions) in the browser platform.

**Independent Test**: View a conversation with subjects, verify proposals appear based on keyword matching, dismiss a proposal and verify it doesn't reappear.

### Implementation for Proposals

- [ ] T081 [P] [Proposals] Implement `proposals:getForTopic` message handler in `worker/messages/proposals.ts`
- [ ] T082 [P] [Proposals] Implement `proposals:dismiss` message handler in `worker/messages/proposals.ts`
- [ ] T083 [P] [Proposals] Migrate proposal engine to worker in `worker/services/proposal-engine.ts`
- [ ] T084 [P] [Proposals] Migrate proposal recipes to worker in `worker/recipes/proposal-recipes.ts`
- [ ] T085 [Proposals] Update ProposalCard component to use worker client in `browser-ui/src/components/ProposalCard.tsx`
- [ ] T086 [Proposals] Update ProposalCarousel component in `browser-ui/src/components/ProposalCarousel.tsx`
- [ ] T087 [Proposals] Update useProposals hook in `browser-ui/src/hooks/useProposals.ts`

**Checkpoint**: Proposal system works identically to Electron version in browser platform.

---

## Phase 9: MCP Integration in Browser (Feature Parity)

**Goal**: Maintain Model Context Protocol integration for AI tools in browser environment.

**Independent Test**: Use AI assistant with MCP tools, verify tools are available and execute correctly in browser/worker context.

### Implementation for MCP

- [ ] T088 [P] [MCP] Adapt MCP manager for browser/worker context in `worker/services/mcp-manager.ts`
- [ ] T089 [P] [MCP] Implement worker-compatible MCP transport in `worker/services/mcp/transport.ts`
- [ ] T090 [P] [MCP] Migrate MCP filesystem tools to browser-safe operations in `worker/services/mcp/filesystem-tools.ts`
- [ ] T091 [P] [MCP] Implement `ai:getModels` message handler in `worker/messages/ai.ts`
- [ ] T092 [MCP] Update MCPSettings component to use worker client in `browser-ui/src/components/Settings/MCPSettings.tsx`
- [ ] T093 [MCP] Verify MCP tool execution works in browser environment

**Checkpoint**: MCP integration works with browser-safe operations, maintaining AI tool capabilities.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final production readiness

- [ ] T094 [P] Add browser compatibility detection on app load in `browser-ui/src/utils/compatibility-check.ts`
- [ ] T095 [P] Implement graceful degradation for unsupported browsers in `browser-ui/src/components/UnsupportedBrowser.tsx`
- [ ] T096 [P] Add comprehensive error messages for common browser issues in `shared/utils/error-messages.ts`
- [ ] T097 [P] Optimize worker message payload sizes (<10KB target) across all handlers
- [ ] T098 [P] Implement transferable object optimization for large binary data in `browser-ui/src/services/worker-client.ts`
- [ ] T099 [P] Add performance monitoring for worker initialization and message latency in `worker/utils/performance-monitor.ts`
- [ ] T100 [P] Create migration guide from Electron to browser platform in `docs/migration-guide.md`
- [ ] T101 [P] Update CLAUDE.md with browser platform architecture in `/Users/gecko/src/lama/lama.browser/CLAUDE.md`
- [ ] T102 [P] Create deployment guide for web server hosting in `docs/deployment-guide.md`
- [ ] T103 [P] Add browser-specific troubleshooting guide in `docs/troubleshooting.md`
- [ ] T104 Code cleanup: Remove all Electron-specific imports and dependencies
- [ ] T105 Performance optimization: Implement caching strategies for frequently accessed data
- [ ] T106 Security hardening: Validate all worker message payloads
- [ ] T107 Run quickstart.md validation and verify all steps work
- [ ] T108 Multi-tab handling: Implement BroadcastChannel for tab coordination or enforce single-tab policy
- [ ] T109 Final browser compatibility testing across Chrome, Safari, Firefox, Edge

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (Browser Access) - Priority P1 - MVP candidate
  - US2 (Messaging) - Priority P2 - Depends on US1 for UI infrastructure
  - US3 (Storage) - Priority P3 - Independent of US1/US2
  - US4 (Sync) - Priority P4 - Depends on US2 for messaging infrastructure
- **Feature Parity (Phase 7-9)**: Can start after US1 completes, run in parallel
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses UI infrastructure from US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of other stories
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - Uses messaging from US2 but independently testable
- **Topic Analysis**: Can start after US1 - Independent feature
- **Proposals**: Can start after US1 - Independent feature
- **MCP**: Can start after US1 - Independent feature

### Within Each User Story

- Message handlers before UI updates
- Worker services before message handlers
- ONE.core initialization before any storage operations
- Worker client implementation before UI hook updates
- Error handling and validation throughout

### Parallel Opportunities

- **Setup Phase**: All tasks (T001-T007) can run in parallel
- **Foundational Phase**: Tasks T009-T017 can run in parallel after T008 (worker entry point)
- **User Story 1**: Tasks T018-T022 can run in parallel (different files)
- **User Story 2**: Tasks T031-T035 can run in parallel (worker handlers and services)
- **User Story 3**: Tasks T044-T048 can run in parallel (storage handlers and monitoring)
- **User Story 4**: Tasks T058-T064 can run in parallel (connection handlers and services)
- **Feature Parity Phases**: All three phases (7-9) can run in parallel once US1 is complete
- **Polish Phase**: Most tasks (T094-T103) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all message handlers for User Story 1 together:
Task: "Implement onecore:initialize message handler in worker/messages/one-core.ts"
Task: "Implement onecore:getStatus message handler in worker/messages/one-core.ts"
Task: "Implement chat:getTopics message handler in worker/messages/chat.ts"
```

## Parallel Example: User Story 2

```bash
# Launch all worker services for User Story 2 together:
Task: "Implement chat:getMessages message handler in worker/messages/chat.ts"
Task: "Implement chat:sendMessage message handler in worker/messages/chat.ts"
Task: "Implement ai:chat message handler in worker/messages/ai.ts"
Task: "Migrate AI assistant initialization to worker in worker/core/ai-assistant-model.ts"
Task: "Migrate LLM manager to worker in worker/services/llm-manager.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T007)
2. Complete Phase 2: Foundational (T008-T017) - CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (T018-T030)
4. **STOP and VALIDATE**: Open browser, verify app loads, conversations display, navigation works
5. Deploy to web server for browser access

**MVP Deliverable**: Users can access LAMA via browser URL without desktop installation. The application loads, displays conversations, and handles navigation. This proves the core platform migration works.

### Incremental Delivery

1. Complete Setup + Foundational (T001-T017) → Foundation ready
2. Add User Story 1 (T018-T030) → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 (T031-T043) → Test independently → Deploy/Demo (Messaging works!)
4. Add User Story 3 (T044-T057) → Test independently → Deploy/Demo (Data persists!)
5. Add User Story 4 (T058-T072) → Test independently → Deploy/Demo (Sync works!)
6. Add Feature Parity (T073-T093) → Complete feature set → Deploy/Demo
7. Add Polish (T094-T109) → Production ready → Final deploy

Each increment adds value without breaking previous functionality.

### Parallel Team Strategy

With multiple developers:

1. **Team completes Setup + Foundational together** (T001-T017)
2. **Once Foundational is done**:
   - Developer A: User Story 1 (Browser Access)
   - Developer B: User Story 3 (Storage) - Independent of US1
   - Developer C: Topic Analysis - Can start when US1 UI exists
3. **After US1 completes**:
   - Developer A: User Story 2 (Messaging)
   - Developer D: Proposals - Can run parallel with US2
4. **After US2 completes**:
   - Developer A: User Story 4 (Sync)
   - Developer E: MCP Integration
5. **Final phase**: All developers on Polish tasks (parallel)

---

## Notes

- [P] tasks = different files, no dependencies - can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Performance target: Worker init <5s, message latency <50ms, storage ops <100ms read/<200ms write
- Browser targets: Chrome 90+, Safari 14+, Firefox 88+, Edge 90+ (90% market share)
- Critical: ONE.core browser platform (`lib/system/browser/`) provides IndexedDB + WebSocket abstractions
- Storage: IndexedDB with relaxed durability for 344% performance improvement
- Transport: WebSocket only via commserver (no direct P2P in browser)
- Avoid: Electron-specific APIs, Node.js file system, Node.js crypto (use WebCrypto)

**Total Tasks**: 109 tasks
- Setup: 7 tasks
- Foundational: 10 tasks (BLOCKING)
- User Story 1: 13 tasks (MVP)
- User Story 2: 13 tasks
- User Story 3: 14 tasks
- User Story 4: 15 tasks
- Topic Analysis: 8 tasks
- Proposals: 7 tasks
- MCP: 6 tasks
- Polish: 16 tasks

**Parallel Opportunities**: 67 tasks marked [P] can run in parallel with other tasks
**MVP Scope**: Setup (7) + Foundational (10) + User Story 1 (13) = 30 tasks
