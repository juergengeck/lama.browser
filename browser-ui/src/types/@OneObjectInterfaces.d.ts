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

declare module '@OneObjectInterfaces' {
    // ============================================================================
    // VERSIONED OBJECT INTERFACES
    // ============================================================================

    export interface OneVersionedObjectInterfaces {
        // Topic Analysis (lama.core/one.ai)
        Subject: Subject;
        Keyword: Keyword;
        Summary: Summary;
        WordCloudSettings: WordCloudSettings;

        // LLM Management (lama.core)
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
    }

    // ============================================================================
    // ID OBJECT INTERFACES (for getObjectByIdHash retrieval)
    // ============================================================================

    export interface OneIdObjectInterfaces {
        LLM: Pick<LLM, '$type$' | 'name'>;
        GlobalLLMSettings: Pick<GlobalLLMSettings, '$type$' | 'name'>;
        SystemPromptTemplate: Pick<SystemPromptTemplate, '$type$' | 'modelId'>;
        MCPServer: Pick<MCPServer, '$type$' | 'name'>;
        MCPServerConfig: Pick<MCPServerConfig, '$type$' | 'userEmail'>;
        ProposalConfig: Pick<ProposalConfig, '$type$' | 'userEmail'>;
        AvatarPreference: Pick<AvatarPreference, '$type$' | 'personId'>;
        Keyword: Pick<Keyword, '$type$' | 'term'>;
    }

    // ============================================================================
    // TYPE DEFINITIONS
    // ============================================================================

    // --- Topic Analysis (one.ai) ---

    /**
     * Subject - A distinct discussion topic within a conversation
     * Identified by keyword combinations (e.g., "pizza+baker+career")
     */
    export interface Subject {
        $type$: 'Subject';
        id: string; // keyword combination - ID property
        topic: string; // reference to parent topic (channel ID)
        keywords: string[];
        timeRanges: Array<{
            start: number;
            end: number;
        }>;
        messageCount: number;
        createdAt: number;
        lastSeenAt: number;
        archived?: boolean;
        likes?: number;
        dislikes?: number;
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
     * LLM - Language Learning Model configuration
     */
    export interface LLM {
        $type$: 'LLM';
        name: string; // ID property
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
        maxProposals: number; // 1-50 - maximum proposals to return
        updatedAt: number; // Unix timestamp
    }

    // --- UI Preferences ---

    /**
     * AvatarPreference - Avatar color preference for a person
     */
    export interface AvatarPreference {
        $type$: 'AvatarPreference';
        personId: string; // ID property - Person ID hash
        color: string; // Hex color code
        mood?: 'happy' | 'sad' | 'angry' | 'calm' | 'excited' | 'tired' | 'focused' | 'neutral';
        updatedAt: number; // Unix timestamp
    }
}
