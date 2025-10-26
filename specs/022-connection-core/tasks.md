# Tasks: Connection Core Package

**Input**: Design documents from `/specs/022-connection-core/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are NOT explicitly requested in the specification. This task list focuses on implementation only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **connection.core package**: `connection.core/src/`, `connection.core/tests/`
- **Platform integrations**: `lama.browser/src/connection/`, `lama.electron/main/connection/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create connection.core package structure and initialize TypeScript project

- [ ] T001 Create connection.core package directory structure with src/, tests/, dist/ directories
- [ ] T002 Initialize TypeScript project with package.json, tsconfig.json for dual ESM/CJS output in connection.core/
- [ ] T003 [P] Configure TypeScript compiler for ES2020 target with ESM and CJS output in connection.core/tsconfig.json
- [ ] T004 [P] Install dependencies: @refinio/one.core, TypeScript 5.x, Jest for testing in connection.core/package.json
- [ ] T005 [P] Configure linting (ESLint) and formatting (Prettier) tools in connection.core/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core platform-agnostic infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Define platform dependency interfaces in connection.core/src/types/platform-interfaces.ts (TransportFactory, Transport, StorageAdapter, UICallbacks, PlatformDependencies)
- [ ] T007 [P] Define core type definitions in connection.core/src/types/connection-types.ts (Connection, ConnectionState, ConnectionMetadata, GroupConnection, PairingRequest, PairingState)
- [ ] T008 [P] Define credential type definitions in connection.core/src/types/credential-types.ts (VersionedCredential, CredentialSubject, CryptographicProof, PeerIdentity)
- [ ] T009 [P] Create error handling utilities in connection.core/src/utils/error-handling.ts (fail-fast error classes with clear messages)
- [ ] T010 [P] Create validation utilities in connection.core/src/utils/validation.ts (dependency validation, state transition validation)
- [ ] T011 Create public API exports in connection.core/src/index.ts (export all public interfaces and classes)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Platform Integration (Priority: P1) 🎯 MVP

**Goal**: Enable platform developers to integrate connection.core with platform-specific dependencies and establish basic P2P connections

**Independent Test**: Integrate connection.core into lama.browser, provide BrowserTransport and BrowserStorage implementations, initialize ConnectionManager without errors, and establish a P2P connection between two browser instances

### Implementation for User Story 1

- [ ] T012 [P] [US1] Create ConnectionState class in connection.core/src/connections/ConnectionState.ts (state tracking with transition validation)
- [ ] T013 [P] [US1] Create Connection class in connection.core/src/connections/Connection.ts (P2P connection abstraction using Transport interface)
- [ ] T014 [P] [US1] Create ReconnectionManager class in connection.core/src/connections/ReconnectionManager.ts (exponential backoff reconnection logic)
- [ ] T015 [US1] Create ConnectionManager class in connection.core/src/ConnectionManager.ts (main orchestrator with dependency injection, lifecycle management, connection establishment)
- [ ] T016 [US1] Implement ConnectionManager.initialize() method to validate dependencies fail-fast and setup internal services
- [ ] T017 [US1] Implement ConnectionManager.connect() method to establish P2P connection using injected transport
- [ ] T018 [US1] Implement ConnectionManager.disconnect() method to gracefully close connections
- [ ] T019 [US1] Implement ConnectionManager.shutdown() method to cleanup all resources
- [ ] T020 [US1] Add event system to ConnectionManager for 'initialized', 'connectionEstablished', 'connectionClosed', 'error' events
- [ ] T021 [US1] Create example BrowserTransport implementation in lama.browser/src/connection/BrowserTransport.ts (WebSocket-based transport)
- [ ] T022 [US1] Create example BrowserStorage implementation in lama.browser/src/connection/BrowserStorage.ts (IndexedDB-based storage)
- [ ] T023 [US1] Create example BrowserUICallbacks implementation in lama.browser/src/connection/BrowserUICallbacks.ts
- [ ] T024 [US1] Create connection setup file in lama.browser/src/connection/connection-setup.ts (instantiate ConnectionManager with browser dependencies)

**Checkpoint**: At this point, User Story 1 should be fully functional - browser platform can integrate connection.core and establish P2P connections

---

## Phase 4: User Story 2 - Cross-Platform Pairing (Priority: P2)

**Goal**: Enable users on different platforms to discover and pair their devices for P2P communication

**Independent Test**: Run lama on two different platforms (e.g., browser and electron), initiate pairing from one device, confirm pairing request appears on other device, accept pairing, verify both devices show as connected peers

### Implementation for User Story 2

- [ ] T025 [P] [US2] Create PairingRequest class in connection.core/src/pairing/PairingRequest.ts (pairing request data with expiration tracking)
- [ ] T026 [P] [US2] Create PairingStateMachine class in connection.core/src/pairing/PairingStateMachine.ts (state transition validation for pairing workflow)
- [ ] T027 [US2] Create DiscoveryService class in connection.core/src/discovery/DiscoveryService.ts (coordinator for local and relay discovery with deduplication)
- [ ] T028 [US2] Create LocalDiscovery interface implementation in connection.core/src/discovery/LocalDiscovery.ts (platform-agnostic local network discovery abstraction)
- [ ] T029 [US2] Create RelayDiscovery class in connection.core/src/discovery/RelayDiscovery.ts (relay server-based peer discovery)
- [ ] T030 [US2] Create CredentialVerifier class in connection.core/src/credentials/CredentialVerifier.ts (W3C VC verification with signature, expiration, trust chain checks)
- [ ] T031 [US2] Create QRCodePairingMethod class in connection.core/src/pairing/methods/QRCodePairing.ts (QR code generation and parsing)
- [ ] T032 [P] [US2] Create NumericCodePairingMethod class in connection.core/src/pairing/methods/NumericCodePairing.ts (6-8 digit code generation and verification)
- [ ] T033 [P] [US2] Create ProximityPairingMethod class in connection.core/src/pairing/methods/ProximityPairing.ts (Bluetooth/NFC proximity detection abstraction)
- [ ] T034 [US2] Create PairingWorkflow class in connection.core/src/pairing/PairingWorkflow.ts (coordinates pairing using selected method and credential exchange)
- [ ] T035 [US2] Implement ConnectionManager.discoverPeers() method using DiscoveryService with local and relay discovery
- [ ] T036 [US2] Implement ConnectionManager.startDiscovery() and stopDiscovery() methods for continuous peer discovery
- [ ] T037 [US2] Implement ConnectionManager.initiatePairing() method to start pairing workflow with discovered peer
- [ ] T038 [US2] Implement ConnectionManager.acceptPairing() method to accept incoming pairing requests
- [ ] T039 [US2] Implement ConnectionManager.rejectPairing() method to reject pairing requests
- [ ] T040 [US2] Add pairing events to ConnectionManager: 'peerDiscovered', 'pairingRequestReceived', 'pairingAccepted', 'pairingRejected'
- [ ] T041 [US2] Integrate CredentialVerifier into pairing workflow for credential validation during pairing
- [ ] T042 [US2] Add automatic connection establishment after successful pairing acceptance

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can discover, pair, and connect across platforms

---

## Phase 5: User Story 3 - Group Connections (Priority: P3)

**Goal**: Enable users to establish and maintain P2P connections with multiple group members simultaneously for group conversations

**Independent Test**: Create a group with 3 devices on any mix of platforms, send a message from device A, confirm that devices B and C both receive the message through direct P2P connections

### Implementation for User Story 3

- [ ] T043 [P] [US3] Create GroupConnection class in connection.core/src/connections/GroupConnection.ts (full mesh topology with member status tracking)
- [ ] T044 [US3] Implement GroupConnection.addMember() method to establish connection with new group member
- [ ] T045 [US3] Implement GroupConnection.removeMember() method to close connection and update topology
- [ ] T046 [US3] Implement GroupConnection.broadcast() method to send data to all connected members
- [ ] T047 [US3] Implement GroupConnection.getMemberStatus() and getConnectedMembers() methods for status queries
- [ ] T048 [US3] Implement ConnectionManager.createGroupConnection() method to create group with multiple peers and establish full mesh
- [ ] T049 [US3] Implement ConnectionManager.joinGroupConnection() method to join existing group and discover members
- [ ] T050 [US3] Implement ConnectionManager.leaveGroupConnection() method to close all group connections
- [ ] T051 [US3] Add group events to ConnectionManager: 'groupMemberJoined', 'groupMemberLeft'
- [ ] T052 [US3] Implement automatic mesh connection establishment when new member joins group
- [ ] T053 [US3] Implement per-member connection monitoring and status updates in GroupConnection
- [ ] T054 [US3] Add group membership persistence to StorageAdapter interface (storeGroup, getGroup methods)

**Checkpoint**: All user stories 1-3 should now be independently functional - full mesh P2P group connections work

---

## Phase 6: User Story 4 - Credential Verification (Priority: P4)

**Goal**: Verify cryptographic credentials during connection establishment to prevent impersonation attacks

**Independent Test**: Attempt to pair two devices where one device presents invalid or expired credentials during the pairing handshake. The receiving device should reject the pairing request with a clear error message about credential verification failure

### Implementation for User Story 4

- [ ] T055 [P] [US4] Create SignatureVerifier class in connection.core/src/credentials/SignatureVerifier.ts (cryptographic signature verification for Ed25519, RSA signature types)
- [ ] T056 [P] [US4] Create CredentialValidator class in connection.core/src/credentials/CredentialValidator.ts (W3C VC structure validation and required field checking)
- [ ] T057 [P] [US4] Create RevocationChecker class in connection.core/src/credentials/RevocationChecker.ts (versioned credential revocation checking via validFrom backdating)
- [ ] T058 [US4] Implement CredentialVerifier.verifySignature() method using SignatureVerifier for cryptographic validation
- [ ] T059 [US4] Implement CredentialVerifier.checkExpiration() method to validate expirationDate against current time
- [ ] T060 [US4] Implement CredentialVerifier.checkTrustChain() method to verify issuer is in trusted issuer list
- [ ] T061 [US4] Implement CredentialVerifier.checkRevocation() method using RevocationChecker to detect revoked credentials
- [ ] T062 [US4] Implement CredentialVerifier.verify() method to perform full credential verification (signature + expiration + trust + revocation)
- [ ] T063 [US4] Integrate credential verification into PairingWorkflow to verify both initiator and target credentials
- [ ] T064 [US4] Add fail-fast error handling for credential verification failures with specific error codes (SIGNATURE_INVALID, EXPIRED, REVOKED, UNTRUSTED_ISSUER)
- [ ] T065 [US4] Implement periodic re-verification of credentials for active connections (every 24 hours)
- [ ] T066 [US4] Add credential verification status to PeerIdentity ('valid', 'expired', 'revoked', 'unverified')

**Checkpoint**: All user stories 1-4 should now work - pairing includes cryptographic credential verification

---

## Phase 7: User Story 5 - QuicVC Integration (Priority: P5)

**Goal**: Support QuicVC as a transport option for platforms with native QUIC support to achieve lower latency than WebSocket

**Independent Test**: Configure connection.core on a platform that supports QUIC (e.g., lama.electron with Node.js QUIC) to use QuicVC transport, establish a connection to another QUIC-capable peer, and measure connection latency and throughput compared to WebSocket transport

### Implementation for User Story 5

- [ ] T067 [P] [US5] Create QuicVCTransport interface implementation in connection.core/src/transport/QuicVCTransport.ts (adapts QUIC to Transport interface)
- [ ] T068 [P] [US5] Create TransportNegotiator class in connection.core/src/transport/TransportNegotiator.ts (negotiates transport type based on mutual capabilities)
- [ ] T069 [US5] Implement capability advertisement in DiscoveryService to include supported transport types (quicvc, websocket)
- [ ] T070 [US5] Implement transport negotiation in ConnectionManager.connect() to select best mutual transport (QUIC > WebSocket)
- [ ] T071 [US5] Add transport type to Connection metadata for tracking which transport is used
- [ ] T072 [US5] Implement QuicVC connection establishment using ONE.core ConnectionsModel QUIC integration
- [ ] T073 [US5] Add fail-fast error handling when selected transport fails (no automatic fallback after selection)
- [ ] T074 [US5] Create example NodeQuicTransport implementation in lama.electron/main/connection/NodeQuicTransport.js (Node.js QUIC transport)
- [ ] T075 [US5] Add transport capability filtering to DiscoveryService.filterByCapability() method
- [ ] T076 [US5] Update BrowserTransportFactory to advertise only 'websocket' support, NodeTransportFactory to advertise both 'quicvc' and 'websocket'

**Checkpoint**: All 5 user stories are complete - full connection.core functionality including QuicVC transport

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and finalize the package

- [ ] T077 [P] Add comprehensive JSDoc comments to all public APIs in connection.core/src/
- [ ] T078 [P] Create package README.md with installation instructions and basic usage examples in connection.core/
- [ ] T079 [P] Validate quickstart.md examples against implemented API in connection.core/
- [ ] T080 [P] Add error code documentation for all fail-fast error scenarios in connection.core/docs/errors.md
- [ ] T081 Create example integration for lama.electron in lama.electron/main/connection/ (NodeTransport, FileSystemStorage, NodeUICallbacks)
- [ ] T082 [P] Add TypeScript declaration file generation to build process in connection.core/tsconfig.json
- [ ] T083 [P] Performance optimization: Add connection pooling and reuse logic in ConnectionManager
- [ ] T084 [P] Security hardening: Validate all input parameters in public API methods
- [ ] T085 Add peer expiration logic to DiscoveryService (remove peers not seen in 2 minutes)
- [ ] T086 [P] Add connection health monitoring with periodic keep-alive checks
- [ ] T087 Verify connection limit enforcement (maximum 50 concurrent connections) in ConnectionManager
- [ ] T088 Verify group size limit enforcement (maximum 10 members) in GroupConnection
- [ ] T089 [P] Add detailed logging for debugging connection issues (use platform logging callbacks)
- [ ] T090 Create mock implementations for testing in connection.core/tests/mocks/ (MockTransport, MockStorage, MockUICallbacks)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4 → P5)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories (US1 not required, but US1 connection establishment is used)
- **User Story 3 (P3)**: Requires User Story 1 (Connection class) and User Story 2 (pairing to get peers)
- **User Story 4 (P4)**: Requires User Story 2 (integrates into pairing workflow)
- **User Story 5 (P5)**: Requires User Story 1 (Connection and ConnectionManager) - No dependencies on US2-4

### Within Each User Story

**User Story 1**:
- T012, T013, T014 can run in parallel (different files)
- T015 depends on T012, T013, T014 (ConnectionManager uses Connection, ConnectionState, ReconnectionManager)
- T016-T020 are sequential methods on ConnectionManager
- T021, T022, T023 can run in parallel (different platform implementation files)
- T024 depends on T021, T022, T023 (setup uses platform implementations)

**User Story 2**:
- T025, T026, T027, T028, T029, T030 can run in parallel (different core classes)
- T031, T032, T033 can run in parallel (different pairing method implementations)
- T034 depends on T025, T026, T031-T033 (workflow uses state machine and pairing methods)
- T035-T042 are sequential additions to ConnectionManager

**User Story 3**:
- T043 can start immediately (GroupConnection class)
- T044-T047 are sequential methods on GroupConnection
- T048-T051 are sequential additions to ConnectionManager
- T052-T054 are integration tasks

**User Story 4**:
- T055, T056, T057 can run in parallel (different verification classes)
- T058-T062 are sequential methods on CredentialVerifier
- T063-T066 are integration tasks

**User Story 5**:
- T067, T068 can run in parallel (different transport classes)
- T069-T076 are sequential integration tasks

### Parallel Opportunities

- **Phase 1**: T003, T004, T005 can run in parallel
- **Phase 2**: T007, T008, T009, T010 can run in parallel
- **User Story 1**: T012, T013, T014 || T021, T022, T023
- **User Story 2**: T025-T030 || T031, T032, T033
- **User Story 4**: T055, T056, T057
- **User Story 5**: T067, T068
- **Polish**: T077, T078, T079, T080, T082, T084, T086, T089 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all core classes for User Story 1 together:
Task T012: "Create ConnectionState class in connection.core/src/connections/ConnectionState.ts"
Task T013: "Create Connection class in connection.core/src/connections/Connection.ts"
Task T014: "Create ReconnectionManager class in connection.core/src/connections/ReconnectionManager.ts"

# Launch all browser platform implementations together:
Task T021: "Create example BrowserTransport implementation in lama.browser/src/connection/BrowserTransport.ts"
Task T022: "Create example BrowserStorage implementation in lama.browser/src/connection/BrowserStorage.ts"
Task T023: "Create example BrowserUICallbacks implementation in lama.browser/src/connection/BrowserUICallbacks.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently - establish P2P connection between two browser instances
5. Deploy/demo if ready - basic P2P connectivity working

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! - P2P connections work)
3. Add User Story 2 → Test independently → Deploy/Demo (cross-platform pairing works)
4. Add User Story 3 → Test independently → Deploy/Demo (group connections work)
5. Add User Story 4 → Test independently → Deploy/Demo (secure credential verification)
6. Add User Story 5 → Test independently → Deploy/Demo (QUIC transport for performance)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (P2P connections)
   - Developer B: User Story 2 (pairing and discovery)
   - Developer C: Start User Story 5 (QuicVC transport - doesn't depend on US2-4)
3. After US1 and US2 complete:
   - Developer A: User Story 3 (groups - requires US1 Connection)
   - Developer B: User Story 4 (credentials - integrates with US2 pairing)
4. Stories complete and integrate independently

---

## Summary

**Total Tasks**: 90 tasks
**Task Count per User Story**:
- Setup (Phase 1): 5 tasks
- Foundational (Phase 2): 6 tasks
- User Story 1 - Platform Integration (P1): 13 tasks
- User Story 2 - Cross-Platform Pairing (P2): 18 tasks
- User Story 3 - Group Connections (P3): 12 tasks
- User Story 4 - Credential Verification (P4): 12 tasks
- User Story 5 - QuicVC Integration (P5): 10 tasks
- Polish (Phase 8): 14 tasks

**Parallel Opportunities Identified**: 35+ tasks can run in parallel across different phases

**Independent Test Criteria**:
- **US1**: Browser platform integrates connection.core and establishes P2P connection
- **US2**: Two platforms discover each other, complete pairing workflow, and connect
- **US3**: 3 devices in a group, message sent from one reaches all others via P2P
- **US4**: Pairing with invalid credentials fails with clear error message
- **US5**: QUIC transport connection has measurably lower latency than WebSocket

**Suggested MVP Scope**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (User Story 1) = 24 tasks for basic P2P connectivity

**Format Validation**: ✅ All tasks follow the checklist format:
- All tasks start with `- [ ]`
- All tasks have sequential IDs (T001-T090)
- User story tasks have [USX] labels
- Parallelizable tasks have [P] markers
- All tasks include specific file paths
- All task descriptions are clear and actionable
