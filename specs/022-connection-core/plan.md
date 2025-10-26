# Implementation Plan: Connection Core Package

**Branch**: `022-connection-core` | **Date**: 2025-10-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/022-connection-core/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Create a reusable, platform-agnostic connection.core package that provides peer-to-peer connection management, pairing workflows, group connections, verifiable credential verification, discovery services, and QuicVC transport integration across 4 lama platforms (browser, electron, iOS, android). The package uses dependency injection to keep core logic platform-independent while allowing platforms to provide transport, storage, and UI implementations. This centralizes connection logic in one place, preventing divergent implementations across platforms and enabling consistent behavior for groups, credentials, and QuicVC features.

## Technical Context

**Language/Version**: TypeScript 5.x (for type safety and cross-platform compatibility)
**Primary Dependencies**:
- `@refinio/one.core` (ConnectionsModel, CHUM protocol, storage primitives)
- W3C Verifiable Credentials libraries (credential verification)
- Platform-injected: transport implementations, storage adapters, UI callbacks

**Storage**: Platform-specific via dependency injection (IndexedDB for browser, file system for electron/Node.js, native storage for iOS/Android)
**Testing**: Jest for unit tests, platform-specific integration tests (90% coverage target for platform-agnostic code)
**Target Platform**: Multi-platform package - browser (ES modules), electron (CommonJS/ESM), iOS (via bridge), android (via bridge)
**Project Type**: Library package (npm/yarn package for JS platforms, module for native platforms)
**Performance Goals**:
- Connection establishment: <3s (local network), <5s (relay-based)
- Group connections: 10 simultaneous peers, <500ms message delivery per peer
- Credential verification: <1s per pairing
- Auto-reconnection: <10s for 90% of disconnections

**Constraints**:
- Platform-agnostic core logic (no direct platform imports)
- Dependency injection for all platform-specific concerns
- Fail-fast on errors (no fallbacks except transport negotiation)
- Must work identically across all 4 platforms

**Scale/Scope**:
- 50 concurrent peer connections per platform instance
- 10 peers per group (full mesh topology)
- Support for 3 pairing methods (QR code, numeric code, proximity-based)
- Versioned credential revocation with backdated validity

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: No project constitution defined (constitution.md is template only)

**Assumed Principles** (from CLAUDE.md and project context):
- ✅ **Fail Fast**: No fallbacks or mitigation - throw clear errors when dependencies missing
- ✅ **Use What You Have**: Builds on ONE.core ConnectionsModel (not reimplementing protocol layer)
- ✅ **Reusability**: Follows existing chat.core/lama.core pattern for platform-agnostic packages
- ✅ **Dependency Injection**: Follows TopicGroupManager pattern for platform abstraction
- ✅ **No Delays**: No artificial delays (exponential backoff for reconnection is intentional, not a delay)

**No violations detected** - Package architecture aligns with established patterns.

## Project Structure

### Documentation (this feature)

```
specs/022-connection-core/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── connection-manager.ts    # ConnectionManager interface
│   ├── platform-deps.ts         # Platform dependency interfaces
│   ├── pairing-api.ts           # Pairing workflow API
│   ├── discovery-api.ts         # Discovery service API
│   └── credential-api.ts        # Credential verification API
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
connection.core/                 # New package directory
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Public API exports
│   ├── ConnectionManager.ts     # Main orchestrator
│   ├── pairing/
│   │   ├── PairingStateMachine.ts
│   │   ├── PairingRequest.ts
│   │   └── PairingWorkflow.ts
│   ├── discovery/
│   │   ├── DiscoveryService.ts
│   │   ├── LocalDiscovery.ts
│   │   └── RelayDiscovery.ts
│   ├── credentials/
│   │   ├── CredentialVerifier.ts
│   │   ├── VersionedCredential.ts
│   │   └── RevocationChecker.ts
│   ├── connections/
│   │   ├── Connection.ts
│   │   ├── GroupConnection.ts
│   │   ├── ConnectionState.ts
│   │   └── ReconnectionManager.ts
│   ├── transport/
│   │   ├── Transport.ts (interface)
│   │   ├── QuicVCTransport.ts
│   │   └── TransportNegotiator.ts
│   ├── types/
│   │   ├── platform-interfaces.ts  # Dependency injection contracts
│   │   ├── connection-types.ts
│   │   └── credential-types.ts
│   └── utils/
│       ├── error-handling.ts
│       └── validation.ts
└── tests/
    ├── unit/
    │   ├── pairing/
    │   ├── discovery/
    │   ├── credentials/
    │   └── connections/
    ├── integration/
    │   └── full-workflow.test.ts
    └── mocks/
        ├── MockTransport.ts
        ├── MockStorage.ts
        └── MockUICallbacks.ts

# Platform integration examples (not part of connection.core package)
lama.browser/
└── src/
    └── connection/
        ├── BrowserTransport.ts      # Browser WebSocket implementation
        ├── BrowserStorage.ts         # IndexedDB storage adapter
        └── connection-setup.ts       # ConnectionManager instantiation

lama.electron/
└── main/
    └── connection/
        ├── NodeTransport.ts          # Node.js QUIC/WebSocket
        ├── FileSystemStorage.ts      # File-based storage
        └── connection-setup.js       # ConnectionManager instantiation
```

**Structure Decision**: Library package structure chosen because connection.core is a reusable package shared across multiple platform projects. The package itself contains only platform-agnostic logic with clear dependency injection interfaces. Each platform (lama.browser, lama.electron, lama.ios, lama.android) will have a small integration layer (<500 LOC) that provides platform-specific implementations and instantiates ConnectionManager.

## Complexity Tracking

*No violations detected - no complexity tracking required.*

Connection.core follows established patterns (chat.core, lama.core) and uses ONE.core's existing infrastructure. The dependency injection pattern is proven via TopicGroupManager. No new architectural patterns or unjustified complexity introduced.

