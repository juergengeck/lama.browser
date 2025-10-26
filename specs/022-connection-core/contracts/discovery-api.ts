/**
 * Discovery API Contract
 *
 * Defines interfaces for peer discovery mechanisms including local network
 * discovery (mDNS/Bonjour) and relay-based discovery.
 */

import type { PeerIdentity } from './platform-deps';

/**
 * Discovery service coordinator
 *
 * Manages both local and relay discovery, deduplicates results,
 * and provides filtering capabilities.
 */
export interface DiscoveryService {
  /**
   * Initialize discovery service
   */
  initialize(): Promise<void>;

  /**
   * Start continuous discovery
   * Emits 'peerDiscovered' events as peers are found
   */
  start(options?: DiscoveryOptions): void;

  /**
   * Stop continuous discovery
   */
  stop(): void;

  /**
   * Perform one-time discovery scan
   * @returns List of discovered peers
   */
  scan(options?: DiscoveryOptions): Promise<PeerIdentity[]>;

  /**
   * Get list of currently discovered peers
   */
  getDiscoveredPeers(): PeerIdentity[];

  /**
   * Filter discovered peers by capability
   */
  filterByCapability(capability: string): PeerIdentity[];

  /**
   * Clear discovery cache
   */
  clearCache(): void;

  /**
   * Register event listener
   */
  on(event: DiscoveryEvent, callback: (peer: PeerIdentity) => void): void;
}

/**
 * Discovery options
 */
export interface DiscoveryOptions {
  /** Discovery methods to use (default: both) */
  methods?: ('local' | 'relay')[];

  /** Filter by required capabilities */
  requiredCapabilities?: string[];

  /** Discovery timeout in ms (default: 5000) */
  timeout?: number;

  /** Include self in results (default: false) */
  includeSelf?: boolean;
}

export type DiscoveryEvent = 'peerDiscovered' | 'peerLost' | 'scanComplete';

/**
 * Local network discovery (mDNS/Bonjour pattern)
 *
 * Platform-specific implementations for discovering peers on same local network
 */
export interface LocalDiscovery {
  /**
   * Check if local discovery is available on this platform
   */
  isAvailable(): boolean;

  /**
   * Start broadcasting own presence
   * @param info Own peer information to advertise
   */
  startBroadcast(info: LocalPeerAdvertisement): Promise<void>;

  /**
   * Stop broadcasting
   */
  stopBroadcast(): void;

  /**
   * Start listening for peer broadcasts
   */
  startListening(): Promise<void>;

  /**
   * Stop listening
   */
  stopListening(): void;

  /**
   * Get list of discovered local peers
   */
  getDiscoveredPeers(): LocalPeerInfo[];

  /**
   * Register callback for peer discovery
   */
  onPeerDiscovered(callback: (peer: LocalPeerInfo) => void): void;

  /**
   * Register callback for peer lost
   */
  onPeerLost(callback: (peerId: string) => void): void;
}

/**
 * Local peer advertisement data
 * Broadcast on local network for discovery
 */
export interface LocalPeerAdvertisement {
  /** Peer ID */
  id: string;

  /** Human-readable name */
  name: string;

  /** Supported capabilities (transports, features) */
  capabilities: string[];

  /** Network address (IP:port) */
  address: string;

  /** Port for connection */
  port: number;

  /** Service type (for mDNS/Bonjour) */
  serviceType: string; // e.g., "_lama._tcp"
}

/**
 * Discovered local peer information
 */
export interface LocalPeerInfo {
  id: string;
  name: string;
  address: string;
  port: number;
  capabilities: string[];
  discoveredAt: number;
  lastSeenAt: number;
}

/**
 * Relay-based discovery (for remote peers)
 *
 * Uses relay server to discover peers not on same local network
 */
export interface RelayDiscovery {
  /**
   * Register presence with relay server
   * @param info Own peer information
   */
  register(info: RelayPeerAdvertisement): Promise<void>;

  /**
   * Unregister from relay server
   */
  unregister(): Promise<void>;

  /**
   * Query relay for available peers
   * @param filter Optional filter criteria
   */
  queryPeers(filter?: RelayQueryFilter): Promise<RelayPeerInfo[]>;

  /**
   * Get connection info for specific peer via relay
   * Returns relay address and connection details for establishing P2P connection
   */
  getConnectionInfo(peerId: string): Promise<RelayConnectionInfo>;

  /**
   * Update presence information (heartbeat)
   */
  updatePresence(): Promise<void>;
}

/**
 * Relay peer advertisement data
 */
export interface RelayPeerAdvertisement {
  id: string;
  name: string;
  capabilities: string[];
  relayAddress: string; // URL of relay server
  publicKey: string; // For establishing secure connection
}

/**
 * Relay query filter
 */
export interface RelayQueryFilter {
  /** Filter by required capabilities */
  requiredCapabilities?: string[];

  /** Filter by peer IDs */
  peerIds?: string[];

  /** Maximum results to return */
  limit?: number;
}

/**
 * Relay peer information from query
 */
export interface RelayPeerInfo {
  id: string;
  name: string;
  capabilities: string[];
  relayAddress: string;
  publicKey: string;
  lastSeen: number;
}

/**
 * Relay connection information
 * Used to establish direct P2P connection via relay coordination
 */
export interface RelayConnectionInfo {
  peerId: string;
  relayUrl: string;
  sessionId: string; // Temporary session for connection setup
  stunServers?: string[]; // STUN servers for NAT traversal
  turnServers?: TurnServerInfo[]; // TURN servers if direct connection fails
}

export interface TurnServerInfo {
  urls: string[];
  username: string;
  credential: string;
}

/**
 * Peer deduplication logic
 *
 * When same peer discovered via multiple methods (local + relay),
 * deduplicate and merge information.
 */
export interface PeerDeduplicator {
  /**
   * Deduplicate peers discovered from multiple sources
   *
   * @param localPeers Peers from local network discovery
   * @param relayPeers Peers from relay discovery
   * @returns Deduplicated list with preference for local
   */
  deduplicate(localPeers: PeerIdentity[], relayPeers: PeerIdentity[]): PeerIdentity[];

  /**
   * Merge peer information from different sources
   * Prefers local address over relay, combines capabilities
   */
  merge(local: PeerIdentity, relay: PeerIdentity): PeerIdentity;
}

/**
 * Default discovery configuration
 */
export const DEFAULT_DISCOVERY_CONFIG = {
  /** Local discovery timeout */
  localTimeout: 2000, // 2 seconds

  /** Relay discovery timeout */
  relayTimeout: 5000, // 5 seconds

  /** Presence update interval (relay heartbeat) */
  presenceInterval: 30000, // 30 seconds

  /** Peer expiration time (remove if not seen) */
  peerExpirationTime: 120000, // 2 minutes

  /** Service type for mDNS/Bonjour */
  serviceType: '_lama._tcp',

  /** Relay server URL (configurable) */
  relayServerUrl: 'wss://relay.lama.example.com',
};
