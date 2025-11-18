# Pairing CHUM Sender Role Conflict - RESOLVED

**Date:** 2025-11-11
**Status:** ✅ FIXED

## Summary of Changes

Fixed the sender role conflict by getting out of ONE.models' way:

1. **Removed our `onPairingSuccess` callback** that was competing with ConnectionsModel's built-in CHUM transition
2. **Changed to listen on `onProtocolStart` event instead**, which fires AFTER ConnectionsModel has properly negotiated the CHUM protocol with the correct `initiatedLocally` value
3. **Now only ONE side starts CHUM as sender** (the side that created the invitation), and the other side accepts as receiver
4. **Our P2P topic creation and contact creation happens AFTER the protocol is established**, not during the handshake

This fixes the connection-closing issue where both sides were competing to be the CHUM sender.

## The Problem

### What Was Happening

Both peers were trying to start CHUM as sender simultaneously, causing connection closure:

```
Alice (Invitation Creator)                    Bob (Invitation Acceptor)
        |                                              |
        |  Pairing handshake completes                 |
        |<-------------------------------------------->|
        |                                              |
        |  onPairingSuccess fires                      |  onPairingSuccess fires
        |  → Our callback starts CHUM                  |  → Our callback starts CHUM
        |     as SENDER                                |     as SENDER
        |                                              |
        |<---------- BOTH TRY TO BE SENDER ----------->|
        |                                              |
        |  ❌ CONNECTION CLOSES ❌                      |
```

### Root Cause

1. We were passing a CHUM starter callback to `PairingManager`
2. This callback fired during `onPairingSuccess`, before ConnectionsModel could properly negotiate the protocol
3. The `initiatedLocally` flag wasn't finalized yet
4. Both sides thought they should be the CHUM sender
5. Connection closed due to role conflict

## The Solution

### New Event Flow

```
Alice (Invitation Creator)                    Bob (Invitation Acceptor)
        |                                              |
        |  Pairing handshake completes                 |
        |<-------------------------------------------->|
        |                                              |
        |  onPairingSuccess fires                      |  onPairingSuccess fires
        |  → ConnectionsModel negotiates CHUM          |  → ConnectionsModel negotiates CHUM
        |     (sets initiatedLocally=false)            |     (sets initiatedLocally=true)
        |                                              |
        |  onProtocolStart fires                       |  onProtocolStart fires
        |  → initiatedLocally=false                    |  → initiatedLocally=true
        |  → Becomes CHUM SENDER                       |  → Becomes CHUM RECEIVER
        |  → Creates P2P topic & contact               |  → Waits for sync
        |                                              |
        |<---------- CHUM SYNCS SUCCESSFULLY --------->|
        |                                              |
        |  ✅ CONNECTION STABLE ✅                      |
```

### Code Changes

**Before (BROKEN):**

```typescript
// Passed callback to PairingManager - competed with ConnectionsModel
this.connectionsModel.pairing = new PairingManager(
    leuteModel,
    expirationDuration,
    commServerUrl,
    async (conn, ...) => {
        // ❌ RACE CONDITION - fires too early
        await startChumProtocol(...);
    }
);

// onPairingSuccess callback also tried to create topics
this.connectionsModel.pairing.onPairingSuccess(async (...) => {
    // ❌ RACE CONDITION - both sides create topics
    await createP2PTopicAndContact(...);
});
```

**After (FIXED):**

```typescript
// NO callback to PairingManager - let ConnectionsModel handle CHUM
this.connectionsModel.pairing = new PairingManager(
    leuteModel,
    expirationDuration,
    commServerUrl
    // No CHUM starter callback
);

// Listen to onProtocolStart AFTER protocol is negotiated
this.connectionsModel.pairing.onProtocolStart.on(async (conn, info) => {
    const { initiatedLocally, localPersonId, remotePersonId } = info;

    // ✅ Only ONE side creates topics (invitation creator)
    if (!initiatedLocally) {
        // Create access rights
        await setupAccessRights(remotePersonId);

        // Create P2P topic and contact
        await createP2PTopicAndContact(remotePersonId);
    }
    // Other side just waits for sync via CHUM
});
```

## Key Insights

1. **Trust ONE.models**: ConnectionsModel knows how to negotiate CHUM properly - don't interfere
2. **Event timing matters**: `onPairingSuccess` fires during handshake, `onProtocolStart` fires after protocol is ready
3. **Single responsibility**: Only ONE side should create P2P topics/contacts (invitation creator)
4. **Let it flow**: CHUM will sync the objects to the other side automatically

## Documentation Updated

- `/docs/PAIRING-PROTOCOL-SPEC.md` - Complete protocol specification
- `/connection.core/README.md` - CHUM role assignment section
- `/connection.core/CLAUDE.md` - Architecture notes

## Testing

Tests should now use `onProtocolStart` instead of `onPairingSuccess`:

```typescript
// ✅ CORRECT
alice.connectionsModel.pairing.onProtocolStart.on(async (conn, info) => {
    if (!info.initiatedLocally) {
        // Setup complete
        aliceReady.resolve();
    }
});

bob.connectionsModel.pairing.onProtocolStart.on(async (conn, info) => {
    if (info.initiatedLocally) {
        // Setup complete
        bobReady.resolve();
    }
});

await Promise.all([aliceReady.promise, bobReady.promise]);
// ✅ Both sides have established CHUM protocol

// ❌ INCORRECT - fires too early
alice.connectionsModel.pairing.onPairingSuccess(async (...) => {
    aliceReady.resolve(); // ❌ CHUM not ready yet!
});
```

## References

- ONE.models ConnectionsModel implementation
- ONE.models PairingManager implementation
- LAMA connection.core ConnectionPlan
- Integration tests in `test/integration/`

## Lessons Learned

1. **Don't fight the framework**: When using a library like ONE.models, understand its event flow and work with it
2. **Race conditions are subtle**: Both sides doing the same thing at slightly different times can cause hard-to-debug issues
3. **Event order matters**: Listen to events that fire AFTER the state you depend on is ready
4. **Single writer wins**: When creating shared state, designate ONE side to be the writer

---

**Status: RESOLVED ✅**

Connection pairing now works reliably with proper CHUM sender/receiver role assignment.
