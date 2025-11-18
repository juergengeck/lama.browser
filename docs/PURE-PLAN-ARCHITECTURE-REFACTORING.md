# Pure Plan-Based Architecture: Connection & Pairing Refactoring

**Date**: January 2025
**Status**: ✅ Complete - Both platforms adapted

## Executive Summary

Successfully refactored **lama.cube** (Electron) and **lama.browser** (Web) to use a unified **pure plan-based architecture** for connection and pairing operations. Eliminated legacy event handler patterns and race conditions by having `ConnectionPlan` register its own handlers and fire high-level callbacks for platform-specific UI updates.

---

## Problem Statement

### Before Refactoring

Both platforms had **mixed architecture patterns**:

1. **lama.cube**: Mixed IPC handlers + `onProtocolStart` workaround
2. **lama.browser**: React components directly calling platform-agnostic plans + manual `autoCreateP2PTopicAfterPairing`

**Issues**:
- Race conditions between `ConnectionPlan` and manual topic creation
- Inconsistent patterns across platforms
- Business logic leaked into platform layers
- Multiple registration points for the same protocol handler

---

## Solution: Pure Plan-Based Architecture

### Core Principle

**ConnectionPlan owns the complete pairing flow** and fires platform-specific callbacks for UI updates.

```
User Action → ConnectionPlan → Business Logic → Platform Callbacks → UI Updates
```

### Key Changes

#### 1. ConnectionPlan Registration (connection.core)

**File**: `connection.core/plans/ConnectionPlan.ts:127-149`

```typescript
// ConnectionPlan registers ONCE with ConnectionsModel
this.connectionsModel.onProtocolStart(async (initiatedLocally, localPersonId, remotePersonId) => {
    await this.handlePairingSuccess({
        initiatedLocally,
        localPersonId,
        remotePersonId,
        // ... other params
    });
});
```

**Business Logic**: `handlePairingSuccess()` → `handlePairingCompletion()` creates contact, topic, trust certificates, and fires callbacks.

#### 2. Platform-Specific Callbacks

**Type Definition** (connection.core):

```typescript
export interface PairingEventCallbacks {
    onContactCreated?: (contact: Contact) => Promise<void>;
    onTopicCreated?: (topic: Topic) => Promise<void>;
    onPairingComplete?: (details: PairingDetails) => Promise<void>;
}
```

**lama.cube Implementation** (main/core/node-one-core.ts:267-286):

```typescript
const pairingCallbacks: PairingEventCallbacks = {
    onContactCreated: async (contact) => {
        await stateManager.addContact(contact); // In-memory state
        mainWindow?.webContents.send('contacts:updated'); // IPC to renderer
    },

    onTopicCreated: async (topic) => {
        await stateManager.addConversation(topic); // In-memory state
        mainWindow?.webContents.send('conversations:updated'); // IPC to renderer
    },

    onPairingComplete: async (details) => {
        mainWindow?.webContents.send('pairing:complete', details); // IPC notification
    }
};
```

**lama.browser Implementation** (Model.ts:267-286):

```typescript
const pairingCallbacks: PairingEventCallbacks = {
    onContactCreated: async (contact) => {
        console.log('[Model] Contact created:', contact.displayName);
        this.onContactsChanged.emit(); // Event emitter for React hooks
    },

    onTopicCreated: async (topic) => {
        console.log('[Model] Topic created:', topic.channelId);
        this.onTopicsChanged.emit(); // Event emitter for React hooks
    },

    onPairingComplete: async (details) => {
        console.log('[Model] ✅ Pairing complete:', details.type);
        this.onConnectionsChanged.emit(); // General UI refresh
    }
};
```

#### 3. Removed Legacy Handlers

**lama.cube** - Deleted from `node-one-core.ts:577-586`:
```typescript
// OLD CODE REMOVED:
// this.connections.onProtocolStart((initiatedLocally, localPersonId, ...) => {
//     autoCreateP2PTopicAfterPairing({...}).then(...).catch(...);
// });
```

**lama.browser** - Deprecated in `Model.ts:577-586`:
```typescript
// DEPRECATED: P2P topic creation is now handled by ConnectionPlan
// ConnectionPlan calls handlePairingCompletion() internally which creates the topic
// The onTopicCreated callback (defined above) will fire when topic is ready
console.log('[Model] ℹ️  P2P topic creation handled by ConnectionPlan (not onProtocolStart)');
```

---

## Architecture Comparison

### Before (Mixed Approach)

```
User Action → ConnectionPlan → ConnectionsModel
                                      ↓
                        onProtocolStart → autoCreateP2PTopicAfterPairing
                                      ↓
                              Model events → UI
```

**Problems**:
- Two different handlers for same event
- Race condition: Which fires first?
- Business logic in platform layer (autoCreateP2PTopicAfterPairing)

### After (Pure Plan-Based)

```
User Action → ConnectionPlan (registers own handler) → ConnectionsModel
                   ↓ (internal business logic)
        handlePairingSuccess → handlePairingCompletion → creates topic
                   ↓ (fires high-level events)
        pairingCallbacks → Model events → UI refresh
```

**Benefits**:
- Single registration point (ConnectionPlan owns it)
- No race conditions
- Platform-specific UI logic via callbacks
- Business logic stays in plan
- Consistent across all platforms

---

## Implementation Details

### Connection.core Changes

**File**: `connection.core/plans/ConnectionPlan.ts`

1. **Added Callback Interface** (Lines 77-85)
2. **Constructor Parameter** (Line 98)
3. **Internal Registration** (Lines 127-149)
4. **Callback Invocation** (Lines 337-348, 426-428, 432-434)

### Platform Implementations

| Aspect              | lama.cube (Electron)                      | lama.browser (Browser)              |
|---------------------|-------------------------------------------|-------------------------------------|
| **Pairing Callbacks** | StateManager + IPC to renderer            | EventEmitter for React hooks        |
| **Contact Created**   | `stateManager.addContact()` + IPC         | `this.onContactsChanged.emit()`     |
| **Topic Created**     | `stateManager.addConversation()` + IPC    | `this.onTopicsChanged.emit()`       |
| **Storage**           | Node.js filesystem                        | Browser IndexedDB                   |
| **Transport**         | WebSocket via CommServer                  | WebSocket via CommServer            |

---

## Testing Checklist

### lama.cube (Electron)

- [ ] Start Electron app (`npm run electron`)
- [ ] Create pairing invitation
- [ ] Accept from another instance
- [ ] Verify contact appears in UI
- [ ] Verify conversation appears in UI
- [ ] Verify no console errors

### lama.browser (Web)

- [ ] Start dev server (`cd lama.browser && npm run dev`)
- [ ] Create pairing invitation
- [ ] Accept from another browser tab
- [ ] Verify contact list updates
- [ ] Verify topic list updates
- [ ] Verify React hooks fire correctly

---

## Build Status

- ✅ **connection.core** - Built successfully
- ✅ **lama.cube** - Built successfully
- ✅ **lama.browser** - Built successfully

---

## Key Benefits

### 1. Architectural Consistency
Both platforms now follow identical patterns - no more "special cases" or platform-specific workarounds.

### 2. No Race Conditions
Only one handler per event, registered by the plan that owns the business logic.

### 3. Clean Separation of Concerns
- **Business Logic**: connection.core (platform-agnostic)
- **UI Updates**: Platform callbacks (platform-specific)
- **Data Models**: ONE.core (shared)

### 4. Maintainability
Changes to pairing flow only require updates to ConnectionPlan, not both platforms.

### 5. Testability
Business logic can be tested independently of UI, callbacks can be mocked.

---

## Future Enhancements

1. **Add GroupChatPlan**: Same pattern for group chat operations
2. **TrustPlan Integration**: Automatic trust after pairing (in progress)
3. **Error Handling**: Callback errors should not break pairing flow
4. **Retry Logic**: If callback fails, retry or queue for later

---

## Related Documentation

- **Connection Plan**: `connection.core/plans/ConnectionPlan.ts`
- **lama.cube Implementation**: `lama.cube/main/core/node-one-core.ts`
- **lama.browser Implementation**: `lama.browser/src/Model.ts`
- **Architecture**: `ARCHITECTURE.md`, `docs/ARCHITECTURE-SUMMARY.md`

---

## Key Takeaways

1. **Plans own their domain** - ConnectionPlan owns pairing, not platforms
2. **Callbacks for UI** - Platform-specific updates via callbacks, not direct coupling
3. **Single registration** - Each plan registers once with underlying models
4. **Consistent patterns** - Same architecture across all platforms
5. **No fallbacks** - Fail fast and fix, don't mitigate
