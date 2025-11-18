/**
 * Type definitions for BTLE transport
 *
 * These types define the interfaces for Bluetooth Low Energy communication
 * using noble (central role) and bleno (peripheral role).
 */

import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';

/**
 * BTLE Device discovered during scanning
 */
export interface BTLEDevice {
  id: string;
  name?: string;
  address: string;
  addressType: 'public' | 'random';
  rssi: number;
  services: string[];
  manufacturerData?: Buffer;
  serviceData?: Array<{
    uuid: string;
    data: Buffer;
  }>;
}

/**
 * BTLE Service
 */
export interface BTLEService {
  uuid: string;
  name?: string;
  characteristics: BTLECharacteristic[];
}

/**
 * BTLE Characteristic
 */
export interface BTLECharacteristic {
  uuid: string;
  name?: string;
  properties: string[]; // ['read', 'write', 'notify', 'indicate', etc.]
  value?: Buffer;
}

/**
 * Options for scanning
 */
export interface BTLEScanOptions {
  allowDuplicates?: boolean;
  scanDuration?: number; // milliseconds
  serviceUUIDs?: string[];
}

/**
 * Options for connection
 */
export interface BTLEConnectionOptions {
  timeout?: number; // milliseconds
  autoConnect?: boolean;
}

/**
 * Options for writing characteristic
 */
export interface BTLEWriteOptions {
  withoutResponse?: boolean;
}

/**
 * Options for advertising (peripheral mode)
 */
export interface BTLEAdvertisingOptions {
  name: string;
  serviceUUIDs?: string[];
  manufacturerData?: Buffer;
  txPowerLevel?: number;
  connectable?: boolean;
}

/**
 * Characteristic definition for peripheral mode
 */
export interface BTLECharacteristicDef {
  uuid: string;
  properties: string[]; // ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate']
  value?: Buffer;
  descriptors?: BTLEDescriptorDef[];
  onReadRequest?: (offset: number) => Buffer | Promise<Buffer>;
  onWriteRequest?: (data: Buffer, offset: number, withoutResponse: boolean) => void | Promise<void>;
  onSubscribe?: () => void | Promise<void>;
  onUnsubscribe?: () => void | Promise<void>;
}

/**
 * Descriptor definition for peripheral mode
 */
export interface BTLEDescriptorDef {
  uuid: string;
  value?: Buffer;
  onReadRequest?: (offset: number) => Buffer | Promise<Buffer>;
  onWriteRequest?: (data: Buffer, offset: number) => void | Promise<void>;
}

/**
 * Service definition for peripheral mode
 */
export interface BTLEServiceDef {
  uuid: string;
  characteristics: BTLECharacteristicDef[];
}

/**
 * BTLE state
 */
export type BTLEState =
  | 'unknown'
  | 'resetting'
  | 'unsupported'
  | 'unauthorized'
  | 'poweredOff'
  | 'poweredOn';

/**
 * Main BTLE Transport interface
 */
export interface IBTLETransport {
  // Initialization
  initialize(): Promise<boolean>;
  shutdown(): Promise<void>;

  // State
  getState(): BTLEState;
  isPoweredOn(): boolean;

  // Central role (scanning and connecting)
  startScanning(options?: BTLEScanOptions): Promise<void>;
  stopScanning(): Promise<void>;
  isScanning(): boolean;

  connect(deviceId: string, options?: BTLEConnectionOptions): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  isConnected(deviceId: string): boolean;

  // GATT operations (central role)
  discoverServices(deviceId: string): Promise<BTLEService[]>;
  discoverCharacteristics(deviceId: string, serviceUUID: string): Promise<BTLECharacteristic[]>;

  readCharacteristic(deviceId: string, serviceUUID: string, characteristicUUID: string): Promise<Buffer>;
  writeCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    data: Buffer,
    options?: BTLEWriteOptions
  ): Promise<void>;

  subscribeCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<void>;
  unsubscribeCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<void>;

  // Peripheral role (advertising and serving)
  startAdvertising(options: BTLEAdvertisingOptions): Promise<void>;
  stopAdvertising(): Promise<void>;
  isAdvertising(): boolean;

  setServices(services: BTLEServiceDef[]): Promise<void>;
  updateCharacteristicValue(
    serviceUUID: string,
    characteristicUUID: string,
    value: Buffer
  ): Promise<void>;

  // Events
  on(event: 'stateChange', listener: (state: BTLEState) => void): this;
  on(event: 'scanStart', listener: () => void): this;
  on(event: 'scanStop', listener: () => void): this;
  on(event: 'discover', listener: (device: BTLEDevice) => void): this;
  on(event: 'connect', listener: (deviceId: string) => void): this;
  on(event: 'disconnect', listener: (deviceId: string) => void): this;
  on(event: 'characteristicValueChanged', listener: (deviceId: string, serviceUUID: string, characteristicUUID: string, value: Buffer) => void): this;
  on(event: 'advertisingStart', listener: () => void): this;
  on(event: 'advertisingStop', listener: () => void): this;
  on(event: 'accept', listener: (clientAddress: string) => void): this;
  on(event: 'disconnect', listener: (clientAddress: string) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;

  once(event: string, listener: (...args: any[]) => void): this;
  removeListener(event: string, listener: (...args: any[]) => void): this;
  removeAllListeners(event?: string): this;
}

/**
 * Transport statistics
 */
export interface BTLEStats {
  devicesDiscovered: number;
  connectionsEstablished: number;
  bytesReceived: number;
  bytesSent: number;
  errors: number;
}
