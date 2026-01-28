/**
 * LAMA Browser Model - Modular Architecture
 *
 * Simplified model using ModuleRegistry to coordinate initialization.
 * Core functionality delegated to modules: Core, AI, Chat, Connection, Trust.
 */

import MultiUser from '@refinio/one.models/lib/models/Authenticator/MultiUser.js';
import { OEvent } from '@refinio/one.models/lib/misc/OEvent.js';
import RecipesStable from '@refinio/one.models/lib/recipes/recipes-stable.js';
import RecipesExperimental from '@refinio/one.models/lib/recipes/recipes-experimental.js';
import {
    ReverseMapsStable,
    ReverseMapsForIdObjectsStable
} from '@refinio/one.models/lib/recipes/reversemaps-stable.js';
import {
    ReverseMapsExperimental,
    ReverseMapsForIdObjectsExperimental
} from '@refinio/one.models/lib/recipes/reversemaps-experimental.js';

// LAMA recipes
import { LAMA_CORE_RECIPES } from '@refinio/lama.core/recipes';

// Local lama.browser recipes
import { SubscriptionBalanceRecipe } from '../recipes/SubscriptionBalanceRecipe';
import { MessageReadStatusRecipe } from '../recipes/MessageReadStatusRecipe';
import { AvatarPreferenceRecipe } from '../recipes/AvatarPreferenceRecipe';

// Assembly recipes
import { AssemblyCoreRecipes } from '@refinio/assembly.core';

// MessageBus for debug logging
import { createMessageBus } from '@refinio/one.core/lib/message-bus.js';

// Set up MessageBus listener for CHUM/Connection debug messages
const debugBus = createMessageBus('browser-model');
const CHUM_DEBUG = true;

debugBus.on('debug', (src: string, ...messages: unknown[]) => {
    if (CHUM_DEBUG && (
        src.includes('CHUM') ||
        src.includes('Channel') ||
        src.includes('Connection') ||
        src.includes('Pairing') ||
        src.includes('OBJECT_EVENTS') ||
        src.includes('chum') ||
        src.includes('WebSocket') ||
        src.includes('Topic')
    )) {
        console.log(`[${src}]`, ...messages);
    }
});

debugBus.on('log', (src: string, ...messages: unknown[]) => {
    if (CHUM_DEBUG && (
        src.includes('CHUM') ||
        src.includes('Channel') ||
        src.includes('Connection') ||
        src.includes('Pairing') ||
        src.includes('chum') ||
        src.includes('WebSocket') ||
        src.includes('LeuteConnections')
    )) {
        console.log(`[${src}]`, ...messages);
    }
});

debugBus.on('error', (src: string, ...messages: unknown[]) => {
    if (src.includes('CHUM') || src.includes('Channel') || src.includes('Connection') || src.includes('Pairing')) {
        console.error(`[${src}] ERROR:`, ...messages);
    }
});

// Instance tracking
import { InstancePlan } from '@refinio/lama.core/plans/InstancePlan.js';
import { storeVersionedObject, getIdObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { getInstanceIdHash, getInstanceOwnerIdHash } from '@refinio/one.core/lib/instance.js';

// Trust.core recipes
import { AllRecipes as TrustCoreRecipes, AllReverseMaps as TrustCoreReverseMaps } from '@refinio/trust.core/recipes';

// Cube.core recipes
import { CubeCoreRecipes } from '@refinio/cube.core';

// Settings.core recipes (for IoM-compatible settings)
import { SettingsRecipes } from '@refinio/settings.core';

// Module system
import { ModuleRegistry } from '@refinio/api/plan-system';
import {
    CoreModule,
    AIModule,
    ChatModule,
    TrustModule,
    ConnectionModule,
    AnalysisModule,
    MemoryModule,
    DeviceModule,
    JournalModule,
    MCPModule,
    InstanceModule,
    KnowledgeNavigatorModule,
    type LLMConfigAdapter
} from '@refinio/lama.core/modules';

// ExportPlan from lama.core (platform-agnostic, uses one.core implode)
import { ExportPlan } from '@refinio/lama.core/plans/ExportPlan.js';

// IngestionPlan for document ingestion (PDF, etc.)
import { IngestionPlan } from '@refinio/memory.core/plans/IngestionPlan.js';

// BLOB storage for attachments
import { storeArrayBufferAsBlob } from '@refinio/one.core/lib/storage-blob.js';

// Browser-specific adapters
import { BrowserLLMPlatform } from '../../../adapters/browser-llm-platform';
import { browserOllamaValidator, browserConfigManager } from '../../../adapters/browser-llm-config';

// Browser-specific plans
import { BrowserDocumentUploadPlan } from '../plans/DocumentUploadPlan';

/**
 * Model - Main model class for LAMA Browser
 *
 * Simplified to use modular architecture with ModuleRegistry.
 * Modules handle their own initialization and dependencies.
 */
export default class Model {
    public onOneModelsReady = new OEvent<() => void>();
    public onContactsChanged = new OEvent<() => void>();
    public onTopicsChanged = new OEvent<() => void>();
    public onConnectionsChanged = new OEvent<() => void>();
    public initialized: boolean = false;
    public ownerId: string | null = null;
    public instanceId: string | null = null;
    private _instanceName: string = 'default';

    private moduleRegistry: ModuleRegistry;
    private modules: Map<string, any> = new Map();

    // MultiUser instance (ONE.core authentication and storage)
    public one: MultiUser;

    // Document ingestion plan
    public ingestionPlan: IngestionPlan | null = null;

    // Document upload plan (browser-specific wrapper for DocumentAIPlan and MessageAttachmentPlan)
    public documentUploadPlan: BrowserDocumentUploadPlan | null = null;

    /**
     * Instance name getter for AISettingsManager compatibility
     * Returns the logged-in instance name (captured from onLogin callback)
     */
    public get instanceName(): string {
        return this._instanceName;
    }

    /**
     * Get an object by its ID hash.
     * Exposed for ChatPlan to resolve topic.channel references.
     */
    public getIdObject = getIdObject;

    constructor(
        private commServerUrl: string,
        private webUrl: string = 'https://lama.one'
    ) {
        console.log('[Model] Constructing LAMA Browser Model (Modular Architecture)...');
        console.log('[Model] CommServer URL:', commServerUrl);
        console.log('[Model] Web URL:', webUrl);

        // Initialize module registry
        this.moduleRegistry = new ModuleRegistry();

        // Supply Model instance as "OneCore" for modules that need it
        this.moduleRegistry.supply('OneCore', this);

        // Create single BrowserLLMPlatform instance to be shared
        const llmPlatform = new BrowserLLMPlatform();

        // Supply browser-specific adapters before module registration
        this.moduleRegistry.supply('LLMPlatform', llmPlatform);
        this.moduleRegistry.supply('OllamaValidator', browserOllamaValidator);
        this.moduleRegistry.supply('LLMConfigManager', browserConfigManager);

        // Supply ExportPlan from lama.core (platform-agnostic, uses one.core implode)
        const exportPlan = new ExportPlan();
        this.moduleRegistry.supply('ExportPlan', exportPlan);

        // Create and register modules
        this.modules.set('core', new CoreModule(commServerUrl));
        this.modules.set('trust', new TrustModule());
        this.modules.set('chat', new ChatModule());
        this.modules.set('analysis', new AnalysisModule());
        this.modules.set('ai', new AIModule(
            llmPlatform, // Use shared instance
            { ollamaValidator: browserOllamaValidator }
        ));
        this.modules.set('connection', new ConnectionModule(commServerUrl, webUrl));
        this.modules.set('device', new DeviceModule());
        this.modules.set('memory', new MemoryModule());
        this.modules.set('knowledgeNavigator', new KnowledgeNavigatorModule());
        this.modules.set('journal', new JournalModule());
        this.modules.set('mcp', new MCPModule());

        // Create and register InstanceModule
        const instanceModule = new InstanceModule();
        this.modules.set('instance', instanceModule);

        // Register all modules with the registry
        for (const [name, module] of this.modules) {
            console.log(`[Model] Registering module: ${name}`);
            this.moduleRegistry.register(module);
        }

        // Setup ONE.core MultiUser with all recipes
        this.one = new MultiUser({
            directory: 'lama.browser.storage',
            recipes: [
                ...RecipesStable,
                ...RecipesExperimental,
                // LAMA recipes
                ...LAMA_CORE_RECIPES,
                SubscriptionBalanceRecipe,
                MessageReadStatusRecipe,
                AvatarPreferenceRecipe,
                // Assembly tracking
                ...AssemblyCoreRecipes,
                // Trust.core recipes
                ...TrustCoreRecipes,
                // Cube.core recipes
                ...CubeCoreRecipes,
                // Settings.core recipes (for IoM-compatible settings)
                ...SettingsRecipes
            ],
            reverseMaps: new Map([
                ...ReverseMapsStable,
                ...ReverseMapsExperimental,
                ...TrustCoreReverseMaps,
                ['LLM', new Set(['owner'])]
            ]),
            reverseMapsForIdObjects: new Map([
                ...ReverseMapsForIdObjectsStable,
                ...ReverseMapsForIdObjectsExperimental,
                ['Plan', new Set(['id'])]
            ]),
            storageInitTimeout: 20000
        });

        // Setup login/logout handlers
        this.one.onLogin(this.init.bind(this));
        this.one.onLogout(this.shutdown.bind(this));

        console.log('[Model] Model construction complete - modules registered');
    }

    async init(instanceName?: string, _secret?: string): Promise<void> {
        if (this.initialized) {
            throw new Error('Model already initialized');
        }

        // Capture instance name from onLogin callback
        if (instanceName) {
            this._instanceName = instanceName;
            console.log('[Model] Instance name set to:', instanceName);
        }

        try {
            console.log('[Model] ===== Initializing all modules via ModuleRegistry =====');

            // Create StoryFactory and auto-supply to all modules that demand it
            // Must be done BEFORE initAll() so JournalModule receives it
            console.log('[Model] Setting up StoryFactory...');
            this.moduleRegistry.setStorageFunction(storeVersionedObject);

            // Use ModuleRegistry for automatic dependency-ordered initialization
            // CoreModule will initialize PlanObjectManager when OneCore Instance is ready
            await this.moduleRegistry.initAll();

            // Set ownerId and instanceId from ONE.core after login
            // These are available after CoreModule initializes leuteModel
            this.ownerId = getInstanceOwnerIdHash() as string | null;
            this.instanceId = getInstanceIdHash() as string | null;
            console.log('[Model] Owner ID:', this.ownerId?.substring(0, 8));

            // Configure InstanceModule with local instance info
            const instanceModule = this.modules.get('instance') as InstanceModule;
            if (instanceModule && this.instanceId) {
                instanceModule.setLocalInstance(
                    this.instanceId as any,
                    'browser',
                    ['AIAssistantPlan', 'ChatPlan', 'ConnectionPlan', 'MemoryPlan']
                );
            }

            // Create retroactive Assemblies for Instance and Owner (bootstrap problem)
            // Instance and Owner were created before StoryFactory existed
            try {
                const storyFactory = this.moduleRegistry.getStoryFactory();
                if (storyFactory && this.ownerId && this.instanceId) {
                    const instancePlan = new InstancePlan({
                        storyFactory,
                        ownerId: this.ownerId as any,
                        instanceId: this.instanceId as any,
                        instanceName: this.one.currentlyLoggedInInstanceName || 'lama-browser'
                    });
                    await instancePlan.init();
                    await instancePlan.recordInstanceCreation();
                    console.log('[Model] ✅ Instance and Owner assemblies created in journal');
                } else {
                    console.warn('[Model] Cannot record instance creation - missing StoryFactory or IDs');
                    console.warn('[Model] ownerId:', !!this.ownerId, 'instanceId:', !!this.instanceId);
                }
            } catch (error) {
                console.error('[Model] Failed to record instance creation:', error);
                // Non-critical - continue without instance assembly
            }

            // Initialize topic analysis (creates TopicAnalysisModel, ProposalsPlan, etc.)
            console.log('[Model] Initializing topic analysis...');
            const aiModule = this.modules.get('ai');
            await aiModule.initTopicAnalysis();
            console.log('[Model] ✅ Topic analysis initialized');

            // Discover and register local models from BrowserLLMPlatform
            console.log('[Model] Discovering local models...');
            const platform = aiModule.llmManager.platform;
            if (platform?.getAvailableLocalModels) {
                const localModels = await platform.getAvailableLocalModels();
                if (localModels.length > 0) {
                    await aiModule.llmManager.discoverLocalModels(localModels.map(m => ({
                        id: m.id,
                        name: m.name,
                        familyName: m.name.split(' ')[0], // "Granite", "Phi"
                        type: 'text-generation' as const,
                        contextLength: 4096,
                        status: 'available' as const,
                        sizeBytes: m.size
                    })));
                    console.log(`[Model] ✅ Registered ${localModels.length} local models`);
                }
            }

            // Mark as initialized
            this.initialized = true;

            // CRITICAL: Scan existing conversations to register AI topics BEFORE starting listener
            console.log('[Model] Scanning existing conversations for AI topics...');
            const registeredCount = await this.aiAssistantPlan.scanExistingConversations();
            console.log(`[Model] ✅ Registered ${registeredCount} AI topics`);

            // Initialize ingestion plan after AI is ready
            console.log('[Model] Initializing ingestion plan...');
            this.ingestionPlan = new IngestionPlan({
                topicModel: this.topicModel,
                leuteModel: this.leuteModel,
                aiAssistantPlan: this.aiAssistantPlan,
                aiPlan: this.aiPlan
            });
            console.log('[Model] ✅ Ingestion plan initialized');

            // Initialize document upload plan after AI and chat are ready
            console.log('[Model] Initializing document upload plan...');
            this.documentUploadPlan = new BrowserDocumentUploadPlan(this);
            console.log('[Model] ✅ Document upload plan initialized');

            // CRITICAL: Start AI message listener after all initialization
            console.log('[Model] Starting AI message listener...');
            await aiModule.startMessageListener(this.ownerId);
            console.log('[Model] ✅ AI message listener started');

            // Note: Channel update listener is now in CoreModule (onTopicUpdated event)
            // UI components subscribe to coreModule.onTopicUpdated via this.onTopicUpdated getter

            console.log('[Model] ✅ All modules initialized');
            this.onOneModelsReady.emit();
        } catch (e) {
            console.error('[Model] Module initialization failed:', e);
            this.initialized = false;
            await this.shutdown().catch(console.error);
            throw e;
        }
    }

    async shutdown(): Promise<void> {
        console.log('[Model] Shutting down all modules...');

        // Use ModuleRegistry for automatic reverse-order shutdown
        // Note: Channel update listener cleanup is handled by CoreModule
        await this.moduleRegistry.shutdownAll();

        this.initialized = false;
        this.ownerId = null;

        console.log('[Model] ✅ Shutdown complete');
    }

    // Expose module services via getters
    // CoreModule services
    get leuteModel() { return this.modules.get('core').leuteModel; }
    get channelManager() { return this.modules.get('core').channelManager; }
    get topicModel() { return this.modules.get('core').topicModel; }
    get connections() { return this.modules.get('connection').connectionsModel; }
    get connectionsModel() { return this.connections; } // Alias for compatibility
    get settings() { return this.modules.get('core').settings; }
    /** Topic update events from CoreModule - emits topicId when messages change */
    get onTopicUpdated() { return this.modules.get('core').onTopicUpdated; }

    // AIModule services
    get llmPlatform() { return this.llmManager?.platform as BrowserLLMPlatform | undefined; }
    get aiPlan() { return this.modules.get('ai').aiPlan; }
    get aiAssistantPlan() { return this.modules.get('ai').aiAssistantPlan; }
    get topicAnalysisPlan() { return this.modules.get('ai').topicAnalysisPlan; }
    get llmConfigPlan() { return this.modules.get('ai').llmConfigPlan; }
    get proposalsPlan() { return this.modules.get('ai').proposalsPlan; }
    get keywordDetailPlan() { return this.modules.get('ai').keywordDetailPlan; }
    get wordCloudSettingsPlan() { return this.modules.get('ai').wordCloudSettingsPlan; }
    get cryptoPlan() { return this.modules.get('ai').cryptoPlan; }
    get auditPlan() { return this.modules.get('ai').auditPlan; }
    get subjectsPlan() { return this.modules.get('ai').subjectsPlan; }
    get llmManager() { return this.modules.get('ai').llmManager; }
    get llmObjectManager() { return this.modules.get('ai').llmObjectManager; }
    get aiObjectManager() { return this.modules.get('ai').aiObjectManager; }
    get topicAnalysisModel() { return this.modules.get('ai').topicAnalysisModel; }
    get aiMessageListener() { return this.modules.get('ai').aiMessageListener; }

    // ChatModule services
    get chatPlan() { return this.modules.get('chat').chatPlan; }
    get groupPlan() { return this.modules.get('chat').groupPlan; }
    get contactsPlan() { return this.modules.get('chat').contactsPlan; }
    get exportPlan() { return this.modules.get('chat').exportPlan; }
    get feedForwardPlan() { return this.modules.get('chat').feedForwardPlan; }
    get topicGroupManager() { return this.modules.get('chat').topicGroupManager; }

    // ConnectionModule services
    get connectionPlan() { return this.modules.get('connection').connectionPlan; }
    get groupChatPlan() { return this.modules.get('connection').groupChatPlan; }
    get discoveryService() { return this.modules.get('connection').discoveryService; }

    // TrustModule services
    get trustModel() { return this.modules.get('trust').trustModel; }
    get trustPlan() { return this.modules.get('trust').trustPlan; }

    // DeviceModule services
    get networkDeviceInfoPlan() { return this.modules.get('device').networkDeviceInfoPlan; }
    get devicePlan() { return this.modules.get('device').devicePlan; }
    get deviceDiscoveryPlan() { return this.modules.get('device').deviceDiscoveryPlan; }

    // MemoryModule services
    get memoryPlan() { return this.modules.get('memory').memoryPlan; }
    get chatMemoryPlan() { return this.modules.get('memory').chatMemoryPlan; }
    get chatMemoryService() { return this.modules.get('memory').chatMemoryService; }

    // JournalModule services (Assembly-based audit trail)
    get journalPlan() { return this.modules.get('journal').journalPlan; }
    get storyFactory() { return this.modules.get('journal').storyFactory; }
    get assemblyPlan() { return this.modules.get('journal').assemblyPlan; }
    get assemblyListener() { return this.modules.get('journal').assemblyListener; }

    // MCPModule services (remote MCP via chat)
    get mcpModule() { return this.modules.get('mcp'); }
    get mcpDemandManager() { return this.modules.get('mcp').demandManager; }
    get mcpRemoteClient() { return this.modules.get('mcp').remoteClient; }

    // InstanceModule services (IoM/IoP)
    get instanceRegistryPlan() { return this.modules.get('instance')?.instanceRegistryPlan; }

    // Additional services (to be moved to appropriate modules in future iterations)
    get cubeStorage() { return this.modules.get('ai').cubeStorage; }
    get cubePlan() { return this.modules.get('ai').cubePlan; }
}

// TODO: Remove these stubs when modular architecture is fully implemented
let globalModel: Model | null = null;

export function getModel(): Model | null {
    return globalModel;
}

export function setGlobalModel(model: Model | null): void {
    globalModel = model;
}
