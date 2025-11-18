# LAMA Architecture: Platform-Agnostic Core

**Last Updated:** 2025-10-19

## Overview

LAMA is split into three packages with clear separation of concerns:

```
lama/
├── lama.core/          # Platform-agnostic business logic (NEW)
├── lama.electron/      # Electron (Node.js) platform implementation
└── lama.browser/       # Browser (Web) platform implementation
```

## Package Structure

### lama.core - Platform-Agnostic Business Logic

**Purpose:** Shared handlers, services, and models usable by any platform

**Location:** `/Users/gecko/src/lama/lama.core/`

**Git:** Independent git repository (initialized 2025-10-19)

**Contains:**
- `handlers/` - Transport-agnostic business logic handlers
  - AIHandler.ts, ChatHandler.ts, OneCoreHandler.ts, etc.
  - Pure TypeScript classes with dependency injection
  - NO platform-specific code (no Electron, no Browser APIs)

- `services/` - LLM service clients
  - ollama.ts, claude.ts, lmstudio.ts
  - HTTP-based, work in Node.js and Browser

- `one-ai/` - AI analysis models and storage
  - models/ - Subject, Keyword, Summary, TopicAnalysisModel
  - recipes/ - ONE.core recipe definitions
  - services/ - TopicAnalyzer, keyword extraction
  - storage/ - Persistence layer for AI objects

- `@OneCoreTypes.d.ts` - TypeScript type extensions for ONE.core
- `@OneObjectInterfaces.d.ts` - Custom ONE object type definitions

**Package Configuration:**
```json
{
  "name": "@lama/core",
  "type": "module",
  "exports": {
    "./handlers/*": "./handlers/*",
    "./services/*": "./services/*",
    "./models/*": "./models/*",
    "./one-ai/*": "./one-ai/*"
  }
}
```

**Build:**
- Source: TypeScript (.ts files)
- Output: JavaScript (.js files) compiled in-place
- Build command: `npm run build` (runs tsc)
- .gitignore: Ignores all *.js files (compiled output)
- Compiled files must exist for importing packages to work

**Dependencies:**
- Peer dependencies: `@refinio/one.core`, `@refinio/one.models`
- Direct dependencies: `@anthropic-ai/sdk`, `node-fetch`

### lama.electron - Node.js Platform

**Purpose:** Electron main process implementation

**Depends on:** `@lama/core` via `"file:../lama.core"`

**Contains:**
- `main/ipc/handlers/` - **Thin IPC adapters**
  - Import handlers from `@lama/core/handlers/`
  - Create handler instances with platform dependencies
  - Map IPC events to handler methods
  - ~50-200 lines each (thin wrappers)

- `main/core/` - Platform-specific services
  - node-one-core.js - Full ONE.core Node.js instance
  - qr-generation.js, attestation-manager.js, etc.

- `main/services/` - Node.js-specific services
  - mcp-manager.ts - Model Context Protocol (Node.js only)
  - node-provisioning.ts - ONE.core initialization

**Pattern:**
```typescript
// lama.electron/main/ipc/handlers/audit.ts
import { AuditHandler } from '@lama/core/handlers/AuditHandler.js';
import qrGenerator from '../../core/qr-generation.js';

const handler = new AuditHandler(qrGenerator, attestationManager, topicExporter);

export default {
  async generateQR(event, params) {
    return await handler.generateQR(params);
  }
};
```

### lama.browser - Web Platform

**Purpose:** Browser/Web Worker implementation (future)

**Status:** In development

**Will depend on:** `@lama/core` via `"file:../lama.core"`

**Contains:**
- `handlers/` - Currently empty (planned to use lama.core)
- `main/ipc/handlers/` - Electron IPC adapters (to be refactored)
- `worker/messages/` - Web Worker message handlers

## Architecture Principles

### 1. No Code Duplication
- Business logic written **once** in `lama.core`
- Used by all platforms via dependency injection
- Platform adapters are thin wrappers

### 2. Dependency Injection
All handlers accept platform-specific dependencies:

```typescript
export class ChatHandler {
  constructor(
    private nodeOneCore: any,      // Platform-specific ONE.core
    private stateManager: any       // Platform-specific state
  ) {}

  async sendMessage(params) {
    // Pure business logic using injected dependencies
  }
}
```

### 3. Clean Separation of Concerns

**Platform Core (lama.core):**
- Business logic and validation
- Request/response interfaces
- Error handling patterns
- Transport-agnostic operations

**Platform Adapters (lama.electron, lama.browser):**
- Transport handling (IPC, Worker messages)
- Platform-specific APIs (fs, Electron, Browser)
- Dependency instantiation
- Event subscriptions

### 4. No Fallbacks
- Platforms import from lama.core ONLY
- If imports fail, operations fail - no mitigation
- Fix the problem, don't work around it

## Refactoring Results

### Before Refactoring
- lama.electron: 22 fat handlers with embedded business logic
- No code sharing between platforms
- ~3,290 lines of duplicated logic

### After Refactoring
- lama.core: 14 shared handlers with pure business logic
- lama.electron: Thin IPC adapters (~1,038 lines)
- **68% reduction** in code (~2,252 lines saved)

### Handlers Moved to lama.core
1. AIHandler - AI conversation management
2. AuditHandler - QR codes and attestation
3. ChatHandler - Message sending and retrieval
4. ContactsHandler - Contact management
5. CryptoHandler - Cryptographic operations
6. ExportHandler - Content export with microdata
7. FeedForwardHandler - Knowledge sharing
8. IOMHandler - IoM operations
9. KeywordDetailHandler - Keyword detail with access control
10. LLMConfigHandler - LLM configuration
11. OneCoreHandler - Core ONE.core operations
12. ProposalsHandler - Context-aware proposals
13. TopicAnalysisHandler - Topic analysis and AI
14. WordCloudSettingsHandler - Visualization settings

## Build Process

### Building lama.core
```bash
cd lama.core
npm run build        # Compile TypeScript to JavaScript
npm run watch        # Watch mode for development
npm run clean        # Remove compiled files
```

### Building lama.electron
```bash
cd lama.electron
npm run build:main   # Builds main process (depends on lama.core being built)
npm run build:ui     # Builds UI
npm run build:all    # Builds everything
```

**Important:** lama.core must be built before lama.electron can import from it.

## Development Workflow

1. **Work on lama.core:**
   ```bash
   cd lama.core
   npm run watch     # Auto-rebuild on changes
   ```

2. **Work on lama.electron:**
   ```bash
   cd lama.electron
   npm run electron  # Run Electron app
   ```

3. **Changes to lama.core:**
   - TypeScript files auto-compile in watch mode
   - lama.electron picks up changes automatically
   - No need to rebuild lama.electron

## Git Repository Structure

- **lama.core:** Independent git repository
  - Tracks source files only (.ts, .d.ts, package.json, tsconfig.json)
  - Ignores compiled output (*.js, *.js.map)
  - Can be versioned and tagged independently

- **lama.electron:** Separate repository
  - Depends on lama.core via `"file:../lama.core"`
  - Expects lama.core to be a sibling directory

- **lama.browser:** Separate repository (future)
  - Will also depend on lama.core via file reference

## Key Files

### lama.core
- `package.json` - Package configuration with exports and build scripts
- `tsconfig.json` - TypeScript configuration (outDir: ".")
- `.gitignore` - Ignores compiled output
- `handlers/` - Business logic handlers
- `services/` - LLM service clients
- `one-ai/` - AI analysis package

### lama.electron
- `package.json` - Includes `"@lama/core": "file:../lama.core"`
- `tsconfig.main.json` - Excludes `../lama.core/**` from compilation
- `main/ipc/handlers/` - Thin IPC adapters

## Benefits

### Code Reuse
- 2,004 lines of shared business logic
- Usable across platforms (electron, browser, future mobile)
- Single source of truth for business rules

### Maintainability
- Changes to business logic affect all platforms
- Platform-specific code is isolated
- Easier to test (handlers are pure classes)

### Correctness
- Using ONE.core/ONE.models APIs properly
- No reimplementation drift
- Leverages battle-tested functionality

### Performance
- Eliminated redundant monitoring loops
- Removed custom state management overhead
- Direct event subscriptions to one.models

## Testing Strategy

1. **Unit Tests** - Test handlers with mocked dependencies
2. **Platform Tests** - Test adapters with actual transport
3. **Contract Tests** - Verify request/response interfaces
4. **Integration Tests** - End-to-end with real ONE.core

## Next Steps

1. ✅ **lama.core setup** - Git repo, build scripts, clean structure (DONE)
2. ⏳ **lama.browser refactoring** - Use lama.core handlers
3. ⏳ **Testing** - Add comprehensive test suite
4. ⏳ **Documentation** - API docs for all handlers
5. ⏳ **Versioning** - Proper semver for lama.core

## References

- **docs/REFACTORING_SUMMARY.md** - Detailed refactoring results
- **lama.core/handlers/** - Handler implementations
- **lama.electron/main/ipc/handlers/** - IPC adapter examples
