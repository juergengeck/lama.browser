# connection.quicvc

QUIC with Verifiable Credentials - secure P2P connection protocol for the lama ecosystem.

## Overview

`connection.quicvc` implements the QuicVC protocol - QUIC with Verifiable Credentials replacing TLS for authentication. Provides platform-agnostic connection management, packet handling, and cryptographic session establishment.

Based on proven implementation from uvc QuicVCConnectionManager.

## Features

- QUIC protocol with Verifiable Credentials (replaces TLS)
- Packet types: INITIAL, HANDSHAKE, PROTECTED, RETRY
- Frame types: VC_INIT, VC_RESPONSE, STREAM, HEARTBEAT, DISCOVERY, CONNECTION_CLOSE
- Session key derivation from credential exchange
- Encrypted data transmission with packet-number replay protection
- Heartbeat mechanism (30s) with idle timeout (120s)
- Service-type message routing for application protocols
- Compatible with ESP32 devices

## Installation

```bash
npm install @lama/connection.quicvc
```

You'll also need a platform-specific UDP transport:

```bash
# For Node.js/Electron
npm install @lama/connection.udp-node

# For React Native/Expo
npm install @lama/connection.udp-expo
```

## Quick Start

```typescript
import { QuicVCConnectionManager } from '@lama/connection.quicvc';
import { UdpServiceTransport } from '@lama/connection.udp-node';

// Initialize manager
const manager = QuicVCConnectionManager.getInstance(ownPersonId);
await manager.init(ownVC, vcManager, transport);

// Connect to discovered device
const connection = await manager.connectToDevice(
  deviceId,
  address,
  port,
  deviceVC
);

// Register service handler
manager.registerService(
  connection,
  ServiceType.LED_CONTROL,
  (data, deviceId) => {
    console.log('LED response from', deviceId, data);
  }
);

// Send data
await manager.sendStream(
  deviceId,
  ServiceType.LED_CONTROL,
  new TextEncoder().encode(JSON.stringify({ blue_led: 'on' }))
);

// Listen for events
manager.onConnectionEstablished.addListener((deviceId, vcInfo) => {
  console.log('Connected to', deviceId);
});

manager.onConnectionClosed.addListener((deviceId, reason) => {
  console.log('Connection closed:', deviceId, reason);
});

// Disconnect
await manager.disconnect(deviceId);
```

## API

### QuicVCConnectionManager

Singleton manager for all QuicVC connections.

#### Static Methods

- `getInstance(ownPersonId: SHA256IdHash<Person>): QuicVCConnectionManager` - Get singleton instance

#### Instance Methods

- `async init(ownVC: DeviceIdentityCredential, vcManager: VCManager, transport: IQuicTransport): Promise<void>` - Initialize manager
- `async connectToDevice(deviceId: string, address: string, port: number, deviceVC: DeviceIdentityCredential): Promise<QuicVCConnection>` - Connect to device
- `getConnection(deviceId: string): QuicVCConnection | undefined` - Get connection
- `registerService(connection: QuicVCConnection, serviceType: number, handler: (data: Uint8Array, deviceId: string) => void): void` - Register service handler
- `async sendStream(deviceId: string, serviceType: number, data: Uint8Array): Promise<void>` - Send data
- `async disconnect(deviceId: string): Promise<void>` - Disconnect

#### Events

- `onConnectionEstablished` - Fired when connection handshake completes
- `onConnectionClosed` - Fired when connection closes
- `onConnectionRetryNeeded` - Fired when connection needs retry
- `onHandshakeComplete` - Fired when handshake completes
- `onPacketReceived` - Fired when packet received
- `onError` - Fired on errors

### Types

See [spec.md](../../specs/006-connection-quicvc/spec.md) for complete type definitions.

## Protocol Details

### Connection States

1. **initial** - Connection created, waiting for VC_INIT
2. **handshake** - Credentials exchanged, deriving session keys
3. **established** - Session keys derived, can send encrypted data
4. **closed** - Connection terminated

### Packet Types

- **INITIAL (0x00)** - Contains VC_INIT frame with client credentials
- **HANDSHAKE (0x01)** - Contains VC_RESPONSE frame with server credentials
- **PROTECTED (0x02)** - Encrypted data packets
- **RETRY (0x03)** - Request retry with different parameters

### Frame Types

- **VC_INIT (0x20)** - Client credential presentation
- **VC_RESPONSE (0x21)** - Server credential presentation
- **VC_ACK (0x22)** - Credential acknowledgment
- **STREAM (0x10)** - Application data
- **HEARTBEAT (0x12)** - Keep-alive
- **DISCOVERY (0x30)** - Discovery protocol messages
- **CONNECTION_CLOSE (0x13)** - Graceful shutdown

## Integration with Discovery

```typescript
import { DiscoveryProtocol } from '@lama/connection.discovery';
import { QuicVCConnectionManager } from '@lama/connection.quicvc';

const discovery = new DiscoveryProtocol(config, transport);
const quicvc = QuicVCConnectionManager.getInstance(personId);

await discovery.init();
await quicvc.init(ownVC, vcManager, transport);

// When device discovered, connect
discovery.onDeviceDiscovered.addListener(async (device) => {
  await quicvc.connectToDevice(
    device.deviceId,
    device.address,
    device.port,
    device.credential
  );
});

// When connection established, register handlers
quicvc.onConnectionEstablished.addListener((deviceId) => {
  const connection = quicvc.getConnection(deviceId)!;
  quicvc.registerService(connection, ServiceType.CUSTOM, (data) => {
    // Handle data
  });
});
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

## License

MIT
