/* eslint-disable @typescript-eslint/no-empty-interface */

/**
 * LAMA-specific type declarations for ONE.core objects
 * This extends the @OneObjectInterfaces module with our custom types
 */

declare module '@OneObjectInterfaces' {
    // Add our custom versioned object types
    export interface OneVersionedObjectInterfaces {
        GlobalLLMSettings: GlobalLLMSettings;
        Keyword: Keyword;
        ProposalConfig: ProposalConfig;
        UserSettings: UserSettings;
    }

    // Add our custom ID object types
    export interface OneIdObjectInterfaces {
        LLM: LLM;
    }

    // Define our custom object interfaces
    export interface GlobalLLMSettings {
        $type$: 'GlobalLLMSettings';
        name: string; // Instance ID - this is the ID field
        defaultModelId?: string;
        temperature?: number;
        maxTokens?: number;
        defaultProvider: string;
        autoSelectBestModel: boolean;
        preferredModelIds: string[];
        systemPrompt?: string;
        streamResponses?: boolean;
        autoSummarize?: boolean;
        enableMCP?: boolean;
    }

    export interface LLM {
        $type$: 'LLM';
        modelId: string;
        name: string;
        provider: string;
        endpoint?: string;
        apiKey?: string;
        temperature?: number;
        maxTokens?: number;
        contextSize?: number;
    }

    export interface Keyword {
        $type$: 'Keyword';
        term: string; // ID property - normalized keyword term
        frequency: number;
        subjects: string[]; // Array of subject IDs
        score?: number;
        createdAt: number; // Unix timestamp
        lastSeen: number; // Unix timestamp
    }

    export interface ProposalConfig {
        $type$: 'ProposalConfig';
        userEmail: string; // ID property - user's email
        matchWeight: number; // 0.0 to 1.0 - weight given to keyword match
        recencyWeight: number; // 0.0 to 1.0 - weight given to recency
        recencyWindow: number; // milliseconds - time window for recency boost
        minJaccard: number; // 0.0 to 1.0 - minimum Jaccard similarity threshold
        maxProposals: number; // 1-50 - maximum number of proposals to return
        updatedAt: number; // Unix timestamp of last update
    }

    export interface DimensionState {
        $type$: 'DimensionState';
        dimensionName: string; // Dimension name (e.g., 'assembly')
        state: string; // Serialized state JSON from dimension.serialize()
        updated: number; // Unix timestamp of when this state was saved
    }

    // UserSettings - Unified user settings (aligned with @settings/core)
    export interface UserSettings {
        $type$: 'UserSettings';

        // Metadata
        userEmail: string; // ID field - user identifier
        instanceId?: string; // Optional instance identifier for multi-device support
        updatedAt: number;

        // Core categories (required)
        ai: {
            defaultModelId?: string;
            temperature: number;
            maxTokens: number;
            defaultProvider: string;
            autoSelectBestModel: boolean;
            preferredModelIds: string[];
            systemPrompt?: string;
            streamResponses: boolean;
            autoSummarize: boolean;
            enableMCP: boolean;
            apiKeys?: Map<string, string>;
        };
        ui: {
            theme: 'dark' | 'light';
            notifications: boolean;
            wordCloud: {
                maxWordsPerSubject: number;
                relatedWordThreshold: number;
                minWordFrequency: number;
                showSummaryKeywords: boolean;
                fontScaleMin: number;
                fontScaleMax: number;
                colorScheme: string;
                layoutDensity: string;
            };
        };
        proposals: {
            matchWeight: number;
            recencyWeight: number;
            recencyWindow: number;
            minJaccard: number;
            maxProposals: number;
        };

        // Additional categories (optional - not all platforms use these)
        device?: {
            discoveryEnabled: boolean;
            discoveryPort: number;
            autoConnect: boolean;
            addOnlyConnectedDevices: boolean;
            showOfflineDevices: boolean;
            discoveryTimeout: number;
        };
        network?: {
            commServerUrl: string;
            autoReconnect: boolean;
            connectionTimeout: number;
            enableWebSocket: boolean;
            enableQUIC: boolean;
            enableBluetooth: boolean;
        };
        privacy?: {
            encryptStorage: boolean;
            requirePINOnStartup: boolean;
            autoLockTimeout: number;
            sendAnalytics: boolean;
            sendCrashReports: boolean;
        };
        chat?: {
            enterToSend: boolean;
            showReadReceipts: boolean;
            groupMessagesBy: 'none' | 'hour' | 'day';
            maxHistoryDays: number;
            autoDownloadMedia: boolean;
            maxMediaSize: number;
        };

        // Platform-specific (optional)
        electron?: {
            trayEnabled: boolean;
            autoLaunch: boolean;
            hardwareAcceleration: boolean;
        };
        ios?: {
            haptics: boolean;
            backgroundRefresh: boolean;
            vibrationEnabled: boolean;
        };
        browser?: {
            offlineMode: boolean;
        };
    }
}