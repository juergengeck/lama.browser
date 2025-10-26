/**
 * ConnectionManager API Contract
 *
 * Main orchestrator for all connection operations in connection.core.
 * This is the primary interface platforms interact with.
 */

import type { OneCoreInstance } from '@refinio/one.core';
import type {
  PlatformDependencies,
  PeerIdentity,
  ConnectionStateValue,
} from './platform-deps';

/**
 * ConnectionManager - Main entry point for connection.core
 *
 * Orchestrates pairing, discovery, connection establishment, and lifecycle management.
 * Platforms instantiate this with their specific dependencies.
 *
 * @example
 * ```typescript
 * // Browser platform integration
 * const manager = new ConnectionManager(oneCore, {
 *   transport: new BrowserTransportFactory(),
 *   storage: new IndexedDBStorage(),
 *   ui: new BrowserUICallbacks(),
 *   oneCore: oneCoreInstance
 * });
 *
 * // Discover peers
 * const peers = await manager.discoverPeers();
 *
 * // Initiate pairing
 * const request = await manager.initiatePairing(peers[0].id);
 *
 * // Connect after pairing accepted
 * const connection = await manager.connect(peers[0].id);
 * ```
 */
export interface ConnectionManager {
  // ===== Lifecycle =====

  /**
   * Initialize the connection manager
   * Sets up discovery services, credential verifier, reconnection manager
   *
   * @throws Error if dependencies are invalid or missing
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the connection manager
   * Closes all connections, stops discovery, cancels reconnections
   */
  shutdown(): Promise<void>;

  // ===== Discovery =====

  /**
   * Discover available peers on local network and via relay
   *
   * @param options Discovery options
   * @returns List of discovered peers
   */
  discoverPeers(options?: DiscoveryOptions): Promise<PeerIdentity[]>;

  /**
   * Start continuous peer discovery
   * Emits 'peerDiscovered' events as peers are found
   */
  startDiscovery(options?: DiscoveryOptions): void;

  /**
   * Stop continuous peer discovery
   */
  stopDiscovery(): void;

  /**
   * Get list of currently discovered peers
   */
  getDiscoveredPeers(): PeerIdentity[];

  // ===== Pairing =====

  /**
   * Initiate pairing with a discovered peer
   *
   * @param peerId ID of peer to pair with
   * @param method Optional pairing method (if not specified, platform will choose)
   * @returns Pairing request (track state via events)
   * @throws Error if peer not found or already paired
   */
  initiatePairing(peerId: string, method?: 'qr' | 'numeric' | 'proximity'): Promise<PairingRequest>;

  /**
   * Accept an incoming pairing request
   *
   * @param requestId ID of pairing request
   * @returns Established connection
   * @throws Error if request not found or expired
   */
  acceptPairing(requestId: string): Promise<Connection>;

  /**
   * Reject an incoming pairing request
   *
   * @param requestId ID of pairing request
   */
  rejectPairing(requestId: string): void;

  /**
   * Get list of pending pairing requests
   */
  getPendingPairingRequests(): PairingRequest[];

  // ===== Connections =====

  /**
   * Connect to a previously paired peer
   *
   * @param peerId ID of peer to connect to
   * @returns Established connection
   * @throws Error if peer not paired or connection fails
   */
  connect(peerId: string): Promise<Connection>;

  /**
   * Disconnect from a peer
   *
   * @param peerId ID of peer to disconnect from
   */
  disconnect(peerId: string): void;

  /**
   * Get connection to peer (if exists)
   *
   * @returns Connection or null if not connected
   */
  getConnection(peerId: string): Connection | null;

  /**
   * Get list of all active connections
   */
  getConnections(): Connection[];

  /**
   * Check if connected to peer
   */
  isConnected(peerId: string): boolean;

  // ===== Group Connections =====

  /**
   * Create a group connection with multiple peers
   * Establishes full mesh topology (all peers connected to all peers)
   *
   * @param groupId Unique group identifier
   * @param peerIds List of peer IDs to include in group (must all be paired)
   * @returns Group connection
   * @throws Error if any peer not paired or connection fails
   */
  createGroupConnection(groupId: string, peerIds: string[]): Promise<GroupConnection>;

  /**
   * Join an existing group connection
   * Discovers existing members and establishes connections
   *
   * @param groupId Group identifier
   * @returns Group connection
   */
  joinGroupConnection(groupId: string): Promise<GroupConnection>;

  /**
   * Get group connection (if exists)
   */
  getGroupConnection(groupId: string): GroupConnection | null;

  /**
   * Leave a group connection
   * Closes all connections to group members
   */
  leaveGroupConnection(groupId: string): void;

  // ===== Events =====

  /**
   * Register event listener
   */
  on(event: ConnectionManagerEvent, callback: (...args: any[]) => void): void;

  /**
   * Unregister event listener
   */
  off(event: ConnectionManagerEvent, callback: (...args: any[]) => void): void;
}

/**
 * Discovery options
 */
export interface DiscoveryOptions {
  /** Discovery methods to use */
  methods?: ('local' | 'relay')[];

  /** Filter by required capabilities */
  requiredCapabilities?: string[];

  /** Timeout in milliseconds (default: 5000 for relay, 2000 for local) */
  timeout?: number;
}

/**
 * Pairing request state
 */
export interface PairingRequest {
  id: string;
  initiatorId: string;
  targetId: string;
  state: PairingState;
  method: 'qr' | 'numeric' | 'proximity';
  verificationCode?: string; // Present if method is 'numeric'
  createdAt: number;
  expiresAt: number;
}

export type PairingState = 'initiated' | 'pending' | 'accepted' | 'rejected' | 'timeout' | 'completed';

/**
 * Active P2P connection to a peer
 */
export interface Connection {
  id: string;
  peerId: string;
  state: ConnectionStateValue;
  transportType: 'quicvc' | 'websocket';
  establishedAt: number;
  lastActivityAt: number;
  metadata?: ConnectionMetadata;

  /**
   * Send data to peer
   * @throws Error if not connected
   */
  send(data: Uint8Array): Promise<void>;

  /**
   * Close connection
   */
  close(): void;

  /**
   * Check if connection is alive
   */
  isAlive(): boolean;

  /**
   * Register data receive callback
   */
  onReceive(callback: (data: Uint8Array) => void): void;

  /**
   * Register state change callback
   */
  onStateChange(callback: (state: ConnectionStateValue) => void): void;
}

export interface ConnectionMetadata {
  latency?: number; // Round-trip time in ms
  throughput?: number; // Bytes per second
  errorCount?: number; // Number of errors encountered
}

/**
 * Group connection (full mesh topology)
 */
export interface GroupConnection {
  groupId: string;
  memberIds: string[]; // Includes self
  topology: 'mesh';
  createdAt: number;

  /**
   * Add new member to group
   * Establishes connection to new member and notifies existing members
   */
  addMember(peerId: string): Promise<void>;

  /**
   * Remove member from group
   */
  removeMember(peerId: string): void;

  /**
   * Broadcast data to all connected members
   */
  broadcast(data: Uint8Array): Promise<void>;

  /**
   * Get connection status for specific member
   */
  getMemberStatus(peerId: string): 'connected' | 'disconnected' | 'connecting';

  /**
   * Get list of currently connected members
   */
  getConnectedMembers(): string[];

  /**
   * Get connection to specific member
   */
  getMemberConnection(peerId: string): Connection | null;

  /**
   * Register callback for member state changes
   */
  onMemberStateChange(callback: (peerId: string, state: string) => void): void;
}

/**
 * ConnectionManager events
 */
export type ConnectionManagerEvent =
  | 'initialized'
  | 'shutdown'
  | 'peerDiscovered'
  | 'pairingRequestReceived'
  | 'pairingAccepted'
  | 'pairingRejected'
  | 'connectionEstablished'
  | 'connectionClosed'
  | 'connectionError'
  | 'groupMemberJoined'
  | 'groupMemberLeft'
  | 'error';
