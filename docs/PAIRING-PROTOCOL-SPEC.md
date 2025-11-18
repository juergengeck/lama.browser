# Pairing Protocol Specification

## Overview

This document specifies the complete pairing protocol flow in ONE.models, clarifying roles, responsibilities, and the CHUM transition.

## Terminology

- **Invitation Creator (Alice)**: The peer who creates the pairing invitation
- **Invitation Accepter (Bob)**: The peer who accepts the pairing invitation
- **Connection Initiator**: The peer who actively opens the connection (in our case, Bob)
- **Connection Accepter**: The peer who passively accepts the connection (in our case, Alice)

## Critical Insight

In the pairing flow:
- **Alice** creates invitation but ACCEPTS the connection → `initiatedLocally: false`
- **Bob** accepts invitation and INITIATES the connection → `initiatedLocally: true`

The `initiatedLocally` flag refers to WHO OPENED THE CONNECTION, not who created the invitation.

## Complete Protocol Flow

```
Alice (Invitation Creator)                    Bob (Invitation Accepter)
        |                                              |
        |  1. createInvitation()                       |
        |  → PairingManager.createInvitation()         |
        |  → Invitation URL generated                  |
        |------- Share URL --------------------------->|
        |                                              |
        |                                              |  2. acceptPairingInvitation(url)
        |                                              |  → ConnectionPlan.acceptPairingInvitation()
        |                                              |  → PairingManager.connectUsingInvitation()
        |                                              |  → Initiates WebSocket connection
        |                                              |
        |  3. Incoming connection                      |
        |  ← LeuteConnectionsModule.onIncomingConn     |
        |  ← Routes to PairingManager                  |
        |  ← PairingManager.acceptInvitation()         |
        |                                              |
        |  4. Pairing Protocol (WebSocket handshake)   |
        |<---------- Exchange keys + verify ---------->|
        |<---------- Authenticate both sides ---------->|
        |                                              |
        |  5. Pairing Success                          |  5. Pairing Success
        |  ← onPairingSuccess()                        |  ← onPairingSuccess()
        |     initiatedLocally: false                  |     initiatedLocally: true
        |     Connection kept alive                    |     Connection kept alive
        |                                              |
        |                                              |  6. CHUM Transition (Bob initiates)
        |                                              |  ← startChumAfterPairing callback
        |                                              |  → startChumProtocol(initiatedLocally=true)
        |                                              |  → Send CHUM handshake
        |                                              |
        |  7. CHUM Acceptance (Alice responds)         |
        |  ← Incoming CHUM request                     |
        |  ← onProtocolStart() handler                 |
        |  ← Validates access rights                   |
        |  ← Accepts CHUM protocol                     |
        |                                              |
        |  8. CHUM Established                         |  8. CHUM Established
        |  ← Connection tracked in connectionsInfo()   |  ← Connection tracked in connectionsInfo()
        |<---------- Sync Person/Profile objects ----->|
        |                                              |
```

## Key Components

### 1. PairingManager

**Responsibilities:**
- Manages pairing invitations (create, validate, expire)
- Handles pairing protocol on both sides
- Emits `onPairingSuccess` event
- **Only calls `startChumAfterPairing` on connection initiator side**

**Critical Code Paths:**

```typescript
// Alice side (acceptInvitation) - Line 316-329
this.onPairingSuccess.emit(..., initiatedLocally: false, ...);
// Does NOT call startChumAfterPairing - waits for incoming CHUM

// Bob side (connectUsingInvitation) - Line 222-244
this.onPairingSuccess.emit(..., initiatedLocally: true, ...);
if (this.startChumAfterPairing) {
    setImmediate(() => chumHandler(conn, ...));  // Bob starts CHUM
}
```

### 2. ConnectionsModel

**Responsibilities:**
- Manages ConnectionsModel lifecycle and CHUM protocol transitions
- **NO LONGER** provides PairingManager with CHUM starter callback
- Handles CHUM protocol start via `onProtocolStart` event
- Validates access rights before accepting CHUM
- Tracks established connections

**Fixed CHUM Initialization:**
```typescript
// OLD (BROKEN) - Passed callback to PairingManager that competed with onProtocolStart
this.pairing = new PairingManager(
    leuteModel,
    expirationDuration,
    commServerUrl,
    async (conn, ...) => { await startChumProtocol(...); }  // ❌ RACE CONDITION
);

// NEW (FIXED) - Listen to onProtocolStart AFTER pairing succeeds
this.connectionsModel.pairing.onProtocolStart.on(async (conn, info) => {
    // This fires AFTER PairingManager negotiates initiatedLocally flag
    // Only ONE side starts CHUM as sender (the invitation creator)
    if (shouldStartCHUM(info.initiatedLocally)) {
        await startChumProtocol(conn, ..., initiatedLocally: info.initiatedLocally);
    }
});
```

### 3. LeuteConnectionsModule

**Responsibilities:**
- Manages all connection routes and route groups
- Tracks connections in `connectionRouteManager`
- Provides `connectionsInfo()` to query active connections
- Dispatches incoming protocol requests to handlers

**Connection Tracking:**
- Connections are registered when route groups are established
- `connectionsInfo()` queries `connectionRouteManager.connectionRoutesInformation()`
- Filters by `groupName` ('pairing', 'chum', etc.)

## CHUM Transition Rules

### Single Initiator Rule (FIXED)

**Critical Fix: Listen to `onProtocolStart` event instead of `onPairingSuccess` callback**

**The Problem:**
- Our old `onPairingSuccess` callback competed with ConnectionsModel's built-in CHUM transition
- Both sides would try to start CHUM as sender, causing connection closure
- The `initiatedLocally` flag wasn't properly negotiated yet during `onPairingSuccess`

**The Solution:**
- Remove our custom CHUM starter callback passed to PairingManager
- Listen to `onProtocolStart` event which fires AFTER ConnectionsModel negotiates the protocol
- By this point, `initiatedLocally` is correctly set and only ONE side starts CHUM
- Application code (P2P topic creation, contact creation) happens AFTER protocol is established

**Rationale:**
- Prevents race condition of both sides starting CHUM simultaneously
- ConnectionsModel knows who should be sender based on who created the invitation
- The side that created the invitation becomes the CHUM sender
- The side that accepted the invitation becomes the CHUM receiver
- Clear separation: pairing handshake → protocol negotiation → CHUM start → app logic

### Access Rights Requirement

CHUM will NOT sync Person/Profile objects without access rights:

```typescript
// Required in onProtocolStart handler (AFTER pairing completes)
connectionsModel.pairing.onProtocolStart.on(async (conn, info) => {
    const { initiatedLocally, localPersonId, localInstanceId,
            remotePersonId, remoteInstanceId } = info;

    // Only create access rights and P2P topic on ONE side (invitation creator)
    if (!initiatedLocally) {
        // 1. Retrieve remote person's Keys
        const keys = await getAllEntries(remotePersonId, 'Keys');
        const keyObj = await getObject(keys[0]);

        // 2. Create Profile with sign key
        const profile = await ProfileModel.constructWithNewProfile(
            remotePersonId, localPersonId, 'default', [],
            [{ $type$: 'SignKey', key: keyObj.publicSignKey }]
        );

        // 3. Create TrustKeysCertificate - THIS GRANTS ACCESS
        await trust.certify('TrustKeysCertificate', {
            profile: profile.loadedVersion
        });

        await trust.refreshCaches();

        // 4. Create P2P topic and contact (application-specific logic)
        await createP2PTopicAndContact(remotePersonId);
    }
});
```

**Without this:**
- CHUM protocol starts successfully
- Connection is established
- But Person objects are blocked from syncing
- `leuteModel.others()` returns empty array

**Important:** Access rights and topic creation should only happen on ONE side to avoid race conditions

## Configuration

### Recommended Settings

```typescript
new ConnectionsModel(leuteModel, {
    commServerUrl: 'ws://localhost:8000',
    acceptIncomingConnections: true,      // Accept connections from others
    acceptUnknownInstances: true,          // Accept unknown instances of known persons
    acceptUnknownPersons: false,           // DO NOT accept completely unknown persons
    allowPairing: true,                    // Allow pairing protocol
    establishOutgoingConnections: true     // Track outgoing connections
});
```

### Why `acceptUnknownPersons: false` Works

- Pairing connections use `connectionRoutesGroupName === 'pairing'`
- This bypasses the `acceptUnknownPersons` check (ConnectionsModel.ts:557-582)
- After pairing → CHUM connection is treated as "unknown" initially
- Once `TrustKeysCertificate` is created → becomes "known"
- Then CHUM sync proceeds normally

## Testing Pattern

### Correct Test Implementation

```typescript
// 1. Set up protocol start handlers FIRST (both sides)
// CRITICAL: Use onProtocolStart, NOT onPairingSuccess
alice.connectionsModel.pairing.onProtocolStart.on(async (conn, info) => {
    const { initiatedLocally, localPersonId, remotePersonId } = info;

    // Only create access rights and P2P topic on ONE side (invitation creator)
    if (!initiatedLocally) {
        // Get remote person's Keys
        const keys = await getAllEntries(remotePersonId, 'Keys');
        const keyObj = await getObject(keys[0]);

        // Create Profile with sign key
        const profile = await ProfileModel.constructWithNewProfile(
            remotePersonId, localPersonId, 'default', [],
            [{ $type$: 'SignKey', key: keyObj.publicSignKey }]
        );

        // Create TrustKeysCertificate to grant access rights
        await alice.leuteModel.trust.certify('TrustKeysCertificate', {
            profile: profile.loadedVersion
        });
        await alice.leuteModel.trust.refreshCaches();

        // Create P2P topic and contact (application-specific)
        await createP2PTopicAndContact(remotePersonId);

        aliceProtocolStarted.resolve();
    }
});

// Bob's side (invitation acceptor) - DOES NOT create topic/contact
bob.connectionsModel.pairing.onProtocolStart.on(async (conn, info) => {
    const { initiatedLocally, remotePersonId } = info;

    // Accept side just waits for objects to sync via CHUM
    if (initiatedLocally) {
        bobProtocolStarted.resolve();
    }
});

// 2. Alice creates invitation
const invitation = await alice.connectionPlan.createPairingInvitation({ mode: 'IoP' });

// 3. Bob accepts invitation (initiates connection)
await bob.connectionPlan.acceptPairingInvitation({ invitationUrl: invitation.url });

// 4. Wait for BOTH onProtocolStart callbacks to fire
// This confirms CHUM protocol is established and ready
await Promise.all([aliceProtocolStarted.promise, bobProtocolStarted.promise]);

// SUCCESS! Pairing is complete and CHUM is running
// Note: connectionsInfo() has known limitations - see below
```

### Common Test Mistakes

1. **Using `onPairingSuccess` instead of `onProtocolStart`** → Race condition with ConnectionsModel's CHUM transition (CRITICAL!)
2. **Not implementing access rights handler** → CHUM blocks Person sync (CRITICAL!)
3. **Creating P2P topics/contacts on BOTH sides** → Race condition, should only happen on invitation creator side
4. **Passing CHUM starter callback to PairingManager** → Competes with ConnectionsModel's built-in CHUM handling
5. **Expecting connection tracking via `connectionsInfo()`** → Has known limitations (see below)
6. **Only checking one side** → Might miss asymmetric behavior
7. **Using delays instead of proper event management** → Flaky tests

## Connection Tracking Limitations (RESOLVED)

**Important Discovery:**
The test should verify pairing success via the `onPairingSuccess` callbacks, NOT by checking `connectionsInfo()` connection counts.

**Why `connectionsInfo()` is unreliable for pairing tests:**

1. **Bob (initiator) doesn't register pairing connections**
   - By design, the connection initiator doesn't track pairing connections in `connectionsInfo()`
   - This is expected behavior, not a bug

2. **Alice (receiver) shows incomplete pairing connection**
   - Shows zeros for `remoteInstanceId` and `remotePersonId`
   - Pairing connection is temporary, used only for identity exchange

3. **CHUM connections may not immediately appear**
   - CHUM runs in background (`keepRunning: true` with blocking await)
   - Connection registration happens asynchronously
   - Timing varies based on system load

**Correct Success Criteria:**
```typescript
// ✅ CORRECT: Verify both onProtocolStart callbacks fired
await Promise.all([aliceProtocolStarted.promise, bobProtocolStarted.promise]);
// SUCCESS! Both sides have established CHUM protocol and can sync

// ❌ INCORRECT: Use onPairingSuccess callbacks
await Promise.all([alicePairingPromise, bobPairingPromise]);
// BROKEN! Race condition - CHUM isn't ready yet

// ❌ INCORRECT: Check connectionsInfo() immediately
const connections = connectionsModel.connectionsInfo();
expect(connections.length).to.equal(1); // Unreliable!
```

**If you need to verify contacts synced:**
```typescript
// Wait for Person objects to sync via CHUM
await waitFor(() => {
    const contacts = alice.leuteModel.others();
    return contacts.length > 0;
}, { timeout: 10000 });
```

## References

- `packages/one.models/src/misc/ConnectionEstablishment/PairingManager.ts`
- `packages/one.models/src/models/ConnectionsModel.ts`
- `packages/one.models/src/misc/ConnectionEstablishment/LeuteConnectionsModule.ts`
- `packages/one.models/CONNECTION.md` - Access rights documentation
- `lama.electron/reference/one.leute/src/model/LeuteAccessRightsManager.ts` - Reference implementation
