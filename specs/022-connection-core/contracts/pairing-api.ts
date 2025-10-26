/**
 * Pairing API Contract
 *
 * Defines interfaces for pairing workflow implementation including state machine,
 * pairing methods, and workflow coordination.
 */

import type { PeerIdentity, VersionedCredential } from './platform-deps';
import type { PairingRequest, PairingState } from './connection-manager';

/**
 * Pairing workflow coordinator
 *
 * Internal service used by ConnectionManager to execute pairing workflows.
 * Platforms do not interact with this directly.
 */
export interface PairingWorkflow {
  /**
   * Initiate pairing with peer using specified method
   *
   * @param peer Peer to pair with
   * @param method Pairing method to use
   * @param credential Own credential to exchange
   * @returns Pairing request to track
   */
  initiate(
    peer: PeerIdentity,
    method: PairingMethodType,
    credential: VersionedCredential
  ): Promise<PairingRequest>;

  /**
   * Handle incoming pairing request
   *
   * @param request Incoming request from peer
   * @returns Promise that resolves when user accepts/rejects
   */
  handleIncomingRequest(request: IncomingPairingRequest): Promise<PairingRequestResult>;

  /**
   * Complete pairing after acceptance
   * Exchanges credentials and establishes trust
   *
   * @param requestId Pairing request ID
   * @returns Peer identity with verified credential
   */
  complete(requestId: string): Promise<PeerIdentity>;

  /**
   * Cancel pairing request
   */
  cancel(requestId: string): void;
}

/**
 * Pairing state machine
 *
 * Manages state transitions for pairing workflow with validation
 */
export interface PairingStateMachine {
  /**
   * Get current state
   */
  getState(requestId: string): PairingState | null;

  /**
   * Transition to new state
   *
   * @throws Error if transition is invalid
   */
  transition(requestId: string, newState: PairingState): void;

  /**
   * Check if state transition is valid
   */
  canTransition(currentState: PairingState, newState: PairingState): boolean;

  /**
   * Register callback for state changes
   */
  onStateChange(requestId: string, callback: (state: PairingState) => void): void;
}

/**
 * Valid state transitions for pairing workflow
 */
export const PAIRING_STATE_TRANSITIONS: Record<PairingState, PairingState[]> = {
  initiated: ['pending', 'timeout'],
  pending: ['accepted', 'rejected', 'timeout'],
  accepted: ['completed', 'timeout'],
  rejected: [], // Terminal state
  timeout: [], // Terminal state
  completed: [], // Terminal state
};

/**
 * Pairing method interface
 *
 * Each pairing method (QR, numeric, proximity) implements this interface
 */
export interface IPairingMethod {
  /** Method type identifier */
  readonly type: PairingMethodType;

  /**
   * Check if this method is available on current platform
   */
  isAvailable(): boolean;

  /**
   * Initiate pairing using this method
   * Returns pairing data to send to peer
   */
  initiate(peer: PeerIdentity, credential: VersionedCredential): Promise<PairingData>;

  /**
   * Handle pairing initiation from peer
   * Returns data to present to user for verification
   */
  receive(data: PairingData): Promise<PairingVerificationUI>;

  /**
   * Verify pairing completion
   * Called after user accepts to confirm trust
   */
  verify(data: PairingData, userInput?: any): Promise<boolean>;
}

export type PairingMethodType = 'qr' | 'numeric' | 'proximity';

/**
 * Pairing data exchanged between peers
 */
export interface PairingData {
  method: PairingMethodType;
  requestId: string;
  initiatorId: string;
  initiatorCredential: VersionedCredential;
  timestamp: number;
  methodSpecificData?: any; // QR code data, numeric code, BLE advertisement, etc.
}

/**
 * Pairing verification UI data
 * Platform uses this to display verification prompt to user
 */
export interface PairingVerificationUI {
  method: PairingMethodType;
  peerName: string;
  peerId: string;
  verificationCode?: string; // For numeric method
  qrCodeData?: string; // For QR method
  proximitySignal?: number; // For proximity method (signal strength)
}

/**
 * Incoming pairing request (received from peer)
 */
export interface IncomingPairingRequest {
  requestId: string;
  initiatorId: string;
  initiatorName: string;
  initiatorCredential: VersionedCredential;
  method: PairingMethodType;
  methodData: any;
  receivedAt: number;
}

/**
 * Result of pairing request handling
 */
export interface PairingRequestResult {
  accepted: boolean;
  requestId: string;
  peerCredential?: VersionedCredential; // Present if accepted
  rejectionReason?: string; // Present if rejected
}

/**
 * QR Code pairing method
 */
export interface QRCodePairingMethod extends IPairingMethod {
  type: 'qr';

  /**
   * Generate QR code data for initiator
   * Returns QR code string to display/transmit
   */
  generateQRCode(peer: PeerIdentity, credential: VersionedCredential): Promise<string>;

  /**
   * Parse QR code data from peer
   */
  parseQRCode(qrData: string): Promise<PairingData>;
}

/**
 * Numeric code pairing method
 */
export interface NumericCodePairingMethod extends IPairingMethod {
  type: 'numeric';

  /**
   * Generate numeric verification code (6-8 digits)
   */
  generateCode(peer: PeerIdentity, credential: VersionedCredential): Promise<string>;

  /**
   * Verify user-entered code matches expected code
   */
  verifyCode(expectedCode: string, userCode: string): boolean;
}

/**
 * Proximity-based pairing method (Bluetooth/NFC)
 */
export interface ProximityPairingMethod extends IPairingMethod {
  type: 'proximity';

  /**
   * Start broadcasting presence for proximity detection
   */
  startBroadcast(credential: VersionedCredential): Promise<void>;

  /**
   * Stop broadcasting
   */
  stopBroadcast(): void;

  /**
   * Scan for nearby devices
   * @param timeout Scan timeout in ms
   */
  scan(timeout: number): Promise<PeerIdentity[]>;

  /**
   * Get signal strength to peer (for proximity verification)
   */
  getSignalStrength(peerId: string): number;
}

/**
 * Pairing timeout configuration
 */
export interface PairingTimeoutConfig {
  /** Request expiration timeout (default: 60000ms) */
  requestTimeout: number;

  /** Credential exchange timeout (default: 10000ms) */
  exchangeTimeout: number;

  /** Verification timeout (default: 30000ms) */
  verificationTimeout: number;
}

export const DEFAULT_PAIRING_TIMEOUT: PairingTimeoutConfig = {
  requestTimeout: 60000, // 60 seconds
  exchangeTimeout: 10000, // 10 seconds
  verificationTimeout: 30000, // 30 seconds
};
