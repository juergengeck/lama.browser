# @lama/connection.btle-node

Node.js/Electron Bluetooth Low Energy (BTLE) transport implementation for lama connection packages.

Uses [@abandonware/noble](https://github.com/abandonware/noble) for central role (scanning and connecting) and [@abandonware/bleno](https://github.com/abandonware/bleno) for peripheral role (advertising and serving).

## Installation

```bash
npm install @lama/connection.btle-node
```

## Platform Support

- Node.js (v14+)
- Electron (main process)
- macOS, Linux, Windows (with compatible Bluetooth adapter)

## Basic Usage

### Central Role (Client - Scanning and Connecting)

```typescript
import { NodeBTLETransport } from '@lama/connection.btle-node';

const transport = new NodeBTLETransport();

// Initialize
await transport.initialize();

// Wait for powered on state
if (!transport.isPoweredOn()) {
  await new Promise(resolve => {
    transport.once('stateChange', (state) => {
      if (state === 'poweredOn') resolve();
    });
  });
}

// Listen for discovered devices
transport.on('discover', (device) => {
  console.log('Discovered:', device.name, device.id, device.rssi);
});

// Start scanning
await transport.startScanning({
  serviceUUIDs: ['180A'], // Optional: filter by service UUID
  allowDuplicates: false,
  scanDuration: 10000 // Optional: auto-stop after 10s
});

// Connect to device
await transport.connect(deviceId);

// Discover services
const services = await transport.discoverServices(deviceId);

// Read characteristic
const value = await transport.readCharacteristic(
  deviceId,
  'serviceUUID',
  'characteristicUUID'
);

// Write characteristic
await transport.writeCharacteristic(
  deviceId,
  'serviceUUID',
  'characteristicUUID',
  Buffer.from('data'),
  { withoutResponse: false }
);

// Subscribe to notifications
transport.on('characteristicValueChanged', (deviceId, serviceUUID, charUUID, value) => {
  console.log('Notification:', value);
});

await transport.subscribeCharacteristic(deviceId, 'serviceUUID', 'characteristicUUID');

// Cleanup
await transport.disconnect(deviceId);
await transport.shutdown();
```

### Peripheral Role (Server - Advertising and Serving)

```typescript
import { NodeBTLETransport, BTLEServiceDef } from '@lama/connection.btle-node';

const transport = new NodeBTLETransport();

await transport.initialize();

// Define services with characteristics
const services: BTLEServiceDef[] = [
  {
    uuid: '1234',
    characteristics: [
      {
        uuid: '5678',
        properties: ['read', 'write', 'notify'],
        value: Buffer.from('initial value'),

        onReadRequest: async (offset) => {
          return Buffer.from('response data').slice(offset);
        },

        onWriteRequest: async (data, offset, withoutResponse) => {
          console.log('Received write:', data.toString());
          // Handle write...
        },

        onSubscribe: async () => {
          console.log('Client subscribed');
        },

        onUnsubscribe: async () => {
          console.log('Client unsubscribed');
        }
      }
    ]
  }
];

// Set services
await transport.setServices(services);

// Start advertising
await transport.startAdvertising({
  name: 'lama-cube',
  serviceUUIDs: ['1234'],
  connectable: true
});

// Listen for connections
transport.on('accept', (clientAddress) => {
  console.log('Client connected:', clientAddress);
});

// Update characteristic value and notify subscribers
await transport.updateCharacteristicValue(
  '1234', // serviceUUID
  '5678', // characteristicUUID
  Buffer.from('new value')
);

// Cleanup
await transport.stopAdvertising();
await transport.shutdown();
```

## Integration with lama.cube

In lama.cube (Electron), you can use this transport in the main process:

```typescript
// main.ts or preload.ts
import { NodeBTLETransport } from '@lama/connection.btle-node';

class BTLEConnectionManager {
  private transport: NodeBTLETransport;

  async initialize() {
    this.transport = new NodeBTLETransport();
    await this.transport.initialize();

    // Set up event forwarding to renderer process
    this.transport.on('discover', (device) => {
      // Send to renderer via IPC
      mainWindow.webContents.send('btle:discover', device);
    });

    return this.transport.isPoweredOn();
  }

  async startDiscovery() {
    await this.transport.startScanning({
      serviceUUIDs: ['your-service-uuid'],
      allowDuplicates: false
    });
  }

  async connectToDevice(deviceId: string) {
    await this.transport.connect(deviceId);
    const services = await this.transport.discoverServices(deviceId);
    return services;
  }
}

// Expose to renderer via contextBridge
contextBridge.exposeInMainWorld('btle', {
  initialize: () => manager.initialize(),
  startDiscovery: () => manager.startDiscovery(),
  connect: (deviceId: string) => manager.connectToDevice(deviceId),
  // ... other methods
});
```

## API Reference

### IBTLETransport Interface

#### Initialization
- `initialize(): Promise<boolean>` - Initialize transport
- `shutdown(): Promise<void>` - Shutdown and cleanup
- `getState(): BTLEState` - Get current Bluetooth state
- `isPoweredOn(): boolean` - Check if Bluetooth is powered on

#### Central Role (Scanning & Connecting)
- `startScanning(options?: BTLEScanOptions): Promise<void>`
- `stopScanning(): Promise<void>`
- `isScanning(): boolean`
- `connect(deviceId: string, options?: BTLEConnectionOptions): Promise<void>`
- `disconnect(deviceId: string): Promise<void>`
- `isConnected(deviceId: string): boolean`

#### GATT Operations
- `discoverServices(deviceId: string): Promise<BTLEService[]>`
- `discoverCharacteristics(deviceId: string, serviceUUID: string): Promise<BTLECharacteristic[]>`
- `readCharacteristic(deviceId, serviceUUID, characteristicUUID): Promise<Buffer>`
- `writeCharacteristic(deviceId, serviceUUID, characteristicUUID, data, options?): Promise<void>`
- `subscribeCharacteristic(deviceId, serviceUUID, characteristicUUID): Promise<void>`
- `unsubscribeCharacteristic(deviceId, serviceUUID, characteristicUUID): Promise<void>`

#### Peripheral Role (Advertising & Serving)
- `startAdvertising(options: BTLEAdvertisingOptions): Promise<void>`
- `stopAdvertising(): Promise<void>`
- `isAdvertising(): boolean`
- `setServices(services: BTLEServiceDef[]): Promise<void>`
- `updateCharacteristicValue(serviceUUID, characteristicUUID, value): Promise<void>`

#### Events
- `stateChange` - Bluetooth adapter state changed
- `discover` - Device discovered during scan
- `connect` - Device connected
- `disconnect` - Device disconnected
- `characteristicValueChanged` - Notification/indication received
- `advertisingStart` - Advertising started
- `advertisingStop` - Advertising stopped
- `accept` - Client connected (peripheral mode)
- `error` - Error occurred

## Limitations

- noble/bleno libraries require native Bluetooth support
- Some platforms may require additional system permissions
- Peripheral mode (bleno) has limited support on some platforms
- Cannot run central and peripheral roles simultaneously on same adapter

## Debugging

Enable debug output:

```bash
DEBUG=btle:* node your-app.js
```

## License

See main lama repository for license information.
