/**
 * Type definitions for discovery protocol
 *
 * These types define the interfaces for device discovery and transport.
 */

import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';

/**
 * Remote socket information for UDP
 */
export interface UdpRemoteInfo {
  address: string;
  port: number;
  family: string;
  size?: number;
}

/**
 * Transport options for initialization
 */
export interface QuicTransportOptions {
  port?: number;
  host?: string;
  maxDatagramSize?: number;
  deviceId?: string;
}

/**
 * Transport statistics
 */
export interface TransportStats {
  packetsReceived: number;
  packetsSent: number;
  bytesReceived: number;
  bytesSent: number;
  errors: number;
}

/**
 * QUIC Transport Interface
 *
 * Core transport layer interface with no discovery functionality
 */
export interface IQuicTransport {
  // Core functionality
  init(options?: QuicTransportOptions): Promise<void>;
  listen(options?: QuicTransportOptions): Promise<void>;
  send(data: any, address: string, port: number): Promise<void>;
  close(): Promise<void>;

  // Status methods
  isInitialized(): boolean;
  getInfo(): Promise<{port: number, host: string} | null>;

  // Diagnostics
  runDiagnostics(): Promise<string>;

  // Datagram service types
  addService(serviceType: number, handler: (data: any, rinfo: UdpRemoteInfo) => void): void;
  removeService(serviceType: number): void;
  clearServices(): void;

  // Event handling using OEvent pattern
  on(event: 'ready' | 'close', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'message', listener: (data: Buffer, rinfo: UdpRemoteInfo) => void): this;

  // Optional properties (implementation specific)
  readonly socketId?: string | number;
  readonly stats?: TransportStats;
}

/**
 * Service Types for QuicTransport
 * Prefixed with a byte in messages to route to the correct handler.
 */
export enum NetworkServiceType {
  DISCOVERY_SERVICE = 1,      // HTML-based device discovery broadcasts (unclaimed devices)
  CREDENTIAL_SERVICE = 2,     // Credential provisioning and ownership removal
  LED_CONTROL_SERVICE = 3,    // LED control commands to ESP32
  ESP32_DATA_SERVICE = 4,     // ESP32 general data messages (reserved for ESP32 use)
  JOURNAL_SYNC_SERVICE = 5,   // Journal-based data synchronization
  ATTESTATION_SERVICE = 6,    // True cryptographic attestations with signatures
  VC_EXCHANGE_SERVICE = 7,    // Verifiable Credential exchange for authentication
  HEARTBEAT_SERVICE = 8,      // Connection heartbeat messages
  // Gap for future services...
  ESP32_RESPONSE_SERVICE = 11, // ESP32 command responses (ownership ack, etc.)
}

/**
 * Device interface
 */
export interface Device {
  // Core identification
  id: string;
  deviceId: string;
  name: string;
  type: string;
  deviceType: string;

  // Network information
  address: string;
  port: number;

  // Capabilities and status
  capabilities: string[];
  online?: boolean;
  lastSeen: number;

  // Optional device status
  status?: {
    blue_led?: string;
    [key: string]: any;
  };

  // LED status
  blueLedStatus?: 'on' | 'off' | 'blink';

  // Ownership
  ownerId?: string;
  hasValidCredential?: boolean;

  // Transport status
  wifiStatus?: 'active' | 'inactive';
  btleStatus?: 'active' | 'inactive';
}

/**
 * Discovery message format
 */
export interface DiscoveryMessage {
  type: 'discovery_request' | 'discovery_response';
  deviceId: string;
  deviceName: string;
  deviceType: string;
  capabilities: string[];
  version: string;
  timestamp: number;
  localIPs?: string[];
  deviceStatus?: {
    blue_led?: string;
    [key: string]: any;
  };
}

/**
 * Discovery protocol configuration
 */
export interface DiscoveryConfig {
  // Device information
  deviceId: string;
  deviceName: string;
  deviceType: string;
  capabilities: string[];
  version: string;

  // Network configuration
  discoveryPort: number;
  discoveryInterval: number;
  maxAge: number;
  broadcastAddress: string;
}

/**
 * Verifiable Credential (VC) related interfaces
 */

/**
 * Structure for the 'proof' component of a Verifiable Credential.
 */
export interface VCProof {
  type: string;
  created?: string;
  proofPurpose: string;
  verificationMethod: string;
  proofValue: string;
}

/**
 * Structure for the 'credentialSubject' component of a DeviceIdentityCredential.
 */
export interface DeviceIdentityCredentialSubject {
  id: string;
  publicKeyHex: string;
  type?: string;
  capabilities?: string[];
}

/**
 * DeviceIdentityCredential Recipe
 */
export interface DeviceIdentityCredential {
  $type$: 'DeviceIdentityCredential';
  id: string;
  owner: string;
  controller?: string;
  credentialSubject: DeviceIdentityCredentialSubject;
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  proof: VCProof;
}

/**
 * Message structure for presenting a VC.
 */
export interface VCPresentationMessage {
  type: 'present_vc';
  vc: DeviceIdentityCredential;
}

/**
 * EventEmitter interface for type compatibility
 */
export interface EventEmitterLike {
  emit(event: string, ...args: any[]): boolean;
  on(event: string, listener: Function): this;
  addListener(event: string, listener: Function): this;
  once(event: string, listener: Function): this;
  removeListener(event: string, listener: Function): this;
  removeAllListeners(event?: string): this;
}
