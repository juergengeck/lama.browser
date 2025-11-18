# @lama/connection.udp-node

Node.js/Electron UDP transport implementation for lama connection packages.

## Overview

This package provides a UDP transport layer for Node.js and Electron applications using the built-in `dgram` module. It implements the `IQuicTransport` interface from `@lama/connection.discovery` and can be used as the transport layer for QUICVC connections and device discovery.

## Installation

```bash
npm install @lama/connection.udp-node
```

## Usage

```typescript
import { NodeUdpTransport } from '@lama/connection.udp-node';

// Create transport instance
const transport = new NodeUdpTransport();

// Initialize and bind to port
await transport.init({ port: 49497, host: '0.0.0.0' });

// Listen for messages
transport.on('message', (data, rinfo) => {
  console.log(`Received ${data.length} bytes from ${rinfo.address}:${rinfo.port}`);
});

// Register service handler (e.g., for discovery service type 1)
transport.addService(1, (data, rinfo) => {
  console.log('Discovery message received');
});

// Send data
await transport.send(Buffer.from('Hello'), '192.168.1.100', 49497);

// Close transport
await transport.close();
```

## Integration with Discovery Protocol

```typescript
import { NodeUdpTransport } from '@lama/connection.udp-node';
import { DiscoveryService } from '@lama/connection.discovery';

const transport = new NodeUdpTransport();
await transport.init({ port: 49497 });

const discovery = new DiscoveryService({
  deviceId: 'my-device',
  deviceName: 'My Device',
  deviceType: 'app',
  capabilities: ['chat', 'file-transfer'],
  version: '1.0.0',
  discoveryPort: 49497,
  discoveryInterval: 5000,
  maxAge: 30000,
  broadcastAddress: '255.255.255.255'
});

await discovery.start(transport);
```

## API

### `NodeUdpTransport`

#### Methods

- `init(options?: QuicTransportOptions): Promise<void>` - Initialize the transport
- `listen(options?: QuicTransportOptions): Promise<void>` - Alias for init()
- `send(data: Uint8Array | string, address: string, port: number): Promise<void>` - Send data
- `close(): Promise<void>` - Close the transport
- `addService(serviceType: number, handler: Function): void` - Register service handler
- `removeService(serviceType: number): void` - Remove service handler
- `clearServices(): void` - Remove all service handlers
- `getInfo(): Promise<{port: number, host: string} | null>` - Get socket info
- `isInitialized(): boolean` - Check if initialized
- `runDiagnostics(): Promise<string>` - Get diagnostics info

#### Events

- `ready` - Emitted when transport is ready
- `message` - Emitted when data is received
- `error` - Emitted on error
- `close` - Emitted when transport is closed

#### Properties

- `stats` - Transport statistics (packets/bytes sent/received, errors)
- `socketId` - Unique socket identifier

## Features

- ✅ Full Node.js `dgram` module support
- ✅ UDP broadcast support
- ✅ Service routing (service type byte prefix)
- ✅ QUICVC packet detection (long header)
- ✅ JSON message parsing
- ✅ Event emission (ready, message, error, close)
- ✅ Statistics tracking
- ✅ Diagnostics

## Platform Support

- Node.js 18+
- Electron (any version with Node.js 18+)

## License

MIT
