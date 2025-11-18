/**
 * @lama/connection.quicvc
 *
 * QUIC with Verifiable Credentials - secure P2P connection protocol
 *
 * This package implements the QUICVC protocol, which replaces TLS with
 * Verifiable Credentials for authentication in QUIC connections.
 */

// Export the main connection manager
export { QuicVCConnectionManager } from './QuicVCConnectionManager.js';

// Export all types
export type {
    QuicVCConnection,
    QuicVCPacketHeader,
    CryptoKeys,
    IQuicTransport,
    QuicModel,
    VCManager,
    VerifiedVCInfo,
    DeviceIdentityCredential
} from './types.js';

export {
    QuicVCPacketType,
    NetworkServiceType
} from './types.js';
