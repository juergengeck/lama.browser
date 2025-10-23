# Feature Specification: Browser Platform Migration

**Feature Branch**: `021-browser-platform-migration`
**Created**: 2025-10-18
**Status**: Draft
**Input**: User description: "we migrate this eclipse project to the browser platform. what is running in nodejs must run in a worker, using one.core browser platform support instead of nodejs"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Application Runs in Browser (Priority: P1)

Users access the LAMA application through a web browser without requiring Electron desktop installation. The application runs entirely in the browser environment with full functionality.

**Why this priority**: This is the core migration requirement. Without this, the feature cannot exist. It establishes the foundation for all other capabilities.

**Independent Test**: Can be fully tested by opening the application URL in a browser and verifying that the chat interface loads and displays existing conversations. Delivers browser accessibility without desktop installation.

**Acceptance Scenarios**:

1. **Given** a user has access to the application URL, **When** they open it in a supported browser, **Then** the application loads and displays the chat interface within 5 seconds
2. **Given** the application is running in a browser, **When** the user navigates between conversations, **Then** all conversation history displays correctly with proper formatting
3. **Given** the application is running in a browser, **When** the user refreshes the page, **Then** their session state persists and they remain on the same conversation

---

### User Story 2 - Send and Receive Messages (Priority: P2)

Users can send messages in conversations and receive responses from AI assistants and other participants. All message operations work in the browser environment without loss of functionality.

**Why this priority**: This validates core chat functionality in the new platform. Users can interact with the system but depends on P1 (application running).

**Independent Test**: Can be fully tested by sending a message in an existing conversation and receiving a response. Delivers the primary user interaction capability.

**Acceptance Scenarios**:

1. **Given** a user is viewing a conversation, **When** they type and send a message, **Then** the message appears in the chat history within 2 seconds
2. **Given** a user sends a message to an AI assistant, **When** the AI processes the message, **Then** the user sees the AI response appear in real-time (streaming)
3. **Given** a user is in a group conversation, **When** another participant sends a message, **Then** the message appears in all participants' views without requiring page refresh

---

### User Story 3 - Persistent Data Storage (Priority: P3)

Users' conversation history, contacts, and settings persist across browser sessions. Data stored in browser storage mechanisms remains available after closing and reopening the application.

**Why this priority**: Ensures user data isn't lost between sessions. Important for usability but the application can function without it initially (data could exist only in memory for testing).

**Independent Test**: Can be fully tested by creating a conversation, closing the browser, reopening the application, and verifying the conversation still exists. Delivers data persistence.

**Acceptance Scenarios**:

1. **Given** a user has existing conversations, **When** they close and reopen the browser, **Then** all conversations appear in the conversation list
2. **Given** a user updates their profile settings, **When** they refresh the page, **Then** their settings remain unchanged
3. **Given** a user's browser storage reaches capacity limits, **Then** the system displays a clear warning and prevents data loss

---

### User Story 4 - Connections and Sync via Commserver (Priority: P4)

Users can establish connections with other users and sync conversation data across devices. The CHUM sync protocol operates through the existing commserver relay using browser-compatible WebSocket connections.

**Why this priority**: Enables the decentralized nature of the platform in browsers. Lower priority because users can use the application without P2P initially (single-user mode works).

**Independent Test**: Can be fully tested by pairing two browser instances and sending messages between them. Delivers multi-user functionality.

**Acceptance Scenarios**:

1. **Given** two users want to connect, **When** they complete the pairing process, **Then** both users appear in each other's contact lists within 10 seconds
2. **Given** two paired users, **When** one user sends a message, **Then** the other user receives it within 3 seconds
3. **Given** a user is offline, **When** they reconnect to the internet, **Then** all messages sent while offline sync automatically

---

### Edge Cases

- What happens when browser storage quota is exceeded? System must gracefully handle storage limits and notify users before data loss occurs
- How does system handle browsers with strict security policies (CSP, CORP)? Application must degrade gracefully or display clear compatibility warnings
- What happens when Web Workers are not supported? System must detect capability and either use fallback or notify user of incompatibility
- How does system handle concurrent sessions in multiple tabs? Data consistency must be maintained across tabs or one-tab-only policy enforced
- What happens during long-running worker operations when user closes the tab? Critical operations must complete or be safely aborted
- How does system handle browser extensions that block worker-based storage? Clear error messages must guide users to resolve conflicts

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST run the complete ONE.core instance inside a Web Worker using ONE.core's browser platform support
- **FR-002**: System MUST persist all user data (conversations, contacts, settings) using browser storage mechanisms that survive page reloads
- **FR-003**: System MUST maintain all existing application features (chat, AI assistants, topic analysis, proposals) in the browser environment
- **FR-004**: System MUST communicate between the main browser thread (UI) and Web Worker using message passing for all ONE.core operations
- **FR-005**: System MUST handle browser storage quota limits gracefully without data corruption or loss
- **FR-006**: System MUST support the same authentication flows as the current Electron application
- **FR-007**: System MUST enable connections between browser instances using WebSocket connections to the existing commserver relay
- **FR-008**: System MUST synchronize data between peers using the existing CHUM protocol over commserver WebSocket transport
- **FR-009**: System MUST load and initialize within 10 seconds on first visit and within 3 seconds on subsequent visits
- **FR-010**: System MUST display clear error messages when browser capabilities are insufficient for core functionality
- **FR-011**: System MUST maintain data consistency when the same user opens multiple browser tabs
- **FR-012**: System MUST support import/export of user data for backup and migration purposes

### Key Entities *(include if feature involves data)*

- **Web Worker Instance**: Executes the ONE.core instance using browser platform APIs, isolated from the main UI thread, handles all data operations and storage management

- **Browser Storage**: Persistent storage layer using ONE.core's built-in IndexedDB support, stores versioned objects, BLOBs, and version graphs

- **Message Channel**: Bidirectional communication channel between UI thread and Web Worker, handles IPC-style requests and responses for all ONE.core operations

- **Browser Platform**: ONE.core's browser platform implementation (from local `./packages/one.core/lib/system/browser`) providing IndexedDB storage and WebSocket transport

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can access and use the full application through a web browser URL without installing desktop software
- **SC-002**: Application loads and displays the chat interface within 5 seconds on first visit
- **SC-003**: Application loads and displays the chat interface within 3 seconds on subsequent visits (with cached data)
- **SC-004**: All existing features (messaging, AI assistants, topic analysis, proposals, contacts, settings) function identically to the Electron version
- **SC-005**: User data persists across browser sessions with 100% consistency (no data loss on refresh or restart)
- **SC-006**: Messages between peers sync within 3 seconds on stable connections
- **SC-007**: System supports at least 1000 messages per conversation without performance degradation
- **SC-008**: System operates correctly in browsers with at least 90% market share (Chrome, Safari, Firefox, Edge)
- **SC-009**: Application functions offline with queued sync when connection restored
- **SC-010**: Users receive clear actionable error messages when browser capabilities are insufficient (within 2 seconds of detection)

## Scope *(mandatory)*

### In Scope

- Migration of ALL Node.js-based ONE.core functionality to Web Worker using ONE.core's browser platform
- Complete UI functionality running in browser main thread (React components, chat interface, settings)
- Use ONE.core's built-in IndexedDB storage for all data structures (objects, BLOBs, version graphs)
- Message-passing architecture between UI thread and Web Worker replacing current IPC
- Use ONE.core's built-in WebSocket transport with existing commserver relay
- CHUM sync protocol over commserver (same as current Electron implementation)
- Authentication and session management in browser context
- Browser storage quota management and user notifications
- Multi-tab handling and data consistency
- Data import/export for backup and migration
- Error handling for unsupported browsers

### Out of Scope

- Native desktop capabilities requiring OS integration (notifications may be limited to browser APIs)
- File system access beyond browser storage APIs (no direct file path access)
- Backward compatibility with data formats from Electron version (migration tool may be separate feature)
- Support for browsers outside the top 90% market share
- Mobile-optimized responsive UI (desktop browser focus initially)
- Offline-first optimizations beyond basic caching
- Server-side rendering or progressive web app (PWA) features
- Cross-browser sync (each browser instance is independent unless explicitly paired)

## Dependencies *(optional)*

### Technical Dependencies

- ONE.core browser platform abstractions (local package: `./packages/one.core`, path: `lib/system/browser`) providing IndexedDB storage and WebSocket transport
- ONE.models (local package: `./packages/one.models`) for data models and recipes
- Web Worker API must be available and not blocked by browser security policies
- IndexedDB API must be available with sufficient quota (used by ONE.core browser storage)
- Browser must support modern JavaScript features (ES2020+, async/await, modules in workers)
- WebSocket API must be available (used by ONE.core browser transport)

### External Dependencies

- Existing CHUM sync protocol must be transport-agnostic (already specified in architecture)
- Local ONE.core package (`./packages/one.core`) must be buildable for browser/worker context
- Local ONE.models package (`./packages/one.models`) must be buildable for browser/worker context
- Current React UI components must be compatible with browser build tools (Vite or similar)
- Commserver relay must be accessible from browser environments (CORS, WSS support)

### Assumptions

- ONE.core's browser platform (IndexedDB + WebSocket) provides equivalent functionality to Node.js platform
- ONE.core's existing browser storage and transport implementations are production-ready
- Browser storage quotas are sufficient for typical usage patterns (assumption: at least 50MB available)
- Users accept browser-based storage limitations compared to unlimited file system storage
- Modern browsers (released within last 2 years) are the primary target
- Commserver relay infrastructure is already deployed and accessible from browsers
- Users have JavaScript enabled and do not block Web Workers
- Same-origin policy restrictions are acceptable (app served from single domain)

## Non-Functional Requirements *(optional)*

### Performance

- ONE.core initialization in Web Worker: Under 5 seconds on first load
- Message passing latency between UI and Worker: Under 50ms for typical operations
- Storage read operations: Under 100ms for individual objects
- Storage write operations: Under 200ms for typical versioned objects
- UI remains responsive during background worker operations (no blocking)

### Security

- All data stored in browser storage must use browser's built-in encryption capabilities
- Worker must operate in isolated context preventing direct DOM access
- Message passing must validate message types and sanitize inputs
- Commserver connections must use secure WebSocket (WSS) for encrypted transport
- Authentication tokens must be stored securely using browser secure storage APIs

### Compatibility

- Support browsers with at least 90% combined market share
- Graceful degradation for browsers with limited Web Worker capabilities
- Clear compatibility warnings displayed before application initialization
- Progressive enhancement approach for optional features

### Maintainability

- Clear separation between UI thread and Worker thread code
- Shared type definitions between UI and Worker contexts
- Comprehensive error logging in Worker context accessible for debugging
- Migration path documented for future platform changes

## Risks *(optional)*

### High Risk

- **Browser storage quota limitations**: Different browsers have different quota policies. Some users may hit limits with large conversation histories.
  - *Mitigation*: Implement storage monitoring, archival features, and clear user warnings at 80% quota usage

- **Web Worker compatibility**: Some browsers or security policies may block or limit Web Workers.
  - *Mitigation*: Early compatibility detection, clear error messages, maintain fallback documentation

- **Performance degradation**: Browser storage operations may be slower than Node.js file system, especially for large datasets.
  - *Mitigation*: Implement caching strategies, lazy loading, and performance monitoring

### Medium Risk

- **Multi-tab data consistency**: Concurrent operations from multiple tabs could cause race conditions or data conflicts.
  - *Mitigation*: Implement tab coordination using BroadcastChannel API or shared worker, or enforce single-tab policy

- **Commserver connectivity**: WebSocket connections may fail due to firewalls, corporate proxies, or restrictive network policies.
  - *Mitigation*: Document network requirements (WSS port access), provide clear error messages for connection failures

### Low Risk

- **Third-party library compatibility**: Some Node.js libraries may not work in browser/worker context.
  - *Mitigation*: Audit dependencies early, find browser-compatible alternatives or polyfills

## Open Questions *(optional)*

None - all critical decisions have reasonable defaults based on browser platform capabilities and industry standards. Any uncertainties will be addressed during implementation planning.
