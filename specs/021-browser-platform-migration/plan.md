# Implementation Plan: Browser Platform Migration

**Branch**: `021-browser-platform-migration` | **Date**: 2025-10-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/gecko/src/lama/lama.browser/specs/021-browser-platform-migration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Migrate the LAMA application from Electron (Node.js-based) to a pure browser platform. The core requirement is to move all Node.js ONE.core functionality into Web Workers using ONE.core's built-in browser platform support (IndexedDB storage + WebSocket transport). The UI continues to run in the main browser thread using React, with message-passing replacing the current Electron IPC architecture. This enables users to access the full LAMA application through a browser URL without desktop installation, while maintaining all existing features (chat, AI assistants, topic analysis, proposals, connections via commserver).

## Technical Context

**Language/Version**: TypeScript 5.7+, JavaScript ES2020+ (browser + worker context)
**Primary Dependencies**:
- ONE.core browser platform (local: `./packages/one.core/lib/system/browser`)
- ONE.models (local: `./packages/one.models`)
- React 18+ (UI framework, main thread only)
- Vite 5+ (build tool for browser targets)
- @modelcontextprotocol/sdk (AI integration)
- Anthropic SDK (AI providers)

**Storage**: IndexedDB via ONE.core's browser storage abstraction (replaces Node.js file system)
**Testing**: Vitest (browser-compatible test runner), Playwright (E2E browser tests)
**Target Platform**: Modern browsers (Chrome 90+, Safari 14+, Firefox 88+, Edge 90+) - minimum 90% market share
**Project Type**: Web application (main thread UI + Web Worker backend)
**Performance Goals**:
- First load: <5s ONE.core initialization in worker
- Subsequent loads: <3s with cached data
- Message passing: <50ms UI↔Worker latency
- Storage ops: <100ms read, <200ms write

**Constraints**:
- Browser storage quota (varies by browser, typically 10-50GB)
- No direct file system access
- Web Worker isolation (no DOM access)
- Same-origin policy
- WebSocket-only transport (no direct P2P, must use commserver relay)

**Scale/Scope**:
- Support 1000+ messages per conversation
- Multiple conversations (no hard limit, quota-dependent)
- Full feature parity with Electron version
- All existing UI components (~40 React components)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: No project-specific constitution found. Using default software engineering best practices as gates:

### Default Gates
✅ **Clear Architecture**: Main thread (UI) + Web Worker (ONE.core) - clean separation of concerns
✅ **Type Safety**: TypeScript throughout, shared types between threads
✅ **Testing Strategy**: Unit (Vitest), Integration (worker↔UI), E2E (Playwright)
✅ **Error Handling**: Worker errors surface to UI with clear messages
✅ **Performance Monitoring**: Track initialization time, message latency, storage operations
✅ **Browser Compatibility**: Target 90% market share, graceful degradation
✅ **Data Integrity**: ONE.core's versioned object system prevents corruption
✅ **Security**: Worker isolation, secure WebSocket (WSS), browser secure storage for tokens

**Status**: All gates PASSED - no violations to justify

## Project Structure

### Documentation (this feature)

```
specs/021-browser-platform-migration/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── worker-messages.ts   # UI↔Worker message types
│   └── storage-api.ts       # Browser storage interface
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Web application structure
lama.browser/
├── main/                       # MIGRATE TO: worker/
│   ├── core/                   # ONE.core initialization for worker
│   │   ├── worker-one-core.ts  # NEW: Worker-based ONE.core setup
│   │   ├── ai-assistant-model.ts
│   │   ├── ai-message-listener.ts
│   │   ├── node-one-core.ts    # REMOVE: Node.js-specific
│   │   ├── topic-group-manager.ts
│   │   └── one-ai/             # Topic analysis models
│   ├── services/               # Business logic (stays in worker)
│   │   ├── llm-manager.ts
│   │   ├── mcp-manager.ts      # ADAPT: Worker-compatible MCP
│   │   ├── ollama.ts
│   │   ├── proposal-engine.ts
│   │   └── mcp/
│   └── ipc/                    # REPLACE WITH: worker-messages/
│       ├── controller.ts       # REMOVE: Electron IPC
│       └── handlers/           # MIGRATE: Convert to worker message handlers
│
├── worker/                     # NEW: Web Worker entry point
│   ├── index.ts               # Worker initialization & message routing
│   ├── storage/               # Browser storage wrappers
│   │   ├── indexeddb.ts       # ONE.core IndexedDB interface
│   │   └── quota-monitor.ts   # Storage quota monitoring
│   └── messages/              # Message handlers (from old IPC)
│       ├── one-core.ts
│       ├── chat.ts
│       ├── proposals.ts
│       ├── topic-analysis.ts
│       └── ai.ts
│
├── electron-ui/               # RENAME TO: browser-ui/
│   └── src/
│       ├── components/        # React UI (minimal changes)
│       ├── hooks/             # ADAPT: Replace IPC with worker messages
│       ├── services/          # NEW: Worker communication client
│       │   ├── worker-client.ts   # UI↔Worker message passing
│       │   └── worker-types.ts    # Shared type definitions
│       └── preload.cjs        # REMOVE: Electron-specific
│
├── shared/                    # NEW: Shared types/utilities
│   ├── types/                 # Types used by both UI & worker
│   │   ├── messages.ts        # Message protocol definitions
│   │   └── models.ts          # Data model types
│   └── utils/                 # Common utilities
│
├── tests/
│   ├── unit/                  # Component & service tests
│   ├── integration/           # Worker↔UI message flow tests
│   └── e2e/                   # Browser automation tests (Playwright)
│
├── lama-electron-shadcn.ts    # REMOVE: Electron main process
└── vite.config.ts             # NEW: Browser build configuration
```

**Structure Decision**: Web application structure chosen because:
- UI runs in main browser thread (React components)
- Backend logic runs in Web Worker (ONE.core, business logic)
- Clear separation requires dedicated `worker/` directory
- Shared types in `shared/` prevent duplication
- Mirrors modern web app architecture (main thread UI + service worker backend)

## Complexity Tracking

*No constitution violations - this section intentionally left empty*
