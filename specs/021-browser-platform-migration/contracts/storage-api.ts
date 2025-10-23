/**
 * Browser Storage API Contracts
 *
 * TypeScript interfaces for ONE.core browser storage abstraction.
 * These define the expected API surface provided by ONE.core's browser platform.
 */

import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js'

// ============================================================================
// Storage Interface (ONE.core Browser Platform)
// ============================================================================

/**
 * ONE.core browser storage configuration
 */
export interface BrowserStorageConfig {
  /** Database name (default: 'one-core') */
  name?: string

  /** IndexedDB version (default: 1) */
  version?: number

  /** Enable relaxed durability for performance (default: true) */
  relaxedDurability?: boolean

  /** Enable encryption for PRIVATE store (default: false) */
  encryption?: boolean

  /** Encryption key (required if encryption enabled) */
  encryptionKey?: CryptoKey
}

/**
 * IndexedDB object stores used by ONE.core
 */
export enum ObjectStore {
  /** Versioned objects and unversioned objects */
  OBJECTS = 'objects',

  /** Version heads (latest version pointers) */
  VHEADS = 'vheads',

  /** Reverse maps (ID hash → object hashes) */
  RMAPS = 'rmaps',

  /** Private/encrypted data (always encrypted regardless of config) */
  PRIVATE = 'private'
}

/**
 * Storage operation result
 */
export interface StorageResult<T = unknown> {
  /** Operation success indicator */
  success: boolean

  /** Result data (if successful) */
  data?: T

  /** Error message (if failed) */
  error?: string
}

/**
 * Object metadata for storage operations
 */
export interface ObjectMetadata {
  /** Object hash */
  hash: SHA256Hash<any>

  /** Object type (e.g., 'Message', 'Topic') */
  type: string

  /** Creation timestamp */
  created: number

  /** Object size in bytes */
  size: number

  /** Is this a versioned object? */
  versioned: boolean

  /** ID hash (if versioned) */
  idHash?: SHA256IdHash<any>
}

// ============================================================================
// Storage Operations Interface
// ============================================================================

/**
 * Browser storage abstraction interface
 * (Implementation provided by ONE.core browser platform)
 */
export interface BrowserStorage {
  /**
   * Initialize the storage system
   */
  init(config: BrowserStorageConfig): Promise<void>

  /**
   * Store an object
   */
  storeObject(
    hash: SHA256Hash<any>,
    data: unknown,
    metadata: Partial<ObjectMetadata>
  ): Promise<StorageResult<void>>

  /**
   * Retrieve an object by hash
   */
  getObject<T = unknown>(hash: SHA256Hash<T>): Promise<StorageResult<T>>

  /**
   * Delete an object
   */
  deleteObject(hash: SHA256Hash<any>): Promise<StorageResult<void>>

  /**
   * Check if object exists
   */
  hasObject(hash: SHA256Hash<any>): Promise<boolean>

  /**
   * Get all objects of a specific type
   */
  getObjectsByType<T = unknown>(type: string): Promise<StorageResult<T[]>>

  /**
   * Store version head (latest version pointer)
   */
  storeVersionHead(
    idHash: SHA256IdHash<any>,
    versionHash: SHA256Hash<any>
  ): Promise<StorageResult<void>>

  /**
   * Get version head (latest version)
   */
  getVersionHead(idHash: SHA256IdHash<any>): Promise<StorageResult<SHA256Hash<any>>>

  /**
   * Store reverse map entry (ID hash → object hash)
   */
  storeReverseMap(
    idHash: SHA256IdHash<any>,
    objectHash: SHA256Hash<any>
  ): Promise<StorageResult<void>>

  /**
   * Get reverse map entries
   */
  getReverseMap(idHash: SHA256IdHash<any>): Promise<StorageResult<SHA256Hash<any>[]>>

  /**
   * Get storage statistics
   */
  getStats(): Promise<StorageStats>

  /**
   * Cleanup old objects
   */
  cleanup(options: CleanupOptions): Promise<CleanupResult>

  /**
   * Close storage connections
   */
  close(): Promise<void>
}

// ============================================================================
// Storage Statistics
// ============================================================================

/**
 * Storage usage statistics
 */
export interface StorageStats {
  /** Total objects stored */
  totalObjects: number

  /** Objects by type */
  objectsByType: Record<string, number>

  /** Total storage used (bytes) */
  totalBytes: number

  /** Bytes by store */
  bytesByStore: Record<ObjectStore, number>

  /** Versioned objects count */
  versionedObjects: number

  /** Version heads count */
  versionHeads: number

  /** Reverse map entries count */
  reverseMapEntries: number

  /** Last cleanup timestamp */
  lastCleanup?: number
}

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * Cleanup operation options
 */
export interface CleanupOptions {
  /** Delete objects older than this timestamp */
  olderThan?: number

  /** Object types to clean (default: all) */
  types?: string[]

  /** Maximum objects to delete in one operation */
  limit?: number

  /** Perform dry run (don't actually delete) */
  dryRun?: boolean

  /** Delete orphaned version nodes */
  cleanupOrphans?: boolean
}

/**
 * Cleanup operation result
 */
export interface CleanupResult {
  /** Number of objects deleted */
  deletedObjects: number

  /** Bytes freed */
  freedBytes: number

  /** Objects deleted by type */
  deletedByType: Record<string, number>

  /** Orphaned version nodes cleaned */
  cleanedOrphans?: number

  /** Operation duration (ms) */
  duration: number
}

// ============================================================================
// Quota Management
// ============================================================================

/**
 * Storage quota information
 */
export interface QuotaInfo {
  /** Total quota in bytes */
  quota: number

  /** Current usage in bytes */
  usage: number

  /** Available bytes */
  available: number

  /** Usage percentage (0-100) */
  percentage: number

  /** Is storage persistent? */
  persistent: boolean
}

/**
 * Quota manager interface
 */
export interface QuotaManager {
  /**
   * Get current quota information
   */
  getQuota(): Promise<QuotaInfo>

  /**
   * Request persistent storage
   */
  requestPersistent(): Promise<boolean>

  /**
   * Estimate storage usage for data
   */
  estimate(data: unknown): number

  /**
   * Check if there's enough space for data
   */
  hasSpace(requiredBytes: number): Promise<boolean>

  /**
   * Set quota warning thresholds
   */
  setWarningThresholds(warning: number, critical: number): void

  /**
   * Subscribe to quota warnings
   */
  onWarning(callback: (info: QuotaInfo) => void): () => void
}

// ============================================================================
// Transaction Interface
// ============================================================================

/**
 * Storage transaction options
 */
export interface TransactionOptions {
  /** Object stores to access */
  stores: ObjectStore[]

  /** Transaction mode */
  mode: 'readonly' | 'readwrite'

  /** Relaxed durability (faster, less durable) */
  relaxedDurability?: boolean
}

/**
 * Storage transaction interface
 */
export interface StorageTransaction {
  /**
   * Get object store
   */
  getStore(store: ObjectStore): IDBObjectStore

  /**
   * Commit transaction
   */
  commit(): Promise<void>

  /**
   * Abort transaction
   */
  abort(): void

  /**
   * Transaction completion promise
   */
  done: Promise<void>
}

// ============================================================================
// Browser Compatibility
// ============================================================================

/**
 * Browser capability detection
 */
export interface BrowserCapabilities {
  /** IndexedDB available */
  indexedDB: boolean

  /** WebWorker available */
  webWorker: boolean

  /** WebSocket available */
  webSocket: boolean

  /** WebCrypto available */
  webCrypto: boolean

  /** Storage persistence available */
  storagePersistence: boolean

  /** Estimated quota support */
  quotaEstimate: boolean

  /** Transferable objects support */
  transferables: boolean

  /** Relaxed durability support */
  relaxedDurability: boolean
}

/**
 * Detect browser capabilities
 */
export function detectCapabilities(): BrowserCapabilities {
  return {
    indexedDB: typeof indexedDB !== 'undefined',
    webWorker: typeof Worker !== 'undefined',
    webSocket: typeof WebSocket !== 'undefined',
    webCrypto: typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined',
    storagePersistence: navigator?.storage?.persist !== undefined,
    quotaEstimate: navigator?.storage?.estimate !== undefined,
    transferables: typeof ArrayBuffer !== 'undefined',
    relaxedDurability:
      typeof IDBTransaction !== 'undefined' &&
      'commit' in IDBTransaction.prototype
  }
}

/**
 * Check if all required capabilities are available
 */
export function checkRequiredCapabilities(): {
  supported: boolean
  missing: string[]
} {
  const caps = detectCapabilities()
  const required: Array<keyof BrowserCapabilities> = [
    'indexedDB',
    'webWorker',
    'webSocket',
    'webCrypto'
  ]

  const missing = required.filter(cap => !caps[cap])

  return {
    supported: missing.length === 0,
    missing
  }
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Storage error codes
 */
export enum StorageErrorCode {
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  OBJECT_NOT_FOUND = 'OBJECT_NOT_FOUND',
  TRANSACTION_ABORTED = 'TRANSACTION_ABORTED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  INVALID_DATA = 'INVALID_DATA',
  NOT_INITIALIZED = 'NOT_INITIALIZED'
}

/**
 * Storage error
 */
export class StorageError extends Error {
  constructor(
    public code: StorageErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'StorageError'
  }
}
