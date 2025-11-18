/**
 * @lama/connection.discovery
 *
 * Platform-agnostic device discovery protocol for lama ecosystem
 *
 * This package provides UDP-based device discovery with support for
 * ESP32 devices and other network peers.
 */

// Export main classes
export { DiscoveryProtocol } from './DiscoveryProtocol.js';
export { DiscoveryService } from './DiscoveryService.js';

// Export all types
export type {
  // Core types
  Device,
  DiscoveryConfig,
  DiscoveryMessage,

  // Transport types
  IQuicTransport,
  QuicTransportOptions,
  TransportStats,
  UdpRemoteInfo,

  // VC types
  DeviceIdentityCredential,
  DeviceIdentityCredentialSubject,
  VCPresentationMessage,
  VCProof,

  // Utility types
  EventEmitterLike
} from './types.js';

// Export enums as values (not types)
export { NetworkServiceType } from './types.js';
