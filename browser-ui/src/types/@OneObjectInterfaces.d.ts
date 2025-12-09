/* eslint-disable @typescript-eslint/no-empty-interface */

/**
 * Browser Platform Type Declarations for ONE.core Objects
 *
 * This file extends the @OneObjectInterfaces ambient module with types from:
 * - chat.core (Topic, Group, Message, etc.)
 * - lama.core (Subject, Keyword, Summary, LLM, etc.)
 *
 * Following ONE.core's declaration merging pattern - see:
 * - /lama.core/packages/one.core/@OneObjectInterfaces.d.ts
 * - /lama.core/packages/one.core/README.md (TypeScript support section)
 */

import type { SHA256IdHash, SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { Story, Assembly, Plan } from '@assembly/core';
import type { DimensionState, DimensionStateReference } from '@cube/core';

declare module '@OneObjectInterfaces' {
    // ============================================================================
    // UNVERSIONED OBJECT INTERFACES
    // ============================================================================

    export interface OneUnversionedObjectInterfaces {
        // Dimension State Persistence (cube.core)
        DimensionState: DimensionState;
    }

    // ============================================================================
    // VERSIONED OBJECT INTERFACES
    // ============================================================================

    export interface OneVersionedObjectInterfaces {
        // Dimension State Persistence (cube.core)
        DimensionStateReference: DimensionStateReference;
        // Topic Analysis (lama.core/one.ai)
        Subject: Subject;
        Keyword: Keyword;
        Summary: Summary;
        WordCloudSettings: WordCloudSettings;

        // AI & LLM Management (lama.core)
        AI: AI;
        LLM: LLM;
        GlobalLLMSettings: GlobalLLMSettings;
        SystemPromptTemplate: SystemPromptTemplate;

        // Message Verification (lama.core)
        MessageAssertion: MessageAssertion;
        XMLMessageAttachment: XMLMessageAttachment;

        // MCP Integration (lama.core)
        MCPServer: MCPServer;
        MCPServerConfig: MCPServerConfig;

        // Proposals (lama.core)
        ProposalConfig: ProposalConfig;

        // UI Preferences (lama.core)
        AvatarPreference: AvatarPreference;

        // Message Read Status (browser-ui)
        MessageReadStatus: MessageReadStatus;

        // Subscription Management (trust.core)
        SubscriptionBalance: SubscriptionBalance;

        // Assembly Tracking (assembly.core)
        Plan: Plan;
        Story: Story;
        Assembly: Assembly;
    }

    // ============================================================================
    // ID OBJECT INTERFACES (for getObjectByIdHash retrieval)
    // ============================================================================

    export interface OneIdObjectInterfaces {
        // Dimension State Persistence (cube.core)
        DimensionStateReference: Pick<DimensionStateReference, '$type$' | 'dimensionName'>;

        AI: Pick<AI, '$type$' | 'aiId'>;
        LLM: Pick<LLM, '$type$' | 'name' | 'server'>;
        GlobalLLMSettings: Pick<GlobalLLMSettings, '$type$' | 'name'>;
        SystemPromptTemplate: Pick<SystemPromptTemplate, '$type$' | 'modelId'>;
        MCPServer: Pick<MCPServer, '$type$' | 'name'>;
        MCPServerConfig: Pick<MCPServerConfig, '$type$' | 'userEmail'>;
        ProposalConfig: Pick<ProposalConfig, '$type$' | 'userEmail'>;
        AvatarPreference: Pick<AvatarPreference, '$type$' | 'personId' | 'name'>;
        MessageReadStatus: Pick<MessageReadStatus, '$type$' | 'conversationId'>;
        Keyword: Keyword;
        SubscriptionBalance: SubscriptionBalance;
        Plan: Plan;
        Story: Story;
        Assembly: Assembly;
    }

    // ============================================================================
    // TYPE DEFINITIONS
    // ============================================================================

    // --- Topic Analysis (one.ai) ---

    /**
     * Subject - A distinct discussion topic within a conversation
     * Identified by keyword combinations (keywords are the ID property in the recipe)
     * ONE.core automatically generates SHA256IdHash<Subject> from sorted keywords
     */
    export interface Subject {
        $type$: 'Subject';
        topic: string; // reference to parent topic (channel ID)
        keywords?: SHA256IdHash<Keyword>[]; // Array of Keyword ID hashes - THIS IS THE ID PROPERTY (isId: true in recipe)
        timeRanges: Array<{
            start: number;
            end: number;
        }>;
        messageCount: number;
        createdAt: number;
        lastSeenAt: number;
        description?: string; // LLM-generated description
        archived?: boolean;
        likes?: number;
        dislikes?: number;
        abstractionLevel?: number; // 1-42 scale
        abstractionMetadata?: {
            calculatedAt: number;
            reasoning?: string;
            parentLevels?: number[];
            childLevels?: number[];
        };
    }

    /**
     * Keyword - Extracted term from message content
     */
    export interface Keyword {
        $type$: 'Keyword';
        term: string; // ID property - normalized keyword term
        frequency: number;
        subjects: string[]; // Array of subject IDs
        score?: number;
        createdAt: number;
        lastSeen: number;
    }

    /**
     * Summary - Versioned summary of a topic conversation
     */
    export interface Summary {
        $type$: 'Summary';
        id: string; // format: ${topicId}-v${version} - ID property
        topic: string; // reference to parent topic
        content: string;
        subjects: string[]; // Subject IDs
        keywords: string[]; // All keywords from all subjects
        version: number;
        previousVersion?: string; // Hash of previous summary
        createdAt: number;
        updatedAt: number;
        changeReason?: string;
        hash?: string;
    }

    /**
     * WordCloudSettings - Visualization preferences
     */
    export interface WordCloudSettings {
        $type$: 'WordCloudSettings';
        creator: string;
        created: number;
        modified: number;
        maxWordsPerSubject: number;
        relatedWordThreshold: number;
        minWordFrequency: number;
        showSummaryKeywords: boolean;
        fontScaleMin: number;
        fontScaleMax: number;
        colorScheme: string;
        layoutDensity: string;
    }

    // --- LLM Management ---

    /**
     * AI - AI assistant identity object
     * References a Person object for the AI's identity
     * Delegates to an LLM Profile for model execution
     */
    export interface AI {
        $type$: 'AI';
        aiId: string; // ID property
        displayName: string;
        personId: SHA256IdHash<Person>; // AI's Person identity
        llmProfileId: SHA256IdHash<Profile>; // Delegates to this LLM Profile (not Person)
        modelId: string;
        owner: SHA256IdHash<Person> | SHA256IdHash<Instance>;
        created: number;
        modified: number;
        active: boolean;
        deleted: boolean;
    }

    /**
     * LLM - Language Learning Model configuration
     */
    export interface LLM {
        $type$: 'LLM';
        name: string; // ID property
        server: string; // ID property - makes LLMs server-specific
        filename: string;
        modelType: 'local' | 'remote';
        active: boolean;
        deleted: boolean;
        creator?: string;
        created: number;
        modified: number;
        createdAt: string;
        lastUsed: string;
        lastInitialized?: number;
        usageCount?: number;
        size?: number;

        // Required LLM identification
        modelId: string;

        // AI contact integration
        personId?: SHA256IdHash<Person>;
        capabilities?: Array<'chat' | 'inference'>;

        // Model parameters
        temperature?: number;
        maxTokens?: number;
        contextSize?: number;
        batchSize?: number;
        threads?: number;
        mirostat?: number;
        topK?: number;
        topP?: number;

        // Optional properties
        architecture?: string;
        contextLength?: number;
        quantization?: string;
        checksum?: string;
        provider?: string;
        downloadUrl?: string;

        // System prompt
        systemPrompt?: string;

        // Network configuration (for remote Ollama)
        baseUrl?: string;
        authType?: 'none' | 'bearer';
        encryptedAuthToken?: string;

        // API key for remote providers (Claude, OpenAI, etc.)
        encryptedApiKey?: string;
    }

    /**
     * GlobalLLMSettings - Global LLM configuration
     */
    export interface GlobalLLMSettings {
        $type$: 'GlobalLLMSettings';
        name: string; // Instance ID - ID property
        defaultProvider: string;
        autoSelectBestModel: boolean;
        preferredModelIds: string[];
        defaultModelId?: string;
        temperature?: number;
        maxTokens?: number;
        systemPrompt?: string;
        streamResponses?: boolean;
        autoSummarize?: boolean;
        enableMCP?: boolean;
    }

    /**
     * SystemPromptTemplate - Per-model system prompts
     */
    export interface SystemPromptTemplate {
        $type$: 'SystemPromptTemplate';
        modelId: string; // ID property - FK to LLM
        promptText: string;
        xmlSchemaVersion: number;
        version: number;
        active: boolean;
        createdAt: number;
        updatedAt: number;
    }

    // --- Message Verification ---

    /**
     * MessageAssertion - Verifiable message credentials
     */
    export interface MessageAssertion {
        $type$: 'MessageAssertion';
        messageId: string;
        messageHash: string;
        text: string;
        timestamp: string;
        sender: string;
        subjects?: string[];
        keywords?: string[];
        version?: number;
        assertedAt: string;
        assertionType: string;
        assertionVersion: string;
    }

    /**
     * XMLMessageAttachment - Stores XML-formatted LLM messages
     */
    export interface XMLMessageAttachment {
        $type$: 'XMLMessageAttachment';
        topicId: string;
        messageId: string;
        xmlContent?: string; // Inline XML if ≤1KB
        xmlBlob?: string; // BLOB hash if >1KB (stored as string)
        format: string; // 'llm-query' | 'llm-response'
        version: number; // Schema version (1)
        createdAt: number; // Unix timestamp
        size: number; // Byte size
    }

    // --- MCP Integration ---

    /**
     * MCPServer - MCP server configuration
     */
    export interface MCPServer {
        $type$: 'MCPServer';
        name: string; // ID property - unique server identifier
        command: string;
        args: string[];
        description: string;
        enabled: boolean;
        createdAt: number;
        updatedAt: number;
    }

    /**
     * MCPServerConfig - User's MCP configuration
     */
    export interface MCPServerConfig {
        $type$: 'MCPServerConfig';
        userEmail: string; // ID property - user identifier
        servers: SHA256IdHash<MCPServer>[];
        updatedAt: number;
    }

    // --- Proposals ---

    /**
     * ProposalConfig - Proposal matching algorithm configuration
     */
    export interface ProposalConfig {
        $type$: 'ProposalConfig';
        userEmail: string; // ID property - user identifier
        matchWeight: number; // 0.0 to 1.0 - weight for keyword match
        recencyWeight: number; // 0.0 to 1.0 - weight for recency
        recencyWindow: number; // milliseconds - time window for recency boost
        minJaccard: number; // 0.0 to 1.0 - minimum Jaccard similarity threshold
        minSimilarity?: number; // 0.0 to 1.0 - semantic similarity threshold (optional)
        maxProposals: number; // 1-50 - maximum proposals to return
        updatedAt: number; // Unix timestamp
    }

    // --- UI Preferences ---

    /**
     * AvatarPreference - Named avatar configuration for a person
     * ID properties: personId + name (name is the avatar ID)
     * Generation tracks versions: each save increments generation
     */
    export interface AvatarPreference {
        $type$: 'AvatarPreference';
        personId: string;   // Person ID (ID property)
        name: string;       // Avatar name - this is the ID (default: "LAMA")

        generation: number; // Version number, starts at 1, increments on save

        // Lama avatar configuration
        lamaConfig?: {
            fell: boolean;      // Fur layer
            hufen: boolean;     // Hooves
            schwanz: boolean;   // Tail
            ohren: boolean;     // Ears
            augen: boolean;     // Eyes
            krawatte: boolean;  // Tie accessory
            hut: boolean;       // Hat accessory
            punk: boolean;      // Mohawk accessory
            // Color overlay configuration
            colorTargets?: Array<'outline' | 'fell' | 'hufen' | 'schwanz' | 'ohren' | 'augen' | 'krawatte' | 'hut' | 'punk'>;  // Parts to color
            overlayColor?: string;  // Color to apply to selected parts
        };

        // Simple color preference (fallback if no lama config)
        color?: string; // Hex color code

        // Optional mood indicator
        mood?: 'happy' | 'sad' | 'angry' | 'calm' | 'excited' | 'tired' | 'focused' | 'neutral';

        createdAt: number;  // Creation timestamp
        updatedAt: number;  // Last update timestamp
    }

    /**
     * MessageReadStatus - Tracks read/unread status of messages in conversations
     * Each status object is owned by a specific user and tracks their read state
     */
    export interface MessageReadStatus {
        $type$: 'MessageReadStatus';
        conversationId: string; // ID property - Conversation/Topic ID
        userId: string; // Owner's Person ID hash
        lastReadMessageHash?: string; // Hash of last read message (undefined if no messages read)
        lastReadTimestamp: number; // Unix timestamp of last read
        unreadCount: number; // Cached unread count for performance
        updatedAt: number; // Last update timestamp
    }

    // --- Subscription Management (trust.core) ---

    /**
     * SubscriptionBalance - User subscription balance tracking
     */
    export interface SubscriptionBalance {
        $type$: 'SubscriptionBalance';
        userId: SHA256IdHash<Person>; // ID property - user's Person ID
        balance: number; // Current balance in EUR
        totalDeposited: number; // Total deposited (all time)
        lastUpdated: number; // Timestamp of last update
        version: number; // Version number for optimistic locking
    }
}
