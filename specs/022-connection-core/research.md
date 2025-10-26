# Research: Connection Core Package

**Feature**: connection.core platform-agnostic connection management package
**Date**: 2025-10-23
**Purpose**: Document technical decisions, research findings, and rationale for implementation approach

## Overview

This document captures research into platform-agnostic P2P connection management, dependency injection patterns for multi-platform TypeScript packages, credential verification strategies, and mesh topology implementations. All research supports building connection.core to work identically across browser, electron, iOS, and android platforms.

---

## Decision 1: Dependency Injection Pattern

**Decision**: Use constructor injection with interface-based contracts (TypeScript interfaces for dependency types)

**Rationale**:
- Proven pattern via TopicGroupManager in existing codebase (browser-ui/src/model/Model.ts:145-155)
- Enables compile-time type checking for injected dependencies
- Allows mock implementations for testing without platform code
- Clear contract definition between platform-agnostic core and platform-specific adapters
- No runtime dependency on specific platform implementations

**Implementation Approach**:
```typescript
interface PlatformDependencies {
  transport: TransportFactory;
  storage: StorageAdapter;
  ui: UICallbacks;
  oneCore: OneCoreInstance;
}

class ConnectionManager {
  constructor(
    private oneCore: OneCoreInstance,
    private deps: PlatformDependencies
  ) {
    // Validate dependencies fail-fast
    if (!deps.transport || !deps.storage || !deps.ui) {
      throw new Error('Missing required dependencies');
    }
  }
}
```

**Alternatives Considered**:
- **Service locator pattern**: Rejected because it hides dependencies and makes testing harder
- **Singleton with platform detection**: Rejected because it couples core to platform detection logic
- **Factory pattern**: Rejected because it adds indirection without clear benefit over constructor injection

**References**:
- Existing pattern: `/browser-ui/src/model/Model.ts` (TopicGroupManager injection)
- CLAUDE.md: "Follows existing chat.core/lama.core pattern and TopicGroupManager dependency injection pattern"

---

## Decision 2: W3C Verifiable Credentials for Identity

**Decision**: Use W3C Verifiable Credentials (VCs) specification for peer identity and verification

**Rationale**:
- Industry standard for decentralized identity (W3C Recommendation since 2019)
- Built-in support for cryptographic signatures and verification
- Extensible data model supports custom claims
- Well-defined revocation mechanisms (Status List 2021)
- Multiple library implementations available (did-jwt-vc, @digitalcredentials/vc)

**Implementation Approach**:
- Credentials issued by lama identity provider (or self-signed for initial implementation)
- Each peer presents VC during pairing containing identity claims and public key
- Verifier checks: signature validity, expiration, issuer trust, revocation status
- Revocation via versioned credentials (new version with past validity period invalidates old)

**Custom Revocation Strategy** (from user clarification):
Instead of CRL/OCSP/Status List, use credential versioning:
- When revoking: Issue new credential version with `validFrom` set to past date (before old credential issue date)
- Verification logic: Check for newer versions of same credential ID
- If newer version exists with earlier validity: Old credential is revoked
- Benefits: No online revocation checks, works offline, simple logic

**Alternatives Considered**:
- **X.509 certificates**: Rejected because designed for hierarchical PKI, not P2P scenarios
- **Custom credential format**: Rejected because reinventing standards increases security risk
- **No credentials (trust on first use)**: Rejected because provides no protection against impersonation

**References**:
- W3C VC Data Model: https://www.w3.org/TR/vc-data-model/
- Status List 2021: https://w3c-ccg.github.io/vc-status-list-2021/
- Spec FR-005: "verify cryptographic credentials during connection establishment"
- Spec FR-020: "Credential verification MUST handle credential revocation through versioned credentials"

---

## Decision 3: Full Mesh Topology for Groups

**Decision**: Implement full mesh topology where every peer connects directly to every other peer in a group

**Rationale**:
- No single point of failure (any peer can go offline without breaking group)
- Direct message delivery (no relay hop, lower latency)
- Simpler state management (no coordinator election or failover logic)
- Acceptable for target scale (10 peers = 45 connections total, manageable)
- Aligns with P2P philosophy (no central coordinator)

**Scaling Limitations**:
- O(N²) connection overhead (N peers = N*(N-1)/2 connections)
- 10 peers: 45 total connections across all peers (4.5 avg per peer)
- 20 peers: 190 total connections (9.5 avg per peer) - approaching limits
- Beyond 15-20 peers, star or hybrid topology becomes necessary

**Implementation Notes**:
- When peer joins group: Discovers all existing members, initiates N connections
- When peer leaves: Other peers detect disconnection, update topology
- Message delivery: Send directly to each connected peer (no forwarding)
- Connection failures: Isolated to that peer pair, doesn't affect other connections

**Alternatives Considered**:
- **Star topology with coordinator**: Rejected because single point of failure, not truly P2P
- **Hybrid (mesh → star)**: Rejected for initial implementation to keep it simple (can add later)
- **Tree topology**: Rejected because adds complexity for routing and doesn't fit group chat use case

**References**:
- Spec FR-019: "full mesh architecture where every peer establishes direct P2P connections"
- Spec SC-003: "Group connections support at least 10 simultaneous peers"
- User clarification Q2: "start with p2p" (interpreted as full mesh)

---

## Decision 4: Multiple Pairing Methods with Platform Selection

**Decision**: Support QR code, numeric code, and proximity-based pairing with runtime platform selection

**Rationale**:
- Different platforms have different capabilities (camera, NFC, Bluetooth)
- User scenarios vary (desktop-to-mobile vs mobile-to-mobile)
- Maximum flexibility without forcing all platforms to implement all methods

**Pairing Method Details**:

**QR Code Scanning**:
- Platform requirement: Camera access
- Flow: Device A displays QR code containing pairing info (device ID, public key, relay address), Device B scans QR, initiates connection
- Best for: Desktop-to-mobile, any distance (QR can be sent via image)
- Libraries: qrcode (generation), @zxing/library (scanning)

**Numeric Code Verification**:
- Platform requirement: Input capability (keyboard/touch)
- Flow: Device A displays 6-8 digit code, Device B user enters code to confirm identity match
- Best for: Phone-to-desktop, accessibility scenarios
- Security: MITM protection via out-of-band code verification

**Proximity-Based Auto-Pairing**:
- Platform requirement: Bluetooth or NFC
- Flow: Devices detect each other's presence, automatically initiate pairing with user confirmation
- Best for: Mobile-to-mobile, same physical location
- Libraries: Platform-specific (Web Bluetooth API for browser, CoreBluetooth for iOS)

**Platform Selection Logic**:
```typescript
interface PairingMethod {
  type: 'qr' | 'numeric' | 'proximity';
  isAvailable(): boolean;  // Platform checks capability
  initiate(): Promise<PairingRequest>;
}

// Platform provides available methods
const deps = {
  pairingMethods: [
    new QRCodePairing(),      // Browser: available if camera API present
    new NumericCodePairing(), // Always available
    // ProximityPairing not available on desktop platforms
  ]
};
```

**Alternatives Considered**:
- **Single pairing method**: Rejected because limits platform flexibility
- **Out-of-band only (manual key exchange)**: Rejected because poor UX for non-technical users
- **NFC-only**: Rejected because not available on all platforms

**References**:
- Spec FR-018: "support multiple user-friendly pairing methods including QR code scanning, numeric code verification, and proximity-based auto-pairing"
- User clarification Q1: "D - All three methods"

---

## Decision 5: QuicVC as Optional Transport Layer

**Decision**: Support QuicVC as a pluggable transport alongside WebSocket, negotiated during connection establishment

**Rationale**:
- QUIC provides lower latency and better performance than WebSocket (0-RTT connection, multiplexing)
- Not all platforms support QUIC (browser support limited, mobile requires native implementation)
- Transport negotiation allows peer capability matching (both support QUIC → use QUIC, otherwise WebSocket)
- ONE.core ConnectionsModel is transport-agnostic (works over any reliable transport)

**Transport Negotiation Flow**:
1. Peer A advertises supported transports during discovery (e.g., `[quicvc, websocket]`)
2. Peer B compares with own supported transports
3. Select highest-priority mutual transport (QUIC > WebSocket)
4. Establish connection using selected transport
5. No fallback after transport selected (fail fast if connection fails)

**QuicVC Integration**:
- Builds on existing transport architecture (CLAUDE.md Transport Architecture section)
- QuicVC is application protocol layer above QUIC transport
- ConnectionsModel handles CHUM protocol (sync logic)
- QuicVCTransport adapts QUIC to ConnectionsModel's transport interface

**Alternatives Considered**:
- **QUIC-only**: Rejected because browser and mobile platforms lack universal QUIC support
- **WebSocket-only**: Rejected because leaves performance gains on the table for platforms that support QUIC
- **Automatic fallback on error**: Rejected per "no fallbacks" principle - negotiation happens once, no retry with different transport

**References**:
- CLAUDE.md: "Transport Layers: QUIC (future direct P2P), WebSocket (current)"
- Spec FR-007: "integrate QuicVC protocol layer and support QUIC as a pluggable transport option"
- Spec SC-006: "QuicVC transport achieves at least 30% lower latency compared to WebSocket"

---

## Decision 6: Platform-Agnostic Package with TypeScript

**Decision**: Build connection.core as TypeScript library package with platform-agnostic code and interface-based platform adapters

**Rationale**:
- TypeScript provides type safety across platform boundaries
- Compiles to JavaScript (works on browser, electron, React Native bridge)
- Type interfaces define clear contracts for platform implementations
- Single codebase, single test suite (minus platform-specific adapters)
- NPM package works for browser/electron, can expose via bridge for mobile

**Package Structure**:
```
connection.core/
├── package.json         # NPM package definition
├── tsconfig.json        # TypeScript config (target: ES2020, module: ESNext)
├── src/                 # TypeScript source
├── dist/                # Compiled JavaScript output
│   ├── esm/            # ES modules (browser)
│   └── cjs/            # CommonJS (electron/Node)
└── types/              # TypeScript declarations
```

**Platform Integration**:
- **Browser**: `import { ConnectionManager } from 'connection.core'` (ESM)
- **Electron**: `const { ConnectionManager } = require('connection.core')` (CJS)
- **iOS/Android**: Expose via React Native bridge or native module wrapper

**Alternatives Considered**:
- **Separate packages per platform**: Rejected because defeats purpose of reusable core
- **Monorepo with shared code**: Rejected because adds build complexity for single package
- **Plain JavaScript**: Rejected because lose type safety benefits

**References**:
- Spec FR-010: "Package MUST work identically across all 4 target platforms"
- Spec FR-015: "Package MUST provide TypeScript type definitions for all public APIs"
- Existing pattern: chat.core and lama.core are platform-agnostic packages

---

## Decision 7: Discovery via Local Network + Relay Server

**Decision**: Implement dual discovery mechanism using local network (mDNS pattern) and relay server for remote peers

**Rationale**:
- Local network discovery is fast (<2s) and works without internet
- Relay discovery enables pairing across different networks (home → office)
- Deduplication ensures same peer isn't discovered twice
- Preference for local connections reduces relay load and latency

**Local Network Discovery** (mDNS/Bonjour pattern):
- Platforms broadcast presence on local network
- Other peers listen for broadcasts, discover available devices
- Works on same WiFi/LAN without internet connection
- Implementation: Platform-specific (Bonjour for iOS, mDNS for browser/electron)

**Relay-Based Discovery**:
- Peers register presence with relay server (include device ID, public key, relay address)
- Other peers query relay for available devices
- Relay facilitates initial connection, then peers connect directly (STUN/TURN pattern)
- Implementation: Shared relay server (e.g., commserver from existing architecture)

**Deduplication Logic**:
```typescript
// Peer discovered via both local and relay
const localPeer = { id: 'peer-123', source: 'local', address: '192.168.1.100' };
const relayPeer = { id: 'peer-123', source: 'relay', address: 'relay.example.com' };

// Deduplicate by ID, prefer local
const uniquePeer = { ...localPeer };  // Local takes precedence
```

**Alternatives Considered**:
- **Local-only**: Rejected because limits pairing to same network
- **Relay-only**: Rejected because misses optimization for local network
- **DHT-based discovery**: Rejected because adds complexity and bootstrap node requirements

**References**:
- Spec FR-006: "provide discovery services that support both local network discovery (mDNS/Bonjour pattern) and relay-based discovery"
- Spec SC-008: "Discovery service finds all available peers on local network within 2 seconds and via relay within 5 seconds"

---

## Decision 8: Fail-Fast Error Handling

**Decision**: Throw errors immediately when dependencies are missing, invalid, or operations fail - no fallbacks or mitigation

**Rationale**:
- Aligns with project principle: "No fallbacks. We do not mitigate. We fail fast and throw"
- Makes errors visible and forces proper fixes (not silent degradation)
- Simplifies code (no complex fallback logic)
- Easier debugging (error location is where problem occurs)

**Exception**: Transport negotiation is the only acceptable "fallback" - selecting WebSocket when QUIC unavailable is capability matching, not error mitigation

**Error Handling Patterns**:
```typescript
// ✅ CORRECT: Fail fast on missing dependency
constructor(deps: PlatformDependencies) {
  if (!deps.transport) {
    throw new Error('Transport factory is required');
  }
}

// ❌ WRONG: Fallback to default
constructor(deps: PlatformDependencies) {
  this.transport = deps.transport || new DefaultTransport();  // NO!
}

// ✅ CORRECT: Transport negotiation (not fallback)
const transport = negotiateTransport(myCapabilities, peerCapabilities);
if (!transport) {
  throw new Error('No compatible transport with peer');
}

// ✅ CORRECT: Fail on connection error
async connect(peer: PeerIdentity): Promise<Connection> {
  const conn = await transport.connect(peer.address);
  if (!conn) {
    throw new Error(`Failed to connect to ${peer.id}`);
  }
  return conn;
}
```

**Alternatives Considered**:
- **Graceful degradation**: Rejected per project principles
- **Retry with backoff**: Only used for reconnection (intentional, not error mitigation)
- **Default implementations**: Rejected because hides missing platform dependencies

**References**:
- CLAUDE.md: "No fallbacks. We do not mitigate. We fail fast and throw. We fix our problems"
- Spec FR-009: "Package MUST fail fast when required platform dependencies are missing or invalid (no fallbacks, no mitigation)"

---

## Decision 9: Reconnection with Exponential Backoff

**Decision**: Implement automatic reconnection after network disruption using exponential backoff (1s, 2s, 4s, 8s, max 60s)

**Rationale**:
- Network disruptions are transient (WiFi handoff, brief outages)
- Automatic reconnection improves UX (user doesn't manually reconnect)
- Exponential backoff prevents connection storms when network returns
- This is intentional retry logic, not error mitigation

**Reconnection Logic**:
```typescript
class ReconnectionManager {
  private attempts = 0;
  private readonly backoffSchedule = [1000, 2000, 4000, 8000, 16000, 32000, 60000];

  async reconnect(peer: PeerIdentity): Promise<Connection> {
    const delay = this.backoffSchedule[Math.min(this.attempts, this.backoffSchedule.length - 1)];
    await sleep(delay);

    try {
      const conn = await this.connectionManager.connect(peer);
      this.attempts = 0;  // Reset on success
      return conn;
    } catch (error) {
      this.attempts++;
      if (this.attempts < 10) {  // Max 10 attempts
        return this.reconnect(peer);  // Retry
      }
      throw new Error(`Reconnection failed after ${this.attempts} attempts`);
    }
  }
}
```

**Trigger**: Network state change (from offline → online) or periodic connection health check

**Alternatives Considered**:
- **No automatic reconnection**: Rejected because poor UX for mobile scenarios
- **Fixed delay**: Rejected because can cause thundering herd problem
- **Immediate reconnection**: Rejected because wastes resources if network still unstable

**References**:
- Spec FR-011: "Package MUST support automatic reconnection when network connectivity is restored after disconnection (with exponential backoff)"
- Spec SC-007: "Automatic reconnection after network disruption succeeds within 10 seconds for 90% of disconnections"
- CLAUDE.md: "delays are for arseholes. do not be one" - But this is intentional backoff, not arbitrary delay

---

## Summary of Key Technical Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| Architecture Pattern | Dependency Injection | Platform-agnostic core, proven pattern in codebase |
| Identity/Security | W3C Verifiable Credentials | Industry standard, extensible, well-defined verification |
| Revocation | Versioned credentials with backdated validity | Offline-capable, no revocation list servers needed |
| Group Topology | Full mesh P2P | No single point of failure, simple for target scale (10 peers) |
| Pairing Methods | QR + Numeric + Proximity | Maximum flexibility, platform selects based on capabilities |
| Transport | QuicVC + WebSocket (negotiated) | Performance where available, compatibility everywhere |
| Language | TypeScript | Type safety, cross-platform compilation, interface contracts |
| Discovery | Local network + Relay server | Fast local discovery, remote pairing capability |
| Error Handling | Fail-fast, no fallbacks | Clear errors, forces fixes, aligns with project principles |
| Reconnection | Exponential backoff | Automatic recovery, prevents connection storms |

All decisions support the primary goal: Single implementation of connection logic used identically across 4 platforms with <500 LOC platform-specific adapter code per platform.

