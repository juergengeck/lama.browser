/**
 * NodeBTLETransport - Node.js/Electron BTLE transport implementation
 *
 * Provides Bluetooth Low Energy functionality using:
 * - @abandonware/noble for central role (scanning and connecting)
 * - @abandonware/bleno for peripheral role (advertising and serving)
 */

import { EventEmitter } from 'events';
import noble from '@abandonware/noble';
import bleno from '@abandonware/bleno';
import type {
  IBTLETransport,
  BTLEDevice,
  BTLEService,
  BTLECharacteristic,
  BTLEScanOptions,
  BTLEConnectionOptions,
  BTLEWriteOptions,
  BTLEAdvertisingOptions,
  BTLEServiceDef,
  BTLEState,
  BTLEStats
} from './types.js';
import Debug from 'debug';

const debug = Debug('lama:btle:node');

export class NodeBTLETransport extends EventEmitter implements IBTLETransport {
  private _initialized = false;
  private _state: BTLEState = 'unknown';
  private _scanning = false;
  private _advertising = false;
  private connectedDevices: Map<string, any> = new Map();
  private peripheralCache: Map<string, any> = new Map();
  private scanTimer: NodeJS.Timeout | null = null;

  private _stats: BTLEStats = {
    devicesDiscovered: 0,
    connectionsEstablished: 0,
    bytesReceived: 0,
    bytesSent: 0,
    errors: 0
  };

  constructor() {
    super();
    debug('NodeBTLETransport created');
  }

  async initialize(): Promise<boolean> {
    if (this._initialized) {
      debug('Already initialized');
      return true;
    }

    try {
      // Set up noble (central) event handlers
      noble.on('stateChange', (state: string) => {
        this._state = state as BTLEState;
        debug(`State changed: ${state}`);
        this.emit('stateChange', this._state);
      });

      noble.on('scanStart', () => {
        this._scanning = true;
        debug('Scan started');
        this.emit('scanStart');
      });

      noble.on('scanStop', () => {
        this._scanning = false;
        debug('Scan stopped');
        this.emit('scanStop');
      });

      noble.on('discover', (peripheral: any) => {
        this.handlePeripheralDiscovered(peripheral);
      });

      // Set up bleno (peripheral) event handlers
      bleno.on('stateChange', (state: string) => {
        debug(`Bleno state changed: ${state}`);
      });

      bleno.on('advertisingStart', (error: Error | null | undefined) => {
        if (error) {
          debug('Advertising start error:', error);
          this.emit('error', error);
        } else {
          this._advertising = true;
          debug('Advertising started');
          this.emit('advertisingStart');
        }
      });

      bleno.on('advertisingStop', () => {
        this._advertising = false;
        debug('Advertising stopped');
        this.emit('advertisingStop');
      });

      bleno.on('accept', (clientAddress: string) => {
        debug(`Client connected: ${clientAddress}`);
        this.emit('accept', clientAddress);
      });

      bleno.on('disconnect', (clientAddress: string) => {
        debug(`Client disconnected: ${clientAddress}`);
        this.emit('disconnect', clientAddress);
      });

      this._initialized = true;
      // noble._state is the internal state property
      this._state = (noble as any)._state as BTLEState || 'unknown';
      debug('Initialized successfully, state:', this._state);
      return true;

    } catch (error) {
      debug('Initialization failed:', error);
      this._stats.errors++;
      this.emit('error', error as Error);
      return false;
    }
  }

  async shutdown(): Promise<void> {
    debug('Shutting down...');

    // Stop scanning
    if (this._scanning) {
      await this.stopScanning();
    }

    // Stop advertising
    if (this._advertising) {
      await this.stopAdvertising();
    }

    // Disconnect all devices
    for (const deviceId of this.connectedDevices.keys()) {
      await this.disconnect(deviceId);
    }

    this._initialized = false;
    this.removeAllListeners();
    debug('Shutdown complete');
  }

  getState(): BTLEState {
    return this._state;
  }

  isPoweredOn(): boolean {
    return this._state === 'poweredOn';
  }

  // ===== CENTRAL ROLE (Scanning and Connecting) =====

  async startScanning(options?: BTLEScanOptions): Promise<void> {
    if (!this._initialized) {
      throw new Error('Transport not initialized');
    }

    if (!this.isPoweredOn()) {
      throw new Error(`Cannot scan, Bluetooth is ${this._state}`);
    }

    if (this._scanning) {
      debug('Already scanning');
      return;
    }

    try {
      const serviceUUIDs = options?.serviceUUIDs || [];
      const allowDuplicates = options?.allowDuplicates || false;

      debug(`Starting scan (duplicates: ${allowDuplicates}, services: ${serviceUUIDs.join(', ')})`);
      noble.startScanning(serviceUUIDs, allowDuplicates);

      // Set scan duration timer if specified
      if (options?.scanDuration) {
        this.scanTimer = setTimeout(() => {
          this.stopScanning();
        }, options.scanDuration);
      }

    } catch (error) {
      debug('Start scanning error:', error);
      this._stats.errors++;
      throw error;
    }
  }

  async stopScanning(): Promise<void> {
    if (!this._scanning) {
      return;
    }

    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }

    try {
      debug('Stopping scan');
      noble.stopScanning();
    } catch (error) {
      debug('Stop scanning error:', error);
      this._stats.errors++;
      throw error;
    }
  }

  isScanning(): boolean {
    return this._scanning;
  }

  async connect(deviceId: string, options?: BTLEConnectionOptions): Promise<void> {
    if (!this._initialized) {
      throw new Error('Transport not initialized');
    }

    const peripheral = this.peripheralCache.get(deviceId);
    if (!peripheral) {
      throw new Error(`Device ${deviceId} not found. Did you scan first?`);
    }

    if (this.connectedDevices.has(deviceId)) {
      debug(`Already connected to ${deviceId}`);
      return;
    }

    try {
      debug(`Connecting to ${deviceId}...`);

      await new Promise<void>((resolve, reject) => {
        const timeout = options?.timeout || 30000;
        const timer = setTimeout(() => {
          reject(new Error(`Connection timeout after ${timeout}ms`));
        }, timeout);

        peripheral.connect((error?: Error) => {
          clearTimeout(timer);
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.connectedDevices.set(deviceId, peripheral);
      this._stats.connectionsEstablished++;
      debug(`Connected to ${deviceId}`);
      this.emit('connect', deviceId);

      // Set up disconnect handler
      peripheral.once('disconnect', () => {
        this.connectedDevices.delete(deviceId);
        debug(`Disconnected from ${deviceId}`);
        this.emit('disconnect', deviceId);
      });

    } catch (error) {
      debug(`Connection error for ${deviceId}:`, error);
      this._stats.errors++;
      throw error;
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    const peripheral = this.connectedDevices.get(deviceId);
    if (!peripheral) {
      return;
    }

    try {
      debug(`Disconnecting from ${deviceId}...`);
      await new Promise<void>((resolve) => {
        peripheral.disconnect(() => {
          resolve();
        });
      });
    } catch (error) {
      debug(`Disconnect error for ${deviceId}:`, error);
      this._stats.errors++;
      throw error;
    }
  }

  isConnected(deviceId: string): boolean {
    return this.connectedDevices.has(deviceId);
  }

  // ===== GATT OPERATIONS =====

  async discoverServices(deviceId: string): Promise<BTLEService[]> {
    const peripheral = this.connectedDevices.get(deviceId);
    if (!peripheral) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    try {
      const services = await new Promise<any[]>((resolve, reject) => {
        peripheral.discoverServices([], (error?: Error, services?: any[]) => {
          if (error) reject(error);
          else resolve(services || []);
        });
      });

      return services.map(service => ({
        uuid: service.uuid,
        name: service.name,
        characteristics: []
      }));

    } catch (error) {
      debug(`Discover services error for ${deviceId}:`, error);
      this._stats.errors++;
      throw error;
    }
  }

  async discoverCharacteristics(deviceId: string, serviceUUID: string): Promise<BTLECharacteristic[]> {
    const peripheral = this.connectedDevices.get(deviceId);
    if (!peripheral) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    try {
      // First get services
      const services = await new Promise<any[]>((resolve, reject) => {
        peripheral.discoverServices([serviceUUID], (error?: Error, services?: any[]) => {
          if (error) reject(error);
          else resolve(services || []);
        });
      });

      const service = services.find(s => s.uuid === serviceUUID);
      if (!service) {
        throw new Error(`Service ${serviceUUID} not found`);
      }

      // Then get characteristics
      const characteristics = await new Promise<any[]>((resolve, reject) => {
        service.discoverCharacteristics([], (error?: Error, chars?: any[]) => {
          if (error) reject(error);
          else resolve(chars || []);
        });
      });

      return characteristics.map(char => ({
        uuid: char.uuid,
        name: char.name,
        properties: char.properties,
        value: undefined
      }));

    } catch (error) {
      debug(`Discover characteristics error for ${deviceId}/${serviceUUID}:`, error);
      this._stats.errors++;
      throw error;
    }
  }

  async readCharacteristic(deviceId: string, serviceUUID: string, characteristicUUID: string): Promise<Buffer> {
    const peripheral = this.connectedDevices.get(deviceId);
    if (!peripheral) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    try {
      const services = await new Promise<any[]>((resolve, reject) => {
        peripheral.discoverServices([serviceUUID], (error?: Error, services?: any[]) => {
          if (error) reject(error);
          else resolve(services || []);
        });
      });

      const service = services[0];
      if (!service) {
        throw new Error(`Service ${serviceUUID} not found`);
      }

      const characteristics = await new Promise<any[]>((resolve, reject) => {
        service.discoverCharacteristics([characteristicUUID], (error?: Error, chars?: any[]) => {
          if (error) reject(error);
          else resolve(chars || []);
        });
      });

      const characteristic = characteristics[0];
      if (!characteristic) {
        throw new Error(`Characteristic ${characteristicUUID} not found`);
      }

      const data = await new Promise<Buffer>((resolve, reject) => {
        characteristic.read((error?: Error, data?: Buffer) => {
          if (error) reject(error);
          else resolve(data || Buffer.alloc(0));
        });
      });

      this._stats.bytesReceived += data.length;
      debug(`Read ${data.length} bytes from ${deviceId}/${serviceUUID}/${characteristicUUID}`);
      return data;

    } catch (error) {
      debug(`Read characteristic error:`, error);
      this._stats.errors++;
      throw error;
    }
  }

  async writeCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    data: Buffer,
    options?: BTLEWriteOptions
  ): Promise<void> {
    const peripheral = this.connectedDevices.get(deviceId);
    if (!peripheral) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    try {
      const services = await new Promise<any[]>((resolve, reject) => {
        peripheral.discoverServices([serviceUUID], (error?: Error, services?: any[]) => {
          if (error) reject(error);
          else resolve(services || []);
        });
      });

      const service = services[0];
      if (!service) {
        throw new Error(`Service ${serviceUUID} not found`);
      }

      const characteristics = await new Promise<any[]>((resolve, reject) => {
        service.discoverCharacteristics([characteristicUUID], (error?: Error, chars?: any[]) => {
          if (error) reject(error);
          else resolve(chars || []);
        });
      });

      const characteristic = characteristics[0];
      if (!characteristic) {
        throw new Error(`Characteristic ${characteristicUUID} not found`);
      }

      const withoutResponse = options?.withoutResponse || false;
      await new Promise<void>((resolve, reject) => {
        characteristic.write(data, withoutResponse, (error?: Error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      this._stats.bytesSent += data.length;
      debug(`Wrote ${data.length} bytes to ${deviceId}/${serviceUUID}/${characteristicUUID}`);

    } catch (error) {
      debug(`Write characteristic error:`, error);
      this._stats.errors++;
      throw error;
    }
  }

  async subscribeCharacteristic(deviceId: string, serviceUUID: string, characteristicUUID: string): Promise<void> {
    const peripheral = this.connectedDevices.get(deviceId);
    if (!peripheral) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    try {
      const services = await new Promise<any[]>((resolve, reject) => {
        peripheral.discoverServices([serviceUUID], (error?: Error, services?: any[]) => {
          if (error) reject(error);
          else resolve(services || []);
        });
      });

      const service = services[0];
      if (!service) {
        throw new Error(`Service ${serviceUUID} not found`);
      }

      const characteristics = await new Promise<any[]>((resolve, reject) => {
        service.discoverCharacteristics([characteristicUUID], (error?: Error, chars?: any[]) => {
          if (error) reject(error);
          else resolve(chars || []);
        });
      });

      const characteristic = characteristics[0];
      if (!characteristic) {
        throw new Error(`Characteristic ${characteristicUUID} not found`);
      }

      await new Promise<void>((resolve, reject) => {
        characteristic.subscribe((error?: Error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // Set up value changed handler
      characteristic.on('data', (data: Buffer, isNotification: boolean) => {
        this._stats.bytesReceived += data.length;
        debug(`Value changed: ${deviceId}/${serviceUUID}/${characteristicUUID}, ${data.length} bytes`);
        this.emit('characteristicValueChanged', deviceId, serviceUUID, characteristicUUID, data);
      });

      debug(`Subscribed to ${deviceId}/${serviceUUID}/${characteristicUUID}`);

    } catch (error) {
      debug(`Subscribe characteristic error:`, error);
      this._stats.errors++;
      throw error;
    }
  }

  async unsubscribeCharacteristic(deviceId: string, serviceUUID: string, characteristicUUID: string): Promise<void> {
    const peripheral = this.connectedDevices.get(deviceId);
    if (!peripheral) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    try {
      const services = await new Promise<any[]>((resolve, reject) => {
        peripheral.discoverServices([serviceUUID], (error?: Error, services?: any[]) => {
          if (error) reject(error);
          else resolve(services || []);
        });
      });

      const service = services[0];
      const characteristics = await new Promise<any[]>((resolve, reject) => {
        service.discoverCharacteristics([characteristicUUID], (error?: Error, chars?: any[]) => {
          if (error) reject(error);
          else resolve(chars || []);
        });
      });

      const characteristic = characteristics[0];
      if (!characteristic) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        characteristic.unsubscribe((error?: Error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      characteristic.removeAllListeners('data');
      debug(`Unsubscribed from ${deviceId}/${serviceUUID}/${characteristicUUID}`);

    } catch (error) {
      debug(`Unsubscribe characteristic error:`, error);
      this._stats.errors++;
      throw error;
    }
  }

  // ===== PERIPHERAL ROLE (Advertising and Serving) =====

  async startAdvertising(options: BTLEAdvertisingOptions): Promise<void> {
    if (!this._initialized) {
      throw new Error('Transport not initialized');
    }

    if (this._advertising) {
      debug('Already advertising');
      return;
    }

    try {
      const name = options.name;
      const serviceUUIDs = options.serviceUUIDs || [];

      debug(`Starting advertising: ${name}, services: ${serviceUUIDs.join(', ')}`);

      await new Promise<void>((resolve, reject) => {
        bleno.startAdvertising(name, serviceUUIDs, (error: Error | null | undefined) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

    } catch (error) {
      debug('Start advertising error:', error);
      this._stats.errors++;
      throw error;
    }
  }

  async stopAdvertising(): Promise<void> {
    if (!this._advertising) {
      return;
    }

    try {
      debug('Stopping advertising');
      bleno.stopAdvertising();
    } catch (error) {
      debug('Stop advertising error:', error);
      this._stats.errors++;
      throw error;
    }
  }

  isAdvertising(): boolean {
    return this._advertising;
  }

  async setServices(services: BTLEServiceDef[]): Promise<void> {
    // Note: bleno service setup is complex and requires creating
    // bleno.PrimaryService and bleno.Characteristic objects
    // This is a placeholder - full implementation would need bleno types
    debug('setServices called - implementation pending');
    throw new Error('setServices not yet implemented - requires bleno characteristic handlers');
  }

  async updateCharacteristicValue(serviceUUID: string, characteristicUUID: string, value: Buffer): Promise<void> {
    // Note: This would notify subscribed central devices
    // Implementation requires tracking bleno characteristics
    debug('updateCharacteristicValue called - implementation pending');
    throw new Error('updateCharacteristicValue not yet implemented');
  }

  // ===== PRIVATE METHODS =====

  private handlePeripheralDiscovered(peripheral: any): void {
    const device: BTLEDevice = {
      id: peripheral.id || peripheral.uuid,
      name: peripheral.advertisement?.localName,
      address: peripheral.address,
      addressType: peripheral.addressType,
      rssi: peripheral.rssi,
      services: peripheral.advertisement?.serviceUuids || [],
      manufacturerData: peripheral.advertisement?.manufacturerData,
      serviceData: peripheral.advertisement?.serviceData
    };

    // Cache peripheral for later connection
    this.peripheralCache.set(device.id, peripheral);
    this._stats.devicesDiscovered++;

    debug(`Discovered: ${device.name || device.id} (${device.address}), RSSI: ${device.rssi}`);
    this.emit('discover', device);
  }

  get stats(): BTLEStats {
    return { ...this._stats };
  }
}
