# Data Model: Connection Core Package

**Feature**: connection.core
**Date**: 2025-10-23
**Purpose**: Define entities, their properties, relationships, validation rules, and state machines for connection management

## Overview

This document defines the data model for connection.core package. All entities are platform-agnostic TypeScript interfaces/classes. Storage is handled by platform-specific adapters injected via dependency injection.

---

## Entity Diagram

```
┌─────────────────────┐
│ ConnectionManager   │ (orchestrator)
└──────────┬──────────┘
           │
           │ manages
           ├────────────────────────────────┬──────────────────┬─────────────────┐
           │                                │                  │                 │
           ▼                                ▼                  ▼                 ▼
    ┌──────────────┐              ┌──────────────┐    ┌──────────────┐  ┌─────────────┐
    │ Connection   │              │PairingRequest│    │DiscoveryServ│  │ Credential  │
    │              │              │              │    │              │  │  Verifier   │
    └──────┬───────┘              └──────┬───────┘    └──────────────┘  └─────────────┘
           │                             │
           │ uses                        │ creates
           ▼                             ▼
    ┌──────────────┐              ┌──────────────┐
    │  Transport   │              │PeerIdentity  │
    │  (interface) │              │              │
    └──────────────┘              └──────┬───────┘
                                         │
                                         │ verified by
                                         ▼
                                  ┌──────────────┐
                                  │Versioned     │
                                  │Credential    │
                                  └──────────────┘

    ┌──────────────┐
    │Group         │
    │Connection    │ (contains multiple Connections)
    └──────┬───────┘
           │
           │ contains
           ▼
    ┌──────────────┐
    │ Connection[] │ (full mesh topology)
    └──────────────┘
```

---

## Core Entities

### ConnectionManager

**Purpose**: Orchestrates all connection operations including pairing, discovery, connection establishment, and lifecycle management

**Properties**:
| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `oneCore` | `OneCoreInstance` | Yes | ONE.core instance for protocol layer |
| `deps` | `PlatformDependencies` | Yes | Injected platform-specific dependencies |
| `connections` | `Map<string, Connection>` | Yes | Active connections by peer ID |
| `pairingRequests` | `Map<string, PairingRequest>` | Yes | Pending pairing requests by request ID |
| `groupConnections` | `Map<string, GroupConnection>` | Yes | Active group connections by group ID |
| `discoveryService` | `DiscoveryService` | Yes | Peer discovery service |
| `credentialVerifier` | `CredentialVerifier` | Yes | Credential verification service |
| `reconnectionManager` | `ReconnectionManager` | Yes | Handles automatic reconnection |

**Methods**:
- `constructor(oneCore, deps)` - Initialize with dependencies (fail-fast if missing)
- `discoverPeers(): Promise<PeerIdentity[]>` - Discover available peers
- `initiatePairing(peerId): Promise<PairingRequest>` - Start pairing workflow
- `acceptPairing(requestId): Promise<Connection>` - Accept incoming pairing
- `rejectPairing(requestId): void` - Reject incoming pairing
- `connect(peerId): Promise<Connection>` - Establish connection to paired peer
- `disconnect(peerId): void` - Close connection to peer
- `createGroupConnection(groupId, peerIds): Promise<GroupConnection>` - Create group with multiple peers
- `joinGroupConnection(groupId): Promise<GroupConnection>` - Join existing group

**Validation Rules**:
- All dependencies must be provided in constructor (throw if missing)
- Peer IDs must be unique within connections map
- Cannot initiate pairing with already-connected peer
- Cannot create group with < 2 peers

**Relationships**:
- Manages multiple `Connection` instances
- Manages multiple `PairingRequest` instances
- Manages multiple `GroupConnection` instances
- Uses `DiscoveryService` for peer discovery
- Uses `CredentialVerifier` for verification
- Uses `ReconnectionManager` for reconnection

---

### Connection

**Purpose**: Represents an established P2P connection to a single peer

**Properties**:
| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique connection ID (generated) |
| `peerId` | `string` | Yes | Remote peer identity |
| `state` | `ConnectionState` | Yes | Current connection state |
| `transport` | `Transport` | Yes | Network transport implementation |
| `transportType` | `'quicvc' \| 'websocket'` | Yes | Negotiated transport type |
| `credential` | `VerifiedCredential` | Yes | Verified peer credential |
| `establishedAt` | `number` | Yes | Connection establishment timestamp (ms) |
| `lastActivityAt` | `number` | Yes | Last send/receive timestamp (ms) |
| `metadata` | `ConnectionMetadata` | No | Optional latency, throughput stats |

**Methods**:
- `send(data): Promise<void>` - Send data to peer
- `close(): void` - Gracefully close connection
- `isAlive(): boolean` - Check if connection is active
- `updateActivity(): void` - Update last activity timestamp

**State Machine** (see ConnectionState below)

**Validation Rules**:
- Peer ID must match verified credential subject
- Transport must be in connected state
- Cannot send data if state is not 'connected'
- Last activity must be updated on send/receive

**Relationships**:
- Uses one `Transport` instance
- Has one verified `VersionedCredential`
- Belongs to zero or one `GroupConnection`
- Tracked by `ConnectionState`

---

### ConnectionState

**Purpose**: Tracks connection lifecycle state and transitions

**States**:
```
CONNECTING → CONNECTED → DISCONNECTING → DISCONNECTED
     ↓                          ↑
     └─────────(error)──────────┘
```

**Properties**:
| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `current` | `'connecting' \| 'connected' \| 'disconnecting' \| 'disconnected'` | Yes | Current state |
| `previous` | `ConnectionStateValue \| null` | No | Previous state for history |
| `transitionedAt` | `number` | Yes | Last transition timestamp |
| `errorCount` | `number` | Yes | Count of errors encountered |
| `reconnectAttempts` | `number` | Yes | Count of reconnection attempts |

**State Transitions**:
| From | To | Trigger | Validation |
|------|-----|---------|------------|
| null | connecting | `connect()` called | Must have transport |
| connecting | connected | Transport handshake complete | Credentials verified |
| connecting | disconnected | Connection failed | Record error |
| connected | disconnecting | `close()` called | Must be connected |
| connected | disconnected | Network error | Trigger reconnection |
| disconnecting | disconnected | Close complete | Clean up resources |

**Validation Rules**:
- Cannot transition to same state (must change)
- Cannot skip states (connecting → disconnected only on error)
- Transition timestamps must be monotonically increasing

---

### PairingRequest

**Purpose**: Represents a pending pairing between two devices

**Properties**:
| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique request ID (generated) |
| `initiatorId` | `string` | Yes | Device initiating pairing |
| `targetId` | `string` | Yes | Device being paired with |
| `state` | `PairingState` | Yes | Current pairing state |
| `method` | `'qr' \| 'numeric' \| 'proximity'` | Yes | Pairing method used |
| `credential` | `VersionedCredential` | Yes | Initiator's credential |
| `verificationCode` | `string \| null` | No | Numeric code for verification (if method = 'numeric') |
| `createdAt` | `number` | Yes | Request creation timestamp |
| `expiresAt` | `number` | Yes | Request expiration timestamp (createdAt + 60s) |
| `responseCallback` | `(accepted: boolean) => void` | Yes | Callback for response |

**State Machine**:
```
INITIATED → PENDING → ACCEPTED → COMPLETED
                ↓
            REJECTED
                ↓
            TIMEOUT
```

**State Transition Table**:
| State | Next States | Trigger |
|-------|-------------|---------|
| initiated | pending | Request sent to target |
| pending | accepted, rejected, timeout | User response or timeout |
| accepted | completed | Credential exchange done |
| rejected | (terminal) | User rejected |
| timeout | (terminal) | 60s elapsed |

**Methods**:
- `isExpired(): boolean` - Check if request timed out
- `accept(): void` - Accept pairing (transitions to accepted)
- `reject(): void` - Reject pairing (transitions to rejected)
- `complete(): void` - Mark as completed (transitions to completed)

**Validation Rules**:
- Request ID must be unique across all requests
- Expiration must be createdAt + 60000ms
- Cannot accept/reject after expiration
- Verification code required if method is 'numeric' (6-8 digits)

**Relationships**:
- Created by `ConnectionManager.initiatePairing()`
- Results in `Connection` if accepted
- Contains initiator's `VersionedCredential`

---

### PeerIdentity

**Purpose**: Represents a discovered or known peer with identity information

**Properties**:
| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique peer ID (from credential) |
| `name` | `string` | Yes | Human-readable peer name |
| `publicKey` | `string` | Yes | Peer's public key (for encryption/signing) |
| `credential` | `VersionedCredential` | Yes | Verified credential |
| `credentialStatus` | `'valid' \| 'expired' \| 'revoked' \| 'unverified'` | Yes | Verification status |
| `discoveryMethod` | `'local' \| 'relay'` | Yes | How peer was discovered |
| `address` | `string` | Yes | Network address (IP or relay URL) |
| `capabilities` | `string[]` | Yes | Supported features/transports |
| `discoveredAt` | `number` | Yes | Discovery timestamp |
| `lastSeenAt` | `number` | Yes | Last activity timestamp |

**Methods**:
- `isCredentialValid(): boolean` - Check credential validity
- `supportsCapability(cap): boolean` - Check if peer supports capability
- `updateLastSeen(): void` - Update last seen timestamp

**Validation Rules**:
- ID must match credential subject ID
- Public key must match credential public key
- Address format validated based on discovery method (IP for local, URL for relay)
- Capabilities must be non-empty array

**Relationships**:
- Discovered by `DiscoveryService`
- Contains one `VersionedCredential`
- Used to create `Connection`

---

### VersionedCredential

**Purpose**: W3C Verifiable Credential with versioning for revocation

**Properties**:
| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `@context` | `string[]` | Yes | W3C VC context URIs |
| `type` | `string[]` | Yes | Credential types (must include "VerifiableCredential") |
| `id` | `string` | Yes | Credential ID (versioned: `did:example:123#v1`) |
| `issuer` | `string` | Yes | Issuer DID |
| `issuanceDate` | `string` | Yes | ISO 8601 issuance date |
| `expirationDate` | `string` | Yes | ISO 8601 expiration date |
| `credentialSubject` | `CredentialSubject` | Yes | Claims about the subject |
| `proof` | `CryptographicProof` | Yes | Signature proof |
| `validFrom` | `string` | Yes | ISO 8601 validity start (for revocation via backdating) |
| `version` | `number` | Yes | Credential version number |

**CredentialSubject**:
```typescript
interface CredentialSubject {
  id: string;              // Subject DID
  name: string;            // Human-readable name
  publicKey: string;       // Base64-encoded public key
  deviceId?: string;       // Optional device identifier
}
```

**CryptographicProof**:
```typescript
interface CryptographicProof {
  type: string;            // "Ed25519Signature2020"
  created: string;         // ISO 8601 signature timestamp
  verificationMethod: string;  // Public key reference
  proofPurpose: string;    // "assertionMethod"
  proofValue: string;      // Base64-encoded signature
}
```

**Revocation Logic**:
- To revoke credential with ID `did:example:123#v1`: Issue new credential `did:example:123#v2` with `validFrom` set to date before v1's `issuanceDate`
- Verification checks for newer versions with earlier `validFrom` dates
- If found: Original credential is revoked

**Validation Rules**:
- `@context` must include "https://www.w3.org/2018/credentials/v1"
- `type` must include "VerifiableCredential"
- `expirationDate` must be after `issuanceDate`
- `validFrom` must be before or equal to `issuanceDate` (for non-revocation)
- `proof.verificationMethod` must resolve to valid public key
- Signature verification must pass using issuer's public key

**Relationships**:
- Issued by identity provider (or self-issued)
- Held by `PeerIdentity`
- Verified by `CredentialVerifier`

---

### GroupConnection

**Purpose**: Represents a multi-party connection using full mesh topology

**Properties**:
| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `groupId` | `string` | Yes | Unique group identifier |
| `memberIds` | `string[]` | Yes | List of peer IDs in group (includes self) |
| `connections` | `Map<string, Connection>` | Yes | P2P connections to each member |
| `topology` | `'mesh'` | Yes | Connection topology (always mesh for initial implementation) |
| `createdAt` | `number` | Yes | Group creation timestamp |
| `memberStatus` | `Map<string, 'connected' \| 'disconnected' \| 'connecting'>` | Yes | Per-member connection status |

**Methods**:
- `addMember(peerId): Promise<void>` - Add new member (establish connections)
- `removeMember(peerId): void` - Remove member (close connections)
- `broadcast(data): Promise<void>` - Send data to all connected members
- `getMemberStatus(peerId): string` - Get connection status for member
- `getConnectedMembers(): string[]` - List of currently connected members

**Topology Invariant** (Full Mesh):
- For N members, each member has N-1 connections
- Total connections in group: N * (N-1) / 2
- Every member is directly connected to every other member

**Validation Rules**:
- Group must have at least 2 members (including self)
- Maximum 10 members (per target scale)
- All member IDs must be unique
- Cannot remove self from group (leave instead)
- Connections map must have entry for each member (except self)

**Relationships**:
- Contains multiple `Connection` instances (one per peer)
- Managed by `ConnectionManager`

---

## Platform Dependency Interfaces

These interfaces define the contracts that platform-specific implementations must satisfy:

### PlatformDependencies

**Purpose**: Bundle of all platform-specific dependencies injected into ConnectionManager

```typescript
interface PlatformDependencies {
  transport: TransportFactory;
  storage: StorageAdapter;
  ui: UICallbacks;
  oneCore: OneCoreInstance;
}
```

---

### TransportFactory

**Purpose**: Creates platform-specific transport implementations

```typescript
interface TransportFactory {
  // Create transport for given type
  create(type: 'quicvc' | 'websocket'): Transport;

  // Get list of supported transports on this platform
  getSupportedTransports(): ('quicvc' | 'websocket')[];
}
```

---

### Transport (Interface)

**Purpose**: Platform-agnostic network transport abstraction

```typescript
interface Transport {
  // Connect to remote peer
  connect(address: string): Promise<void>;

  // Send data to peer
  send(data: Uint8Array): Promise<void>;

  // Receive data from peer (event-based)
  onReceive(callback: (data: Uint8Array) => void): void;

  // Close connection
  close(): void;

  // Get connection state
  getState(): 'connecting' | 'connected' | 'disconnected';

  // Transport type
  readonly type: 'quicvc' | 'websocket';
}
```

---

### StorageAdapter

**Purpose**: Platform-specific storage for connection data

```typescript
interface StorageAdapter {
  // Store peer identity
  storePeer(peer: PeerIdentity): Promise<void>;

  // Retrieve peer by ID
  getPeer(peerId: string): Promise<PeerIdentity | null>;

  // List all known peers
  listPeers(): Promise<PeerIdentity[]>;

  // Store credential
  storeCredential(credential: VersionedCredential): Promise<void>;

  // Retrieve credential by ID
  getCredential(credentialId: string): Promise<VersionedCredential | null>;

  // List credentials for subject
  listCredentials(subjectId: string): Promise<VersionedCredential[]>;

  // Remove data (for cleanup)
  removePeer(peerId: string): Promise<void>;
}
```

---

### UICallbacks

**Purpose**: Platform-specific UI interaction callbacks

```typescript
interface UICallbacks {
  // Show pairing request to user for approval
  onPairingRequest(request: {
    peerId: string;
    peerName: string;
    method: 'qr' | 'numeric' | 'proximity';
    verificationCode?: string;
  }): Promise<boolean>;  // Returns true if accepted

  // Show error message to user
  onError(error: {
    code: string;
    message: string;
    context?: any;
  }): void;

  // Show connection state change
  onConnectionStateChange(peerId: string, state: string): void;
}
```

---

## Service Entities

### DiscoveryService

**Purpose**: Discovers available peers using local network and relay mechanisms

**Properties**:
| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `localDiscovery` | `LocalDiscovery \| null` | No | Platform-specific local network discovery |
| `relayDiscovery` | `RelayDiscovery` | Yes | Relay server discovery |
| `discoveredPeers` | `Map<string, PeerIdentity>` | Yes | Cache of discovered peers |
| `isScanning` | `boolean` | Yes | Whether discovery is active |

**Methods**:
- `startDiscovery(): void` - Begin discovering peers
- `stopDiscovery(): void` - Stop discovery
- `getDiscoveredPeers(): PeerIdentity[]` - Get list of discovered peers
- `filterByCapability(capability): PeerIdentity[]` - Filter peers by capability

**Validation Rules**:
- Cannot start discovery if already scanning
- Discovered peers must be deduplicated by ID
- Local network peers take precedence over relay peers

---

### CredentialVerifier

**Purpose**: Verifies cryptographic credentials and checks revocation

**Properties**:
| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `trustedIssuers` | `Set<string>` | Yes | List of trusted issuer DIDs |
| `storage` | `StorageAdapter` | Yes | For retrieving credential versions |

**Methods**:
- `verify(credential): Promise<VerificationResult>` - Full verification
- `checkSignature(credential): boolean` - Verify cryptographic signature
- `checkExpiration(credential): boolean` - Check if expired
- `checkRevocation(credential): Promise<boolean>` - Check for newer versions
- `checkTrustChain(credential): boolean` - Verify issuer is trusted

**Verification Flow**:
1. Check signature validity
2. Check expiration (expirationDate > now)
3. Check trust chain (issuer in trustedIssuers)
4. Check revocation (query storage for newer versions with earlier validFrom)
5. Return result (valid, expired, revoked, untrusted, invalid_signature)

**Validation Rules**:
- Signature verification must use issuer's public key
- Revocation check must query all versions of same credential ID
- Trust chain only validates if trustedIssuers is non-empty (else skip)

---

### ReconnectionManager

**Purpose**: Handles automatic reconnection with exponential backoff

**Properties**:
| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `reconnectionTasks` | `Map<string, ReconnectionTask>` | Yes | Active reconnection tasks by peer ID |
| `backoffSchedule` | `number[]` | Yes | `[1000, 2000, 4000, 8000, 16000, 32000, 60000]` (ms) |
| `maxAttempts` | `number` | Yes | `10` maximum reconnection attempts |

**ReconnectionTask**:
```typescript
interface ReconnectionTask {
  peerId: string;
  attempts: number;
  nextAttemptAt: number;
  timeoutHandle: any;
}
```

**Methods**:
- `scheduleReconnection(peerId): void` - Schedule reconnection for disconnected peer
- `cancelReconnection(peerId): void` - Cancel reconnection task
- `attemptReconnection(peerId): Promise<Connection>` - Execute reconnection attempt

**Reconnection Logic**:
1. On disconnection: Schedule reconnection with 1s delay
2. On attempt failure: Double delay (exponential backoff), max 60s
3. On success: Remove task, reset attempts
4. On max attempts: Give up, emit error

**Validation Rules**:
- Cannot schedule reconnection for connected peer
- Backoff delay must follow exponential schedule
- Must cancel timeout handle when task removed

---

## Validation Summary

### Cross-Entity Validations

| Validation | Entities | Rule |
|------------|----------|------|
| Peer ID consistency | PeerIdentity, Connection, PairingRequest | Peer ID must match credential subject ID |
| Transport compatibility | Connection, Transport | Transport type must be in peer capabilities |
| Group membership | GroupConnection, Connection | All group members must have active connections (mesh) |
| Credential validity | VersionedCredential, PeerIdentity | Credential must not be expired or revoked |
| Pairing timeout | PairingRequest | Request must complete within 60s |
| Connection limits | ConnectionManager | Maximum 50 concurrent connections |
| Group size | GroupConnection | Maximum 10 members |

---

## State Persistence

**What is persisted** (via StorageAdapter):
- `PeerIdentity` - All discovered and paired peers
- `VersionedCredential` - All credentials (for revocation checking)
- Group membership (if implemented)

**What is ephemeral** (in-memory only):
- `Connection` - Rebuilt on app restart
- `PairingRequest` - Expire on app close
- `ConnectionState` - Reset on restart
- Discovery results - Re-discovered on demand

**Rationale**: Connections are network state (recreated when needed). Peer identities and credentials are durable identity data (must persist).

