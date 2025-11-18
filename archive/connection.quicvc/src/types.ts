/**
 * Type definitions for QUICVC connection management
 *
 * These types must be injected by the consumer of this package:
 * - QuicModel: Transport layer abstraction
 * - VCManager: Verifiable Credential validation
 * - VerifiedVCInfo: Verified credential information
 * - DeviceIdentityCredential: Device identity credential structure
 * - NetworkServiceType: Service type enumeration
 * - IQuicTransport: Transport interface
 * - QUIC Protocol types: QuicPacketType, QuicFrameType, QuicVCFrameType, etc.
 *
 * Note: The quicvc-protocol module imports are currently commented out as they
 * need to be provided separately or created in one.core
 */

// Placeholder exports for quicvc-protocol types (to be provided by consumer)
export type QuicPacketType = any;
export type QuicFrameType = any;
export type QuicVCFrameType = any;
export type QuicLongHeader = any;
export type QuicShortHeader = any;
export type VCInitFrame = any;
export type VCResponseFrame = any;
export type StreamFrame = any;
export type DiscoveryFrame = any;
export type HeartbeatFrame = any;
export type BuildLongHeaderPacket = any;
export type BuildShortHeaderPacket = any;
export type ParsePacketHeader = any;
export type ParseFrame = any;
export type DecodeVarint = any;
export type EncodeVarint = any;

// QUICVC packet types
export enum QuicVCPacketType {
    INITIAL = 0x00,      // Contains VC_INIT frame
    HANDSHAKE = 0x01,    // Contains VC_RESPONSE frame
    PROTECTED = 0x02,    // Regular data packets (encrypted)
    RETRY = 0x03         // Retry with different parameters
}

export interface QuicVCPacketHeader {
    type: QuicVCPacketType;
    version: number;
    dcid: Uint8Array;    // Destination Connection ID
    scid: Uint8Array;    // Source Connection ID
    packetNumber: bigint;
    headerLength?: number; // Total header length in bytes (for proper payload extraction)
}

export interface CryptoKeys {
    encryptionKey: Uint8Array;
    decryptionKey: Uint8Array;
    sendIV: Uint8Array;
    receiveIV: Uint8Array;
    sendHMAC: Uint8Array;
    receiveHMAC: Uint8Array;
}

export interface QuicVCConnection {
    // Connection identifiers
    deviceId: string;
    dcid: Uint8Array;
    scid: Uint8Array;

    // Network info
    address: string;
    port: number;

    // Connection state
    state: 'initial' | 'handshake' | 'established' | 'closed';
    isServer: boolean;

    // Packet tracking
    nextPacketNumber: bigint;
    highestReceivedPacket: bigint;
    ackQueue: bigint[];

    // Credentials (injected types)
    localVC: any | null;  // DeviceIdentityCredential
    remoteVC: any | null; // VerifiedVCInfo
    challenge: string;    // For mutual authentication

    // Crypto state
    initialKeys: CryptoKeys | null;
    handshakeKeys: CryptoKeys | null;
    applicationKeys: CryptoKeys | null;
    sessionKey: Uint8Array | null;  // ESP32-style session key for XOR encryption

    // Service type handlers (embedded in STREAM frames)
    serviceHandlers: Map<number, (data: Uint8Array, deviceId: string) => void>;

    // Timers
    handshakeTimeout: NodeJS.Timeout | null;
    heartbeatInterval: NodeJS.Timeout | null;
    idleTimeout: NodeJS.Timeout | null;

    // Metadata
    createdAt: number;
    lastActivity: number;
}

// Injected dependency interfaces - must be provided by consumer
export interface IQuicTransport {
    send(data: Uint8Array, address: string, port: number): Promise<void>;
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
}

export interface QuicModel {
    send(data: Uint8Array, address: string, port: number): Promise<void>;
    isInitialized(): boolean;
}

// QuicModel constructor/factory interface
export interface QuicModelStatic {
    getInstance(): QuicModel;
    new (): QuicModel;
}

export interface VerifiedVCInfo {
    credential: any;
    verified: boolean;
    deviceId?: string;
    [key: string]: any;
}

export interface VCManager {
    verifyCredential(credential: any, challenge?: string): Promise<VerifiedVCInfo>;
    [key: string]: any;
}

export interface DeviceIdentityCredential {
    $type$: string;
    credentialSubject: {
        id: string;
        [key: string]: any;
    };
    [key: string]: any;
}

export enum NetworkServiceType {
    DISCOVERY = 0x01,
    CHAT = 0x02,
    FILE_TRANSFER = 0x03,
    LED_CONTROL = 0x04,
    OWNERSHIP_REMOVAL = 0x05
}
