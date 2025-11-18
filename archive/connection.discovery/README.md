# connection.discovery

Platform-agnostic device discovery protocol for the lama ecosystem.

## Overview

`connection.discovery` provides UDP-based device discovery with broadcast announcements, device registry management, and automatic device lifecycle handling. Works across Node.js, Electron, and React Native through dependency injection of platform-specific UDP transports.

Based on proven implementation from uvc DiscoveryProtocol.

## Features

- UDP broadcast-based device discovery (port 49497)
- Device registry with automatic pruning (30s timeout)
- ESP32-compatible message format (service type byte 0x01 + JSON)
- Platform-agnostic via transport dependency injection
- Events: onDeviceDiscovered, onDeviceUpdated, onDeviceLost, onDeviceActivity
- Discovery messages: discovery_request / discovery_response

## Installation

```bash
npm install @lama/connection.discovery
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
import { DiscoveryProtocol } from '@lama/connection.discovery';
import { UdpServiceTransport } from '@lama/connection.udp-node'; // or connection.udp-expo

// Create transport
const transport = new UdpServiceTransport();

// Create discovery with config
const discovery = new DiscoveryProtocol({
  deviceId: 'my-device-001',
  deviceName: 'My Laptop',
  deviceType: 'Desktop',
  capabilities: ['chat', 'file-transfer'],
  version: '1.0.0'
}, transport);

// Initialize and start
await discovery.init();
await discovery.startDiscovery();

// Listen for devices
discovery.onDeviceDiscovered.addListener((device) => {
  console.log('Found:', device.name, device.address);
});

discovery.onDeviceLost.addListener((deviceId) => {
  console.log('Lost:', deviceId);
});

// Get devices
const devices = discovery.getDevices();
const specific = discovery.getDevice('device-id');

// Stop discovery
await discovery.stopDiscovery();
await discovery.shutdown();
```

## API

### DiscoveryProtocol

Main discovery protocol implementation.

#### Constructor

```typescript
new DiscoveryProtocol(config: Partial<DiscoveryConfig>, transport?: IQuicTransport)
```

#### Methods

- `async init(): Promise<boolean>` - Initialize discovery protocol
- `async startDiscovery(): Promise<void>` - Start broadcasting and listening
- `async stopDiscovery(): Promise<void>` - Stop discovery
- `getDevices(): Device[]` - Get all discovered devices
- `getDevice(deviceId: string): Device | undefined` - Get specific device
- `updateDeviceId(deviceId: string): void` - Update this device's ID
- `async shutdown(): Promise<void>` - Full shutdown

#### Events

- `onDeviceDiscovered` - Fired when new device discovered
- `onDeviceUpdated` - Fired when device info updated
- `onDeviceLost` - Fired when device times out
- `onDeviceActivity` - Fired on any device activity
- `onError` - Fired on errors

### Types

See [spec.md](../../specs/005-connection-discovery/spec.md) for complete type definitions.

## Architecture

```
connection.discovery
├── DiscoveryProtocol.ts    # Main discovery implementation
├── types.ts                # Discovery interfaces
└── index.ts                # Public API

Platform transports (injected):
├── connection.udp-expo     # React Native/Expo
└── connection.udp-node     # Node.js/Electron
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
