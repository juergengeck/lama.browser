# Cross-Platform Pairing Debug Report
## lama.cube ↔ lama.browser Pairing Issues

**Date**: 2025-11-10
**Status**: ROOT CAUSES IDENTIFIED

---

## Summary

Cross-platform pairing between lama.cube (Electron) and lama.browser (Web) is failing. Both platforms use the same `ConnectionPlan` from `connection.core`, but there are critical differences in implementation and configuration that prevent successful pairing.

## Root Causes Identified

### 1. ❌ CRITICAL: Missing CommServer URL in ConnectionPlan

**Location**: `lama.cube/main/ipc/plans/connection.ts:106`

```typescript
// ❌ CURRENT (WRONG)
connectionHandler = new ConnectionPlan(nodeOneCore, storageProvider, webUrl);
                                                                       ^^^^^^
                                                                   Only web URL passed!
```

**The Problem**:
- `ConnectionPlan` constructor expects: `(nodeOneCore, storageProvider?, webUrl?, discoveryConfig?)`
- The `webUrl` parameter is for **invitation web app URLs** (e.g., `https://lama.one`)
- It does NOT pass the **CommServer WebSocket URL** needed for connections
- Browser uses: `new ConnectionPlan(this, undefined, commServerUrl)` ✅ (line 251)
- Cube uses: `new ConnectionPlan(nodeOneCore, storageProvider, webUrl)` ❌

**Why It Matters**:
- `createPairingInvitation()` uses this URL to construct the invitation
- If wrong URL is passed, invitations contain incorrect CommServer endpoint
- Pairing will fail because the invitation points to the wrong server

**The Fix**:
```typescript
// ✅ CORRECT
function getHandler(): ConnectionPlan {
  if (!connectionHandler) {
    const webUrl = getWebUrl(); // For browser UI: https://lama.one
    const commServerUrl = global.lamaConfig?.network.commServer.url || 'wss://comm10.dev.refinio.one';

    // Third parameter should be CommServer URL for connections, NOT web URL
    connectionHandler = new ConnectionPlan(nodeOneCore, storageProvider, commServerUrl);
  }
  return connectionHandler;
}
```

---

### 2. ⚠️ Configuration Inconsistency

**lama.cube CommServer Config**:
- Source: `lama.cube/main/config/lama-config.ts:48`
- Default: `wss://comm10.dev.refinio.one`
- Loaded via: `global.lamaConfig.network.commServer.url`
- Used in: `ModelInitializationPlan.ts:177` for ConnectionsModel
- **NOT passed to ConnectionPlan** ❌

**lama.browser CommServer Config**:
- Source: `lama.browser/browser-ui/src/main.tsx:59`
- Default: `wss://comm10.dev.refinio.one`
- Environment: `VITE_COMM_SERVER_URL`
- Passed to: `Model` constructor → `ConnectionPlan` ✅

**Result**: Both platforms configure ConnectionsModel correctly but only browser passes CommServer to ConnectionPlan.

---

### 3. ✅ GOOD: Both Have onPairingSuccess Handlers

**lama.cube**: `node-one-core.ts:394`
```typescript
this.connectionsModel.pairing.onPairingSuccess(async (initiatedLocally, localPersonId, ...) => {
  // Creates trust, Someone entries, P2P topics
  await completePairingTrust(...)
  await handleNewConnection(...)
  await autoCreateP2PTopicAfterPairing(...)
})
```

**lama.browser**: `Model.ts:476`
```typescript
this.connections.pairing.onPairingSuccess(async (initiatedLocally, localPersonId, ...) => {
  // Creates P2P topics
  await autoCreateP2PTopicAfterPairing(...)
})
```

Both platforms register handlers, so post-pairing logic should work once connection succeeds.

---

### 4. ⚠️ ConnectionsModel Filters Differ

**lama.cube**: `ModelInitializationPlan.ts:176-187`
```typescript
new ConnectionsModel(leuteModel, {
  commServerUrl,
  acceptIncomingConnections: true,
  acceptUnknownInstances: true,
  acceptUnknownPersons: false,
  allowPairing: true,
  // ❌ NO objectFilter or importFilter
  noImport: false,
  noExport: false
})
```

**lama.browser**: `Model.ts:181-192`
```typescript
new ConnectionsModel(this.leuteModel, {
  commServerUrl,
  acceptIncomingConnections: true,
  acceptUnknownInstances: true,
  acceptUnknownPersons: false,
  allowPairing: true,
  // ✅ HAS filters from TopicGroupManager
  objectFilter: this.topicGroupManager.createObjectFilter(),
  importFilter: this.topicGroupManager.createImportFilter()
})
```

**Impact**:
- Browser has stricter CHUM filtering (validates certificates, group access)
- Cube accepts all CHUM objects without validation
- This might cause issues if browser rejects objects from cube

---

## Testing Plan

### Step 1: Fix ConnectionPlan URL
1. Update `lama.cube/main/ipc/plans/connection.ts:106`
2. Pass `commServerUrl` instead of `webUrl` as 3rd parameter
3. Verify invitation URLs contain correct CommServer

### Step 2: Test Pairing Flow
1. **Create invitation in lama.cube**:
   ```bash
   cd lama.cube
   npm run electron
   # Click "Create Invitation" → Copy URL
   ```

2. **Accept in lama.browser**:
   ```bash
   cd lama.browser/browser-ui
   npm run dev
   # Paste invitation URL
   ```

3. **Expected logs**:
   - Cube: `[NodeOneCore] ✅ PAIRING SUCCESS EVENT TRIGGERED`
   - Browser: `[Model] ✅ PAIRING SUCCESS - Auto-creating P2P topic`
   - Both: `[ConnectionsModel] Connection established`

### Step 3: Verify Data Sync
1. Send message from cube
2. Verify browser receives via CHUM
3. Check that TopicGroupManager filters don't block messages

---

## Additional Issues to Watch

### A. Web URL for Invitations
Currently `getWebUrl()` in cube returns `global.lamaConfig?.web?.url` which might be undefined.

**Fix**:
```typescript
function getWebUrl(): string {
  return global.lamaConfig?.web?.url || 'https://lama.one';  // Fallback
}
```

### B. Storage Directory Differences
- Cube: Node.js filesystem (`OneDB/`)
- Browser: IndexedDB (`lama.browser.storage`)

Both are correct for their platforms, no fix needed.

### C. Discovery Config
Neither platform passes `discoveryConfig` to ConnectionPlan (4th parameter).
This is fine - QuicVC discovery is optional and not needed for CommServer pairing.

---

## Priority Fix

**IMMEDIATE ACTION REQUIRED**:

File: `lama.cube/main/ipc/plans/connection.ts`

```diff
function getHandler(): ConnectionPlan {
  if (!connectionHandler) {
-   const webUrl = getWebUrl();
-   connectionHandler = new ConnectionPlan(nodeOneCore, storageProvider, webUrl);
+   const webUrl = getWebUrl(); // For browser invitation UI
+   const commServerUrl = global.lamaConfig?.network.commServer.url || 'wss://comm10.dev.refinio.one';
+   connectionHandler = new ConnectionPlan(nodeOneCore, storageProvider, commServerUrl);
  }
  return connectionHandler;
}
```

This single change should fix the primary pairing issue.

---

## Next Steps After Fix

1. Test cube → browser pairing
2. Test browser → cube pairing
3. Verify P2P topic creation on both sides
4. Test message sending/receiving via CHUM
5. Check TopicGroupManager filters don't block cross-platform sync
6. Add integration test for cross-platform pairing

---

## Related Files

- `connection.core/src/plans/ConnectionPlan.ts` - Platform-agnostic pairing logic
- `lama.cube/main/ipc/plans/connection.ts` - Electron IPC adapter ❌ BUG HERE
- `lama.browser/browser-ui/src/model/Model.ts` - Browser Model ✅ CORRECT
- `lama.cube/main/config/lama-config.ts` - Cube configuration
- `lama.browser/browser-ui/src/main.tsx` - Browser initialization
