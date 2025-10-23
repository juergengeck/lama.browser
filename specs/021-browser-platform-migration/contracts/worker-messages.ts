/**
 * Worker Message Protocol Contracts
 *
 * TypeScript type definitions for UI ↔ Worker communication.
 * These types are shared between the main thread and Web Worker.
 */

import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js'
import type { Person, Topic, Message, Contact } from '@refinio/one.core/lib/recipes.js'

// ============================================================================
// Base Message Protocol
// ============================================================================

/**
 * Request from UI thread to Worker
 */
export interface WorkerRequest<T = unknown> {
  /** UUID for request/response correlation */
  id: string

  /** Message type in format 'namespace:action' */
  type: string

  /** Type-specific request payload */
  payload: T

  /** Request creation timestamp */
  timestamp: number

  /** Optional transferable objects for zero-copy transfer */
  transferables?: Transferable[]
}

/**
 * Response from Worker to UI thread
 */
export interface WorkerResponse<T = unknown> {
  /** UUID matching the request ID */
  id: string

  /** Operation success indicator */
  success: boolean

  /** Response data (if successful) */
  data?: T

  /** Error details (if failed) */
  error?: WorkerError

  /** Response creation timestamp */
  timestamp: number

  /** Optional transferable objects for zero-copy transfer */
  transferables?: Transferable[]
}

/**
 * Standard error structure for failed operations
 */
export interface WorkerError {
  /** Machine-readable error code */
  code: WorkerErrorCode

  /** Human-readable error message */
  message: string

  /** Additional error context */
  details?: unknown

  /** Stack trace (development mode only) */
  stack?: string
}

/**
 * Standard error codes
 */
export type WorkerErrorCode =
  | 'WORKER_NOT_INITIALIZED'
  | 'ONECORE_NOT_INITIALIZED'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'INVALID_PAYLOAD'
  | 'HANDLER_TIMEOUT'
  | 'HANDLER_NOT_FOUND'
  | 'OPERATION_FAILED'
  | 'NETWORK_ERROR'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED_BROWSER'

// ============================================================================
// Worker State
// ============================================================================

/**
 * Worker initialization phases
 */
export enum WorkerInitPhase {
  NOT_STARTED = 'not_started',
  LOADING = 'loading',
  INITIALIZING = 'initializing',
  READY = 'ready',
  ERROR = 'error'
}

/**
 * Worker initialization state
 */
export interface WorkerInitState {
  /** Current initialization phase */
  phase: WorkerInitPhase

  /** Progress percentage (0-100) for long operations */
  progress?: number

  /** Human-readable description of current operation */
  message?: string

  /** Error details if phase is ERROR */
  error?: WorkerError

  /** Initialization start timestamp */
  startTime: number

  /** Timestamp when worker became ready */
  readyTime?: number
}

// ============================================================================
// Storage State
// ============================================================================

/**
 * Storage warning severity levels
 */
export enum StorageWarningLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

/**
 * Storage quota warning
 */
export interface StorageWarning {
  /** Warning severity */
  level: StorageWarningLevel

  /** Human-readable warning message */
  message: string

  /** Usage percentage that triggered warning */
  threshold: number

  /** Warning creation timestamp */
  timestamp: number
}

/**
 * Browser storage state
 */
export interface StorageState {
  /** Total storage quota in bytes */
  quota: number

  /** Current storage usage in bytes */
  usage: number

  /** Usage as percentage (0-100) */
  percentage: number

  /** Available bytes remaining */
  available: number

  /** Is storage persistent (survives eviction)? */
  persistent: boolean

  /** Last check timestamp */
  lastChecked: number

  /** Active storage warnings */
  warnings: StorageWarning[]
}

// ============================================================================
// Core Operations
// ============================================================================

export namespace CoreMessages {
  /**
   * Initialize ONE.core instance
   */
  export interface InitializeRequest {
    credentials: {
      email: string
      password: string
    }
  }

  export interface InitializeResponse {
    success: boolean
    personId: SHA256IdHash<Person>
  }

  /**
   * Get worker and ONE.core status
   */
  export interface GetStatusRequest {
    // No parameters
  }

  export interface GetStatusResponse {
    initialized: boolean
    personId?: SHA256IdHash<Person>
    storageState: StorageState
    initState: WorkerInitState
  }

  /**
   * Get all contacts
   */
  export interface GetContactsRequest {
    // No parameters
  }

  export interface GetContactsResponse {
    contacts: Contact[]
  }

  /**
   * Create new contact
   */
  export interface CreateContactRequest {
    email: string
    name: string
    publicKey: string
  }

  export interface CreateContactResponse {
    contact: Contact
    idHash: SHA256IdHash<Contact>
  }
}

// ============================================================================
// Chat Operations
// ============================================================================

export namespace ChatMessages {
  /**
   * Get all conversation topics
   */
  export interface GetTopicsRequest {
    // No parameters
  }

  export interface GetTopicsResponse {
    topics: Topic[]
  }

  /**
   * Get messages for a topic
   */
  export interface GetMessagesRequest {
    topicId: string
    limit?: number
    before?: number  // Timestamp
  }

  export interface GetMessagesResponse {
    messages: Message[]
    hasMore: boolean
  }

  /**
   * Send message in conversation
   */
  export interface SendMessageRequest {
    topicId: string
    content: string
    attachments?: ArrayBuffer[]  // Use transferables
  }

  export interface SendMessageResponse {
    message: Message
    messageHash: SHA256Hash<Message>
  }

  /**
   * Create new conversation topic
   */
  export interface CreateTopicRequest {
    name: string
    participantIds: SHA256IdHash<Person>[]
  }

  export interface CreateTopicResponse {
    topic: Topic
    topicIdHash: SHA256IdHash<Topic>
  }
}

// ============================================================================
// AI Operations
// ============================================================================

export namespace AIMessages {
  export interface AIMessage {
    role: 'user' | 'assistant' | 'system'
    content: string
  }

  export interface LLMInfo {
    id: string
    name: string
    provider: string
    capabilities: string[]
  }

  /**
   * Send message to AI assistant
   */
  export interface ChatRequest {
    messages: AIMessage[]
    model?: string
    stream?: boolean
  }

  export interface ChatResponse {
    response: string
    analysis?: {
      subjects: Array<{ name: string; keywords: string[] }>
      keywords: Array<{ term: string; confidence: number }>
    }
  }

  /**
   * Get available AI models
   */
  export interface GetModelsRequest {
    // No parameters
  }

  export interface GetModelsResponse {
    models: LLMInfo[]
  }
}

// ============================================================================
// Topic Analysis Operations
// ============================================================================

export namespace TopicAnalysisMessages {
  export interface Subject {
    name: string
    description: string
    keywords: string[]
    created: number
  }

  export interface Keyword {
    term: string
    confidence: number
    subjects: string[]  // Subject names
  }

  export interface Summary {
    content: string
    version: number
    subjects: string[]  // Subject names
    updated: number
  }

  /**
   * Analyze messages to extract subjects and keywords
   */
  export interface AnalyzeMessagesRequest {
    topicId: string
    messageIds: SHA256Hash<Message>[]
  }

  export interface AnalyzeMessagesResponse {
    subjects: Subject[]
    keywords: Keyword[]
  }

  /**
   * Get topic summary
   */
  export interface GetSummaryRequest {
    topicId: string
    version?: number  // Specific version or latest
  }

  export interface GetSummaryResponse {
    summary: Summary
  }
}

// ============================================================================
// Proposal Operations
// ============================================================================

export namespace ProposalMessages {
  export interface Proposal {
    pastSubject: {
      name: string
      idHash: SHA256IdHash<any>
    }
    currentSubject: {
      name: string
      idHash: SHA256IdHash<any>
    }
    matchedKeywords: string[]
    relevanceScore: number
    sourceTopicId: string
    createdAt: number
  }

  /**
   * Get proposals for current topic
   */
  export interface GetForTopicRequest {
    topicId: string
  }

  export interface GetForTopicResponse {
    proposals: Proposal[]
  }

  /**
   * Dismiss a proposal for current session
   */
  export interface DismissRequest {
    topicId: string
    pastSubjectIdHash: SHA256IdHash<any>
  }

  export interface DismissResponse {
    success: boolean
  }
}

// ============================================================================
// Storage Operations
// ============================================================================

export namespace StorageMessages {
  /**
   * Get current storage quota state
   */
  export interface GetQuotaRequest {
    // No parameters
  }

  export interface GetQuotaResponse {
    state: StorageState
  }

  /**
   * Request persistent storage permission
   */
  export interface RequestPersistentRequest {
    // No parameters
  }

  export interface RequestPersistentResponse {
    granted: boolean
  }

  /**
   * Clean up old data to free space
   */
  export interface CleanupRequest {
    olderThan?: number  // Timestamp
    types?: string[]     // Object types to clean
  }

  export interface CleanupResponse {
    freedBytes: number
    deletedObjects: number
  }
}

// ============================================================================
// Message Type Registry
// ============================================================================

/**
 * Union type of all valid message types
 */
export type MessageType =
  // Core
  | 'onecore:initialize'
  | 'onecore:getStatus'
  | 'onecore:getContacts'
  | 'onecore:createContact'
  // Chat
  | 'chat:getTopics'
  | 'chat:getMessages'
  | 'chat:sendMessage'
  | 'chat:createTopic'
  // AI
  | 'ai:chat'
  | 'ai:getModels'
  // Topic Analysis
  | 'topicAnalysis:analyzeMessages'
  | 'topicAnalysis:getSummary'
  // Proposals
  | 'proposals:getForTopic'
  | 'proposals:dismiss'
  // Storage
  | 'storage:getQuota'
  | 'storage:requestPersistent'
  | 'storage:cleanup'

/**
 * Type-safe message type mapping
 */
export interface MessageTypeMap {
  // Core
  'onecore:initialize': { request: CoreMessages.InitializeRequest; response: CoreMessages.InitializeResponse }
  'onecore:getStatus': { request: CoreMessages.GetStatusRequest; response: CoreMessages.GetStatusResponse }
  'onecore:getContacts': { request: CoreMessages.GetContactsRequest; response: CoreMessages.GetContactsResponse }
  'onecore:createContact': { request: CoreMessages.CreateContactRequest; response: CoreMessages.CreateContactResponse }
  // Chat
  'chat:getTopics': { request: ChatMessages.GetTopicsRequest; response: ChatMessages.GetTopicsResponse }
  'chat:getMessages': { request: ChatMessages.GetMessagesRequest; response: ChatMessages.GetMessagesResponse }
  'chat:sendMessage': { request: ChatMessages.SendMessageRequest; response: ChatMessages.SendMessageResponse }
  'chat:createTopic': { request: ChatMessages.CreateTopicRequest; response: ChatMessages.CreateTopicResponse }
  // AI
  'ai:chat': { request: AIMessages.ChatRequest; response: AIMessages.ChatResponse }
  'ai:getModels': { request: AIMessages.GetModelsRequest; response: AIMessages.GetModelsResponse }
  // Topic Analysis
  'topicAnalysis:analyzeMessages': { request: TopicAnalysisMessages.AnalyzeMessagesRequest; response: TopicAnalysisMessages.AnalyzeMessagesResponse }
  'topicAnalysis:getSummary': { request: TopicAnalysisMessages.GetSummaryRequest; response: TopicAnalysisMessages.GetSummaryResponse }
  // Proposals
  'proposals:getForTopic': { request: ProposalMessages.GetForTopicRequest; response: ProposalMessages.GetForTopicResponse }
  'proposals:dismiss': { request: ProposalMessages.DismissRequest; response: ProposalMessages.DismissResponse }
  // Storage
  'storage:getQuota': { request: StorageMessages.GetQuotaRequest; response: StorageMessages.GetQuotaResponse }
  'storage:requestPersistent': { request: StorageMessages.RequestPersistentRequest; response: StorageMessages.RequestPersistentResponse }
  'storage:cleanup': { request: StorageMessages.CleanupRequest; response: StorageMessages.CleanupResponse }
}

/**
 * Type-safe worker request helper
 */
export type TypedWorkerRequest<T extends MessageType> = WorkerRequest<MessageTypeMap[T]['request']>

/**
 * Type-safe worker response helper
 */
export type TypedWorkerResponse<T extends MessageType> = WorkerResponse<MessageTypeMap[T]['response']>
