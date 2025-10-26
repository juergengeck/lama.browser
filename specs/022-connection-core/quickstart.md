# Quickstart: Connection Core Package

**Last Updated**: 2025-10-23
**Target Audience**: Platform developers integrating connection.core into lama.browser, lama.electron, lama.ios, or lama.android

## Overview

This quickstart guide shows how to integrate connection.core into your platform in under 30 minutes. You'll learn how to:
1. Install the package
2. Implement platform dependencies
3. Initialize ConnectionManager
4. Discover and pair with peers
5. Establish P2P connections

## Prerequisites

- TypeScript 5.x or later
- ONE.core instance initialized
- Platform-specific transport implementation (WebSocket minimum)
- Platform-specific storage (IndexedDB, filesystem, or native)

---

## Step 1: Install Package

```bash
# For JavaScript platforms (browser, electron)
npm install @lama/connection.core

# For native platforms (iOS, Android)
# Package will be exposed via bridge - see platform-specific docs
```

---

## Step 2: Implement Platform Dependencies

Connection.core requires platform-specific implementations for transport, storage, and UI.

### 2.1 Transport Implementation

**Example: Browser WebSocket Transport**

```typescript
import type { Transport, TransportFactory, TransportState } from '@lama/connection.core';

class BrowserWebSocketTransport implements Transport {
  readonly type = 'websocket';
  private ws: WebSocket | null = null;
  private state: TransportState = 'disconnected';
  private receiveCallbacks: ((data: Uint8Array) => void)[] = [];
  private stateCallbacks: ((state: TransportState) => void)[] = [];

  async connect(address: string): Promise<void> {
    this.state = 'connecting';
    this.emitStateChange('connecting');

    this.ws = new WebSocket(address);

    return new Promise((resolve, reject) => {
      this.ws!.onopen = () => {
        this.state = 'connected';
        this.emitStateChange('connected');
        resolve();
      };

      this.ws!.onerror = (error) => {
        this.state = 'disconnected';
        this.emitStateChange('disconnected');
        reject(new Error(`WebSocket connection failed: ${error}`));
      };

      this.ws!.onmessage = (event) => {
        const data = new Uint8Array(event.data);
        this.receiveCallbacks.forEach(cb => cb(data));
      };

      this.ws!.onclose = () => {
        this.state = 'disconnected';
        this.emitStateChange('disconnected');
      };
    });
  }

  async send(data: Uint8Array): Promise<void> {
    if (this.state !== 'connected' || !this.ws) {
      throw new Error('Transport not connected');
    }
    this.ws.send(data);
  }

  onReceive(callback: (data: Uint8Array) => void): void {
    this.receiveCallbacks.push(callback);
  }

  onStateChange(callback: (state: TransportState) => void): void {
    this.stateCallbacks.push(callback);
  }

  close(): void {
    if (this.ws) {
      this.state = 'disconnecting';
      this.emitStateChange('disconnecting');
      this.ws.close();
    }
  }

  getState(): TransportState {
    return this.state;
  }

  private emitStateChange(state: TransportState): void {
    this.stateCallbacks.forEach(cb => cb(state));
  }
}

class BrowserTransportFactory implements TransportFactory {
  create(type: 'quicvc' | 'websocket'): Transport {
    if (type === 'websocket') {
      return new BrowserWebSocketTransport();
    }
    throw new Error(`Transport type ${type} not supported on browser`);
  }

  getSupportedTransports(): ('quicvc' | 'websocket')[] {
    return ['websocket'];
  }
}
```

### 2.2 Storage Implementation

**Example: Browser IndexedDB Storage**

```typescript
import type { StorageAdapter, PeerIdentity, VersionedCredential } from '@lama/connection.core';

class IndexedDBStorage implements StorageAdapter {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'lama-connections';
  private readonly DB_VERSION = 1;

  constructor() {
    this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('peers')) {
          db.createObjectStore('peers', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('credentials')) {
          db.createObjectStore('credentials', { keyPath: 'id' });
        }
      };
    });
  }

  async storePeer(peer: PeerIdentity): Promise<void> {
    const tx = this.db!.transaction(['peers'], 'readwrite');
    const store = tx.objectStore('peers');
    store.put(peer);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPeer(peerId: string): Promise<PeerIdentity | null> {
    const tx = this.db!.transaction(['peers'], 'readonly');
    const store = tx.objectStore('peers');
    const request = store.get(peerId);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listPeers(): Promise<PeerIdentity[]> {
    const tx = this.db!.transaction(['peers'], 'readonly');
    const store = tx.objectStore('peers');
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removePeer(peerId: string): Promise<void> {
    const tx = this.db!.transaction(['peers'], 'readwrite');
    const store = tx.objectStore('peers');
    store.delete(peerId);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async storeCredential(credential: VersionedCredential): Promise<void> {
    const tx = this.db!.transaction(['credentials'], 'readwrite');
    const store = tx.objectStore('credentials');
    store.put(credential);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCredential(credentialId: string): Promise<VersionedCredential | null> {
    const tx = this.db!.transaction(['credentials'], 'readonly');
    const store = tx.objectStore('credentials');
    const request = store.get(credentialId);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listCredentials(subjectId: string): Promise<VersionedCredential[]> {
    // For simplicity, get all and filter (production should use index)
    const tx = this.db!.transaction(['credentials'], 'readonly');
    const store = tx.objectStore('credentials');
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const all = request.result;
        const filtered = all.filter((c: VersionedCredential) =>
          c.credentialSubject.id === subjectId
        );
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    });
  }
}
```

### 2.3 UI Callbacks Implementation

**Example: Browser UI Callbacks**

```typescript
import type { UICallbacks, PairingRequestUI, ErrorUI, ConnectionStateValue } from '@lama/connection.core';

class BrowserUICallbacks implements UICallbacks {
  async onPairingRequest(request: PairingRequestUI): Promise<boolean> {
    // Show modal dialog to user
    const message = `
      Pairing request from ${request.peerName}
      Method: ${request.method}
      ${request.verificationCode ? `Code: ${request.verificationCode}` : ''}

      Accept pairing?
    `;

    return window.confirm(message);
  }

  onError(error: ErrorUI): void {
    console.error(`[Connection Error ${error.code}]`, error.message, error.context);
    // Show toast/notification
    alert(`Error: ${error.message}`);
  }

  onConnectionStateChange(peerId: string, state: ConnectionStateValue): void {
    console.log(`Peer ${peerId} state changed to: ${state}`);
    // Update UI to show connection status
  }
}
```

---

## Step 3: Initialize ConnectionManager

```typescript
import { ConnectionManager } from '@lama/connection.core';
import { BrowserTransportFactory } from './transport';
import { IndexedDBStorage } from './storage';
import { BrowserUICallbacks } from './ui';

// Assume you have ONE.core initialized
import { oneCore } from './one-core-setup';

// Create platform dependencies
const deps = {
  transport: new BrowserTransportFactory(),
  storage: new IndexedDBStorage(),
  ui: new BrowserUICallbacks(),
  oneCore: oneCore
};

// Initialize ConnectionManager
const connectionManager = new ConnectionManager(oneCore, deps);
await connectionManager.initialize();

console.log('ConnectionManager initialized!');
```

---

## Step 4: Discover Peers

```typescript
// Start continuous discovery
connectionManager.startDiscovery({
  methods: ['local', 'relay'],
  timeout: 5000
});

// Listen for discovered peers
connectionManager.on('peerDiscovered', (peer) => {
  console.log('Discovered peer:', peer.name, peer.id);
});

// Or perform one-time scan
const peers = await connectionManager.discoverPeers({
  methods: ['local'],
  timeout: 2000
});

console.log(`Found ${peers.length} peers:`, peers.map(p => p.name));
```

---

## Step 5: Pair with Peer

```typescript
// Get discovered peers
const peers = connectionManager.getDiscoveredPeers();
const targetPeer = peers[0]; // Select peer to pair with

// Initiate pairing (platform will choose method)
const pairingRequest = await connectionManager.initiatePairing(targetPeer.id);

console.log('Pairing request sent:', pairingRequest.id);

// Listen for pairing events
connectionManager.on('pairingAccepted', (requestId) => {
  console.log('Pairing accepted!', requestId);
});

connectionManager.on('pairingRejected', (requestId) => {
  console.log('Pairing rejected', requestId);
});

// On the other device, user will see pairing request UI
// When they accept, connection is automatically established
```

**Handling Incoming Pairing Requests**:

```typescript
connectionManager.on('pairingRequestReceived', async (request) => {
  console.log('Received pairing request from:', request.initiatorName);

  // UI callback will be invoked automatically to prompt user
  // If user accepts via UI, pairing proceeds
  // If user rejects, request is declined

  // Or manually accept/reject:
  // await connectionManager.acceptPairing(request.id);
  // connectionManager.rejectPairing(request.id);
});
```

---

## Step 6: Establish Connection

```typescript
// After successful pairing, connect to peer
const connection = await connectionManager.connect(targetPeer.id);

console.log('Connected to peer:', connection.peerId);
console.log('Transport type:', connection.transportType);

// Send data
const message = new TextEncoder().encode('Hello from browser!');
await connection.send(message);

// Receive data
connection.onReceive((data) => {
  const text = new TextDecoder().decode(data);
  console.log('Received:', text);
});

// Monitor connection state
connection.onStateChange((state) => {
  console.log('Connection state:', state);
});
```

---

## Step 7: Group Connections (Optional)

```typescript
// Create group with multiple paired peers
const peer1 = peers[0];
const peer2 = peers[1];

const group = await connectionManager.createGroupConnection('my-group-chat', [
  peer1.id,
  peer2.id
]);

console.log('Group created with', group.memberIds.length, 'members');

// Broadcast message to all group members
const groupMessage = new TextEncoder().encode('Hello everyone!');
await group.broadcast(groupMessage);

// Listen for member status changes
group.onMemberStateChange((peerId, state) => {
  console.log(`Member ${peerId} is now ${state}`);
});

// Add new member
await group.addMember(peers[2].id);
```

---

## Step 8: Error Handling

```typescript
// Connection.core uses fail-fast error handling
// Always wrap operations in try-catch

try {
  const connection = await connectionManager.connect(peerId);
} catch (error) {
  console.error('Connection failed:', error.message);
  // Error will indicate root cause:
  // - "Peer not paired"
  // - "Transport connection failed"
  // - "Credential verification failed"
  // etc.
}

// Global error listener
connectionManager.on('error', (error) => {
  console.error('ConnectionManager error:', error);
});
```

---

## Complete Example

```typescript
import { ConnectionManager } from '@lama/connection.core';
import { BrowserTransportFactory } from './transport';
import { IndexedDBStorage } from './storage';
import { BrowserUICallbacks } from './ui';
import { oneCore } from './one-core-setup';

async function main() {
  // 1. Initialize ConnectionManager
  const connectionManager = new ConnectionManager(oneCore, {
    transport: new BrowserTransportFactory(),
    storage: new IndexedDBStorage(),
    ui: new BrowserUICallbacks(),
    oneCore: oneCore
  });

  await connectionManager.initialize();
  console.log('✓ ConnectionManager initialized');

  // 2. Discover peers
  console.log('Discovering peers...');
  const peers = await connectionManager.discoverPeers({ timeout: 3000 });
  console.log(`✓ Found ${peers.length} peers`);

  if (peers.length === 0) {
    console.log('No peers found');
    return;
  }

  // 3. Pair with first peer
  const targetPeer = peers[0];
  console.log(`Pairing with ${targetPeer.name}...`);

  const pairingRequest = await connectionManager.initiatePairing(targetPeer.id);

  // Wait for pairing to complete
  await new Promise((resolve) => {
    connectionManager.on('pairingAccepted', (requestId) => {
      if (requestId === pairingRequest.id) {
        console.log('✓ Pairing accepted');
        resolve(true);
      }
    });
  });

  // 4. Connect to paired peer
  console.log('Establishing connection...');
  const connection = await connectionManager.connect(targetPeer.id);
  console.log(`✓ Connected via ${connection.transportType}`);

  // 5. Send message
  const message = new TextEncoder().encode('Hello from quickstart!');
  await connection.send(message);
  console.log('✓ Message sent');

  // 6. Receive messages
  connection.onReceive((data) => {
    const text = new TextDecoder().decode(data);
    console.log('Received message:', text);
  });

  console.log('Connection established and ready!');
}

main().catch(console.error);
```

---

## Next Steps

- **Platform-Specific Guides**: See `/docs/integration/` for detailed guides per platform
- **API Reference**: See `/contracts/` for complete TypeScript interface documentation
- **Testing**: See `/docs/testing.md` for testing your integration
- **Troubleshooting**: See `/docs/troubleshooting.md` for common issues

---

## Platform-Specific Notes

### Browser

- Use `IndexedDB` for storage (persistent)
- Use `WebSocket` for transport (QUIC not yet available in browser)
- QR code pairing requires camera permissions
- Proximity pairing requires Web Bluetooth API (experimental)

### Electron

- Use file system for storage (Node.js `fs` module)
- Use both `WebSocket` and `QUIC` for transport (via Node.js QUIC implementation)
- All pairing methods available
- Can use OS-native mDNS/Bonjour for local discovery

### iOS

- Use native storage APIs (UserDefaults, CoreData, or File System)
- Use native networking (URLSession for WebSocket, Network.framework for QUIC)
- QR code pairing via AVFoundation
- Proximity pairing via CoreBluetooth or NFC
- mDNS via Network.framework

### Android

- Use native storage (SharedPreferences, Room, or File System)
- Use native networking (OkHttp for WebSocket, custom implementation for QUIC)
- QR code pairing via Camera2 API
- Proximity pairing via Bluetooth or NFC
- mDNS via NsdManager

---

## Performance Tips

1. **Discovery**: Use local discovery when possible (faster, no internet required)
2. **Transport**: Prefer QUIC over WebSocket on platforms that support it (30% lower latency)
3. **Credentials**: Cache verification results (re-verify every 24 hours, not every connection)
4. **Groups**: Limit to 10 members (full mesh becomes expensive beyond that)
5. **Reconnection**: Automatic reconnection uses exponential backoff (don't manually retry)

---

## Common Pitfalls

1. **Missing Dependencies**: ConnectionManager will throw immediately if dependencies are missing - check constructor injection
2. **Transport Not Connected**: Always check `connection.state` before sending data
3. **Pairing Timeout**: Pairing requests expire after 60 seconds - handle timeout events
4. **Credential Expiration**: Check credential expiration before pairing (verification will fail if expired)
5. **Group Member Limits**: Don't exceed 10 members in full mesh topology (performance degrades)

---

## Support

- **Documentation**: `/specs/022-connection-core/`
- **Issues**: https://github.com/lama/connection.core/issues
- **Discussion**: https://github.com/lama/connection.core/discussions
