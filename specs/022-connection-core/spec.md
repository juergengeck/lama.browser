# Feature Specification: Connection Core Package

**Feature Branch**: `022-connection-core`
**Created**: 2025-10-23
**Status**: Draft
**Input**: User description: "Create a reusable connection.core package to manage peer-to-peer connections, pairing workflows, group connections, verifiable credentials, discovery mechanisms, and QuicVC integration across 4 lama platforms (browser, electron, iOS, android). The package must be platform-agnostic using dependency injection for transport, storage, and UI concerns. This prevents implementing groups, credentials, and QuicVC 4 times with diverging implementations. Core capabilities: connection lifecycle management, pairing state machines, group connection workflows, credential verification, discovery (local network + relay), QuicVC protocol layer. Platform-specific: transport implementations, storage adapters, UI flows. Follows existing chat.core/lama.core pattern and TopicGroupManager dependency injection pattern."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Platform Integration (Priority: P1)

As a platform developer working on lama.browser, lama.electron, lama.ios, or lama.android, I need to integrate peer-to-peer connection capabilities into my platform without reimplementing connection logic, so that I can focus on platform-specific transport and UI while ensuring consistent connection behavior across all platforms.

**Why this priority**: This is the foundational capability. Without successful platform integration, no other features are possible. This delivers immediate value by enabling P2P connections with minimal platform-specific code.

**Independent Test**: Can be fully tested by integrating connection.core into one platform (e.g., lama.browser), providing platform-specific transport and storage implementations via dependency injection, and successfully establishing a P2P connection between two instances. Delivers a working P2P connection on one platform.

**Acceptance Scenarios**:

1. **Given** a platform developer has connection.core as a dependency, **When** they instantiate ConnectionManager with platform-specific dependencies (transport factory, storage adapter, UI callbacks), **Then** the ConnectionManager initializes successfully without errors
2. **Given** ConnectionManager is initialized on a platform, **When** the developer calls a connection lifecycle method (e.g., discoverPeers, initiatePairing), **Then** the method executes using the injected platform dependencies
3. **Given** two platform instances with ConnectionManager initialized, **When** one instance initiates a connection to the other, **Then** both instances complete the connection handshake and establish a working P2P connection
4. **Given** a platform-specific error occurs (e.g., network transport failure), **When** the error is encountered during connection operations, **Then** ConnectionManager fails fast with a clear error message (no fallbacks or mitigation)

---

### User Story 2 - Cross-Platform Pairing (Priority: P2)

As an end user with multiple devices running lama on different platforms (e.g., iOS phone and browser desktop), I need to discover and pair my devices together so that they can communicate and sync data peer-to-peer.

**Why this priority**: Pairing is the gateway to all P2P features. Once devices are paired, users can leverage the lama network. This is the first user-facing capability and delivers immediate value.

**Independent Test**: Can be fully tested by running lama on two different platforms (e.g., lama.ios simulator and lama.browser), initiating pairing from one device, and confirming the pairing request appears on the other device. Upon acceptance, both devices should show each other as connected peers. Delivers working cross-platform device pairing.

**Acceptance Scenarios**:

1. **Given** two devices on the same local network running lama on different platforms, **When** user initiates discovery on device A, **Then** device A discovers device B and displays it as an available peer
2. **Given** device A has discovered device B, **When** user on device A initiates pairing with device B, **Then** device B receives a pairing request notification with device A's identity information
3. **Given** device B has received a pairing request from device A, **When** user on device B accepts the pairing request, **Then** both devices complete the pairing handshake, exchange credentials, and establish a persistent P2P connection
4. **Given** devices A and B are on different networks (not local), **When** user on device A initiates discovery, **Then** device A uses relay-based discovery to find device B and allows pairing to proceed
5. **Given** devices A and B were previously paired, **When** both devices come online, **Then** they automatically discover each other and re-establish the P2P connection without user intervention

---

### User Story 3 - Group Connections (Priority: P3)

As an end user participating in group chats, I need my device to establish and maintain connections with multiple group members simultaneously so that I can send and receive messages in group conversations without relay servers.

**Why this priority**: Group functionality is a key differentiator for lama but builds on top of P2P pairing. This extends the value of P2P connections to multi-party scenarios.

**Independent Test**: Can be fully tested by creating a group with 3 devices on any mix of platforms, sending a message from device A, and confirming that devices B and C both receive the message through direct P2P connections. Delivers working P2P group messaging.

**Acceptance Scenarios**:

1. **Given** three paired devices (A, B, C) and a group chat with all three members, **When** device A comes online, **Then** device A establishes P2P connections with both device B and device C
2. **Given** device A is connected to devices B and C in a group, **When** a new device D joins the group, **Then** all existing devices (A, B, C) discover device D and establish P2P connections with it
3. **Given** device A is connected to multiple group members, **When** one connection fails (e.g., device B goes offline), **Then** device A maintains connections with other group members and continues operating normally
4. **Given** a group connection is established, **When** group membership changes (member added or removed), **Then** all devices update their connection topology to match the new membership

---

### User Story 4 - Credential Verification (Priority: P4)

As an end user pairing with a new peer, I need the system to verify cryptographic credentials during connection establishment so that I can trust the identity of the peer I'm connecting to and prevent impersonation attacks.

**Why this priority**: Security is critical but builds on top of basic pairing. Users need working pairing first, then security can be layered on. This priority allows P2P to work initially with basic trust, then adds cryptographic verification.

**Independent Test**: Can be fully tested by attempting to pair two devices where one device presents invalid or expired credentials during the pairing handshake. The receiving device should reject the pairing request with a clear error message about credential verification failure. Delivers secure credential-verified pairing.

**Acceptance Scenarios**:

1. **Given** two devices initiating pairing, **When** the pairing handshake begins, **Then** both devices exchange verifiable credentials containing identity and public key information
2. **Given** device A receives credentials from device B during pairing, **When** device A verifies the credentials, **Then** device A validates the credential signature, checks expiration, and confirms the credential chain of trust
3. **Given** device A is verifying credentials from device B, **When** the credentials are invalid (expired, bad signature, or untrusted issuer), **Then** device A rejects the pairing request and displays a security error to the user (no fallback to unverified connection)
4. **Given** devices A and B have successfully paired with verified credentials, **When** subsequent connections occur between A and B, **Then** the system re-verifies credentials to detect credential revocation or expiration

---

### User Story 5 - QuicVC Integration (Priority: P5)

As a platform developer integrating connection.core, I need the package to support QuicVC as a transport option so that platforms with native QUIC support can achieve lower latency and better performance than WebSocket-based connections.

**Why this priority**: QuicVC is a performance optimization that requires basic connectivity to work first. This is a future-facing capability that can be added after core P2P functionality is proven.

**Independent Test**: Can be fully tested by configuring connection.core on a platform that supports QUIC (e.g., lama.electron with Node.js QUIC) to use QuicVC transport, establishing a connection to another QUIC-capable peer, and measuring connection latency and throughput compared to WebSocket transport. Delivers high-performance QUIC-based P2P connections.

**Acceptance Scenarios**:

1. **Given** a platform provides a QUIC transport implementation via dependency injection, **When** ConnectionManager negotiates transport with a peer, **Then** ConnectionManager selects QuicVC transport if both peers support it
2. **Given** two peers have negotiated QuicVC transport, **When** they establish a connection, **Then** the connection uses QUIC protocol for all data transfer with lower latency than WebSocket
3. **Given** a peer supports QuicVC but the other peer only supports WebSocket, **When** ConnectionManager negotiates transport, **Then** ConnectionManager falls back to WebSocket transport (only fallback allowed: transport selection based on mutual capability)
4. **Given** a QuicVC connection is established, **When** the connection encounters QUIC-specific errors (e.g., NAT traversal failure), **Then** ConnectionManager reports the error and terminates the connection attempt (no automatic fallback to WebSocket once transport is selected)

---

### Edge Cases

- **What happens when a device attempts to pair while already connected to the maximum supported peer count?** System rejects new pairing requests with a clear error message about capacity limits
- **What happens when discovery finds multiple devices with the same identity?** System treats this as a security violation and rejects pairing with all duplicates, alerting the user
- **What happens when a pairing request times out without user response?** System automatically cancels the pairing request after a defined timeout period and notifies the initiating device
- **What happens when credentials expire while a connection is active?** System detects expiration during periodic re-verification, terminates the connection, and notifies both users to re-pair with updated credentials
- **What happens when a platform cannot provide a required dependency (e.g., storage adapter)?** ConnectionManager fails to initialize with a clear error message identifying the missing dependency (fail fast, no mitigation)
- **What happens when network connectivity is lost during an active connection?** System detects the disconnection, updates connection state to disconnected, and attempts automatic reconnection when network returns (with exponential backoff)
- **What happens when a group member's device is permanently removed (device reset/lost)?** Other group members detect the disconnection, mark the peer as unavailable, and remove it from active connection topology after a timeout period
- **What happens when discovery mechanisms conflict (e.g., local network and relay both find the same peer)?** System deduplicates discovered peers by identity and prefers local network connections over relay connections

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: connection.core package MUST provide a platform-agnostic ConnectionManager class that orchestrates all connection lifecycle operations (discovery, pairing, connection establishment, maintenance, termination)
- **FR-002**: ConnectionManager MUST accept platform-specific dependencies via constructor injection including transport factory, storage adapter, and UI callback handlers (no direct platform imports)
- **FR-003**: Package MUST implement a pairing state machine that manages pairing workflow states (initiated, pending, accepted, rejected, timeout, completed) with state transition validation
- **FR-004**: Package MUST support group connection workflows that establish and maintain P2P connections with multiple peers simultaneously for group conversations
- **FR-005**: Package MUST verify cryptographic credentials during connection establishment by validating signatures, expiration, and trust chains (W3C Verifiable Credentials format assumed)
- **FR-006**: Package MUST provide discovery services that support both local network discovery (mDNS/Bonjour pattern) and relay-based discovery for remote peers
- **FR-007**: Package MUST integrate QuicVC protocol layer and support QUIC as a pluggable transport option alongside WebSocket
- **FR-008**: Package MUST maintain connection state for all active connections including connection status, peer identity, transport type, and credential verification status
- **FR-009**: Package MUST fail fast when required platform dependencies are missing or invalid (no fallbacks, no mitigation - throw clear errors)
- **FR-010**: Package MUST work identically across all 4 target platforms (browser, electron, iOS, android) with only platform-specific dependency implementations differing
- **FR-011**: Package MUST support automatic reconnection when network connectivity is restored after disconnection (with exponential backoff to prevent connection storms)
- **FR-012**: Package MUST deduplicate discovered peers when the same peer is found via multiple discovery mechanisms (local + relay)
- **FR-013**: Package MUST enforce maximum peer connection limits per platform and reject new connections when limit is reached
- **FR-014**: Package MUST detect and handle credential expiration during active connections by terminating connections with expired credentials
- **FR-015**: Package MUST provide TypeScript type definitions for all public APIs and dependency injection interfaces
- **FR-016**: Package MUST use ONE.core ConnectionsModel as the underlying protocol layer (connection.core provides app-level abstractions on top of ONE.core)
- **FR-017**: Discovery service MUST support filtering discovered peers by capability (e.g., only show QUIC-capable peers when QUIC transport is preferred)
- **FR-018**: Pairing workflow MUST support multiple user-friendly pairing methods including QR code scanning (camera-based), numeric code verification (6-8 digit code entry), and proximity-based auto-pairing (Bluetooth/NFC), with platforms selecting the best method based on their capabilities
- **FR-019**: Group connection topology MUST use full mesh architecture where every peer establishes direct P2P connections with every other peer in the group (no coordinator), ensuring no single point of failure and direct message delivery between all participants
- **FR-020**: Credential verification MUST handle credential revocation through versioned credentials where revoked credentials are replaced by issuing new credential versions with validity periods starting in the past, invalidating the previous version without requiring online revocation list checks

### Key Entities

- **ConnectionManager**: Orchestrates all connection operations, maintains connection state, coordinates pairing workflows, manages peer discovery, and handles credential verification. Injected with platform-specific dependencies at construction.
- **PairingRequest**: Represents a pending pairing between two devices including initiator identity, target identity, request timestamp, timeout, and current pairing state (initiated, pending, accepted, rejected, completed).
- **Connection**: Represents an established P2P connection including peer identity, transport type (WebSocket/QuicVC), connection state (connecting, connected, disconnecting, disconnected), verified credentials, and connection metadata (latency, throughput).
- **GroupConnection**: Represents a multi-party connection for group conversations including group identity, member list (peer identities), per-member connection status, and topology information (mesh/star).
- **PeerIdentity**: Represents a verified peer including identity information from credentials (name, public key), credential verification status, credential expiration, and discovery method (local/relay).
- **DiscoveryService**: Finds available peers using platform-specific discovery mechanisms (injected at construction) including local network discovery and relay-based discovery. Supports filtering by capability and deduplication.
- **CredentialVerifier**: Validates cryptographic credentials during pairing and connection including signature verification, expiration checking, trust chain validation, and revocation checking. Platform-agnostic verification logic.
- **Transport**: Platform-specific interface for network transport (WebSocket, QUIC, etc.) providing send/receive operations, connection lifecycle hooks, and transport-specific configuration. Injected via transport factory.
- **PairingStateMachine**: Manages pairing workflow state transitions including timeout handling, user acceptance/rejection, and completion/failure paths. Ensures state transitions follow valid workflow.
- **ConnectionState**: Tracks connection lifecycle state including connection status, state transition history, error conditions, and reconnection attempt count. Used for monitoring and debugging.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 4 target platforms (browser, electron, iOS, android) can integrate connection.core package and establish P2P connections with less than 500 lines of platform-specific code per platform
- **SC-002**: Connection establishment between two peers completes in under 3 seconds for local network discovery and under 5 seconds for relay-based discovery (from discovery initiation to connected state)
- **SC-003**: Group connections support at least 10 simultaneous peers with message delivery latency under 500ms per peer (measured from send to receive acknowledgment)
- **SC-004**: Cross-platform pairing success rate exceeds 95% for all platform combinations (e.g., iOS to browser, electron to android) under normal network conditions
- **SC-005**: Credential verification during pairing completes in under 1 second and catches 100% of invalid credentials (expired, bad signature, untrusted issuer) in testing
- **SC-006**: QuicVC transport achieves at least 30% lower latency compared to WebSocket transport for peers that support QUIC (measured round-trip message latency)
- **SC-007**: Automatic reconnection after network disruption succeeds within 10 seconds for 90% of disconnections (measured from network restoration to connection re-established)
- **SC-008**: Discovery service finds all available peers on local network within 2 seconds and via relay within 5 seconds
- **SC-009**: Connection.core package test suite achieves 90% code coverage with platform-agnostic unit tests (excluding platform-specific dependency implementations)
- **SC-010**: Connection logic is implemented once in connection.core, reducing total codebase size by at least 60% compared to implementing separately in all 4 platforms
- **SC-011**: Platform developers can add connection capabilities to a new platform in under 2 days of development effort (measured from initial integration to working P2P connections)
- **SC-012**: Connection failures occur with clear error messages that identify root cause (missing dependency, network error, credential failure) in 100% of failure scenarios

### Assumptions

- W3C Verifiable Credentials format is used for credential verification (industry standard for decentralized identity)
- Discovery mechanisms include mDNS/Bonjour for local network and relay server for remote peers (common P2P discovery pattern)
- ONE.core ConnectionsModel provides the underlying protocol layer (as indicated in CLAUDE.md transport architecture)
- Platforms will provide appropriate transport implementations for their environment (browser WebSocket, native iOS networking, etc.)
- Users have network connectivity (local or internet) for discovery and connections to work
- Maximum peer connection limit per platform is at least 50 concurrent connections (sufficient for most group scenarios)
- Pairing timeout is 60 seconds (reasonable user response time)
- Credential re-verification occurs every 24 hours for active connections (balances security with performance)
- Exponential backoff for reconnection uses 1s, 2s, 4s, 8s intervals up to 60s maximum (prevents connection storms)

