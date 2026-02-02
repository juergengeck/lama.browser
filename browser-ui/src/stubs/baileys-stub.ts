// Stub for @whiskeysockets/baileys - Node.js only WhatsApp library
// This is required because chat.baileys references it but it cannot run in browsers

export default {}

// BaileysClient.ts imports
export const makeWASocket = () => { throw new Error('baileys not available in browser') }
export const DisconnectReason = {}
export const fetchLatestBaileysVersion = async () => ({ version: [0, 0, 0], isLatest: true })
export const makeCacheableSignalKeyStore = () => ({})
export const useMultiFileAuthState = async () => ({ state: {}, saveCreds: () => {} })

// BaileysAuthService.ts imports
export const initAuthCreds = () => ({})

// Type stubs (for type imports that get compiled away but may leak at runtime)
export type ConnectionState = unknown
export type WASocket = unknown
export type proto = unknown
export type BaileysEventMap = unknown
export type AuthenticationCreds = unknown
