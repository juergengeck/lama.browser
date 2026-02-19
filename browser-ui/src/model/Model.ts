/**
 * LAMA Browser Model - Modular Architecture
 *
 * Orchestrates module lifecycle using demand/supply pattern:
 *
 * LIFECYCLE PHASES (mapped to class structure):
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ constructor()                                                               │
 * │   PHASE 1: Supply platform adapters (LLMPlatform, ExportPlan, etc.)         │
 * │   PHASE 2: Register modules (CoreModule, AIModule, ChatModule, etc.)        │
 * │   PHASE 2.5: Setup ONE.core MultiUser with recipes                          │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ init() - called on login                                                    │
 * │   PHASE 3: Setup providers (MeaningDimension, SettingsPlan, StoryFactory)   │
 * │   PHASE 4: Initialize all modules (topological sort, dependency injection)  │
 * │   PHASE 5: Post-init (instance assemblies, topic analysis, AI listener)     │
 * └─────────────────────────────────────────────────────────────────────────────┘
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

// Instance tracking
import { InstancePlan } from '@refinio/lama.core/plans/InstancePlan.js';
import { storeVersionedObject, getIdObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { getInstanceIdHash, getInstanceOwnerIdHash } from '@refinio/one.core/lib/instance.js';

// Trust.core recipes
import { AllRecipes as TrustCoreRecipes, AllReverseMaps as TrustCoreReverseMaps } from '@refinio/trust.core/recipes';

// Cube.core recipes
import { CubeCoreRecipes } from '@refinio/cube.core';

// Meaning.core recipes for semantic embedding dimension
import { MeaningCoreRecipes } from '@refinio/meaning.core/recipes/index.js';

// One.knowledge recipes for knowledge assembly (Artifact, KeywordClean)
import { OneKnowledgeRecipes } from '@refinio/one.knowledge/lib/recipes/index.js';

// Settings.core recipes and plans (for IoM-compatible settings)
import { SettingsRecipes, SettingsPlan, InstanceSettingsStorage } from '@refinio/settings.core';
import { registerLamaCoreSettings } from '@refinio/lama.core/settings';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Instance } from '@refinio/one.core/lib/recipes.js';

// Module system
import { ModuleRegistry } from '@refinio/api/plan-system';
import { planRegistry } from '@refinio/api/registry';
import type { SyncRule } from '@refinio/sync.core/types/sync-types.js';
import {
    CoreModule,
    IndexModule,
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
    KnowledgeNavigatorModule
} from '@refinio/lama.core/modules';

// ExportPlan from lama.core (platform-agnostic, uses one.core implode)
import { ExportPlan } from '@refinio/lama.core/plans/ExportPlan.js';

// MeaningPlan for semantic similarity (knowledge navigation)
import { MeaningPlan } from '@refinio/lama.core/plans/MeaningPlan.js';
import { MeaningDimension } from '@refinio/meaning.core';
import { setMeaningDimension } from '@refinio/lama.core/one-ai/models/Subject.js';

// Use browser-local embeddings instead of Ollama
import { getBrowserEmbeddingProvider } from '../services/BrowserEmbeddingProvider';

// IngestionPlan for document ingestion (PDF, etc.)
import { IngestionPlan } from '@refinio/memory.core/plans/IngestionPlan.js';

// GlueIdentityPlan for glue.one publication identity management
import { GlueIdentityPlan } from '@refinio/lama.core/plans/GlueIdentityPlan.js';
import { getDefaultSecretKeysAsBase64, getDefaultKeys } from '@refinio/one.core/lib/keychain/keychain.js';
import { getPublicKeys } from '@refinio/one.core/lib/keychain/key-storage-public.js';
import { sign, ensureSecretSignKey } from '@refinio/one.core/lib/crypto/sign.js';
import { uint8arrayToHexString } from '@refinio/one.core/lib/util/arraybuffer-to-and-from-hex-string.js';
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';
import { fromByteArray as toBase64, toByteArray as fromBase64 } from 'base64-js';

// Browser-specific adapters
import { BrowserLLMPlatform } from '../../../adapters/browser-llm-platform';
import { browserOllamaValidator, browserConfigManager } from '../../../adapters/browser-llm-config';

// Browser-specific plans
import { BrowserDocumentUploadPlan } from '../plans/DocumentUploadPlan';

// =============================================================================
// DEBUG LOGGING SETUP
// =============================================================================

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

// =============================================================================
// MODEL CLASS
// =============================================================================

/**
 * Model - Main model class for LAMA Browser
 *
 * Simplified to use modular architecture with ModuleRegistry.
 * Modules handle their own initialization and dependencies.
 */
export default class Model {
    // Public events
    public onOneModelsReady = new OEvent<() => void>();
    public onContactsChanged = new OEvent<() => void>();
    public onTopicsChanged = new OEvent<() => void>();
    public onConnectionsChanged = new OEvent<() => void>();

    // State
    public initialized: boolean = false;
    public ownerId: string | null = null;
    public instanceId: string | null = null;
    private _instanceName: string = 'default';
    private _initializing = false;

    // Module system
    private moduleRegistry: ModuleRegistry;
    private modules: Map<string, any> = new Map();

    // MultiUser instance (ONE.core authentication and storage)
    public one: MultiUser;

    // Document ingestion plan
    public ingestionPlan: IngestionPlan | null = null;

    // Glue.one identity plan
    public glueIdentityPlan: GlueIdentityPlan | null = null;

    // Settings plan reference (for plans that need it post-init)
    private _settingsPlan: SettingsPlan | null = null;

    // Document upload plan (browser-specific wrapper for DocumentAIPlan and MessageAttachmentPlan)
    public documentUploadPlan: BrowserDocumentUploadPlan | null = null;

    // Browser-specific adapters (stored for Phase 2)
    private _llmPlatformInstance: BrowserLLMPlatform;

    // MeaningPlan shell (supplied in Phase 1, filled in Phase 3)
    private _meaningPlan: MeaningPlan;

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

        // PHASE 1: Supply platform adapters
        this.supplyPlatformAdapters();

        // PHASE 2: Register modules
        this.registerModules();

        // PHASE 2.5: Setup ONE.core MultiUser with recipes
        this.setupOneCore();

        console.log('[Model] Construction complete - modules registered');
    }

    // =========================================================================
    // PHASE 1: SUPPLY PLATFORM ADAPTERS
    // =========================================================================

    private supplyPlatformAdapters(): void {
        console.log('[Model] Phase 1: Supplying platform adapters...');

        // Supply Model instance as "OneCore" for modules that need it
        this.moduleRegistry.supply('OneCore', this);

        // SyncRules — ConnectionModule optionally demands these for CHUM import filtering.
        // RoleCertificate must be accepted from any known peer (not unknown).
        const syncRules = new Map<string, SyncRule>([
            ['RoleCertificate', {
                canImport: (context) => context.peerTrustLevel !== 'unknown'
            }]
        ]);
        this.moduleRegistry.supply('SyncRules', syncRules);

        // Create single BrowserLLMPlatform instance to be shared
        this._llmPlatformInstance = new BrowserLLMPlatform();

        // Supply browser-specific adapters
        this.moduleRegistry.supply('LLMPlatform', this._llmPlatformInstance);
        this.moduleRegistry.supply('OllamaValidator', browserOllamaValidator);
        this.moduleRegistry.supply('LLMConfigManager', browserConfigManager);

        // Supply ExportPlan from lama.core (platform-agnostic, uses one.core implode)
        const exportPlan = new ExportPlan();
        this.moduleRegistry.supply('ExportPlan', exportPlan);

        // Supply MeaningPlan synchronously (empty shell).
        // Modules that demand MeaningPlan get the shared instance immediately.
        // It becomes operational after login when supplyMeaningDimension() fills it.
        this._meaningPlan = new MeaningPlan();
        this.moduleRegistry.supply('MeaningPlan', this._meaningPlan);

        console.log('[Model] Phase 1 complete');
    }

    // =========================================================================
    // PHASE 2: REGISTER MODULES
    // =========================================================================

    private registerModules(): void {
        console.log('[Model] Phase 2: Registering modules...');

        // Core models (LeuteModel, ChannelManager, TopicModel)
        this.modules.set('core', new CoreModule(this.commServerUrl));

        // Dimensional indexing (O(1) contact/topic lookups - depends on LeuteModel, TopicModel)
        this.modules.set('index', new IndexModule());

        // Trust management
        this.modules.set('trust', new TrustModule());

        // Chat functionality
        this.modules.set('chat', new ChatModule());

        // Topic analysis
        this.modules.set('analysis', new AnalysisModule());

        // AI functionality
        this.modules.set('ai', new AIModule(
            this._llmPlatformInstance,
            { ollamaValidator: browserOllamaValidator }
        ));

        // P2P connections with key mismatch handler
        const connectionModule = new ConnectionModule(this.commServerUrl, this.webUrl);
        connectionModule.setKeyMismatchHandler(async (remotePersonId: string, message: string) => {
            console.warn('[Model] Key mismatch detected:', remotePersonId);

            const proceed = window.confirm(
                'SECURITY WARNING\n\n' +
                message + '\n\n' +
                'Click OK to trust the new key and proceed.\n' +
                'Click Cancel to reject this connection.\n\n' +
                '(If you did not expect this, click Cancel for safety)'
            );

            if (proceed) {
                console.log('[Model] User approved key mismatch - proceeding with connection');
            } else {
                console.log('[Model] User rejected key mismatch - aborting connection');
            }

            return proceed;
        });
        this.modules.set('connection', connectionModule);

        // Device management
        this.modules.set('device', new DeviceModule());

        // Memory management
        this.modules.set('memory', new MemoryModule());

        // Knowledge navigation
        this.modules.set('knowledgeNavigator', new KnowledgeNavigatorModule());

        // Journal/audit trail
        this.modules.set('journal', new JournalModule());

        // MCP (remote MCP via chat)
        this.modules.set('mcp', new MCPModule());

        // Instance registry
        this.modules.set('instance', new InstanceModule());

        // Register all modules with the registry
        for (const [name, module] of this.modules) {
            console.log(`[Model] Registering module: ${name}`);
            this.moduleRegistry.register(module);
        }

        console.log('[Model] Phase 2 complete');
    }

    // =========================================================================
    // PHASE 2.5: SETUP ONE.CORE
    // =========================================================================

    private setupOneCore(): void {
        console.log('[Model] Phase 2.5: Setting up ONE.core...');

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
                // Meaning.core recipes
                ...MeaningCoreRecipes,
                // One.knowledge recipes
                ...(OneKnowledgeRecipes || []),
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

        console.log('[Model] Phase 2.5 complete');
    }

    // =========================================================================
    // INIT (PHASES 3-5) - Called on login
    // =========================================================================

    async init(instanceName?: string, _secret?: string): Promise<void> {
        if (this.initialized) {
            console.log('[Model] Already initialized, skipping');
            return;
        }
        if (this._initializing) {
            console.log('[Model] Initialization already in progress, skipping');
            return;
        }
        this._initializing = true;

        // Capture instance name from onLogin callback
        if (instanceName) {
            this._instanceName = instanceName;
            console.log('[Model] Instance name set to:', instanceName);
        }

        try {
            console.log('[Model] ===== Starting initialization (Phases 3-5) =====');

            // PHASE 3: Setup providers
            await this.setupProviders();

            // PHASE 4: Initialize all modules
            console.log('[Model] Phase 4: Initializing all modules...');
            await this.moduleRegistry.initAll();

            // Check for genuinely unsatisfied demands after init
            const unsatisfied = this.moduleRegistry.getUnsatisfiedDemands();
            if (unsatisfied.length > 0) {
                console.warn('[Model] Unsatisfied demands after init:', unsatisfied.map((d: any) => d.targetType));
            }

            console.log('[Model] Phase 4 complete');

            // PHASE 5: Post-init
            await this.postInit();

            // Mark as initialized
            this.initialized = true;
            console.log('[Model] ===== All phases complete =====');
            this.onOneModelsReady.emit();

        } catch (e) {
            console.error('[Model] Initialization failed:', e);
            this.initialized = false;
            this._initializing = false;
            await this.shutdown().catch(console.error);
            throw e;
        }
    }

    // =========================================================================
    // PHASE 3: SETUP PROVIDERS
    // =========================================================================

    private async setupProviders(): Promise<void> {
        console.log('[Model] Phase 3: Setting up providers...');

        // StoryFactory for journal tracking (must be before initAll)
        this.moduleRegistry.setStorageFunction(storeVersionedObject);

        // MeaningDimension — run in background so it doesn't block login.
        // MeaningPlan was already supplied (empty) in Phase 1; setDimension()
        // fills it when the embedding model finishes loading.
        this.supplyMeaningDimension().catch(error => {
            console.warn('[Model] Background MeaningDimension init failed:', error);
        });

        // SettingsPlan (requires instanceId)
        await this.supplySettingsPlan();

        console.log('[Model] Phase 3 complete');
    }

    /**
     * Initialize MeaningDimension in the background.
     * The shared MeaningPlan instance is supplied synchronously in Phase 1
     * so modules can init immediately. This fills it when ready.
     */
    private async supplyMeaningDimension(): Promise<void> {
        console.log('[Model] Setting up MeaningDimension (background)...');

        // Use browser-local embeddings (transformers.js) instead of Ollama
        const embeddingProvider = getBrowserEmbeddingProvider();

        // Start loading model in background (don't await - let it load while other init happens)
        console.log('[Model] Starting background load of nomic-embed-text model...');
        embeddingProvider.load().then(() => {
            console.log('[Model] Embedding model loaded and ready');
        }).catch(error => {
            console.warn('[Model] Embedding model failed to load:', error);
        });

        const meaningDimension = new MeaningDimension({
            embeddingProvider
        });
        await meaningDimension.init();

        // Wire MeaningDimension to Subject model for automatic embedding indexing
        setMeaningDimension(meaningDimension);

        // Fill the shared MeaningPlan instance (modules already hold a reference)
        this._meaningPlan.setDimension(meaningDimension, embeddingProvider);

        // Supply remaining deps to registry
        this.moduleRegistry.supply('MeaningDimension', meaningDimension);
        this.moduleRegistry.supply('EmbeddingProvider', embeddingProvider);

        console.log('[Model] MeaningDimension supplied');
    }

    private async supplySettingsPlan(): Promise<void> {
        const instanceId = getInstanceIdHash();
        if (!instanceId) {
            console.warn('[Model] Cannot create SettingsPlan - instanceId not available');
            return;
        }

        try {
            // Register lama.core settings sections before creating storage
            registerLamaCoreSettings();

            // Create InstanceSettingsStorage with instanceIdHash
            const instanceSettingsStorage = new InstanceSettingsStorage({
                instanceIdHash: instanceId as SHA256IdHash<Instance>
            });

            // Create and supply SettingsPlan
            const settingsPlan = new SettingsPlan(instanceSettingsStorage);
            this._settingsPlan = settingsPlan;
            this.moduleRegistry.supply('SettingsPlan', settingsPlan);

            console.log('[Model] SettingsPlan supplied');
        } catch (error) {
            console.warn('[Model] SettingsPlan creation failed:', error);
        }
    }

    // =========================================================================
    // PHASE 5: POST-INIT
    // =========================================================================

    private async postInit(): Promise<void> {
        console.log('[Model] Phase 5: Post-init...');

        // Set ownerId and instanceId from ONE.core
        this.ownerId = getInstanceOwnerIdHash() as string | null;
        this.instanceId = getInstanceIdHash() as string | null;
        console.log('[Model] Owner ID:', this.ownerId?.substring(0, 8));

        // Configure InstanceModule with local instance info
        this.configureInstanceModule();

        // Create retroactive Assemblies for Instance and Owner
        await this.createInstanceAssemblies();

        // Initialize topic analysis (creates TopicAnalysisPlan, ProposalsPlan, AIPlan)
        await this.initializeTopicAnalysis();

        // Discover local models
        await this.discoverLocalModels();

        // Load AI/LLM data from storage (LLMObjectManager + AIAssistantPlan.init)
        await this.loadAIData();

        // Initialize document plans
        this.initializeDocumentPlans();

        // Initialize glue identity plan
        this.initializeGlueIdentityPlan();

        // Start AI message listener (includes scanning existing conversations)
        await this.startAIMessageListener();

        // Auto-connect to glue.one server (fire-and-forget, non-fatal)
        const connectionModule = this.modules.get('connection') as ConnectionModule;
        connectionModule?.connectToGlueServer().catch(err =>
            console.warn('[Model] glue.one auto-connect failed:', err));

        console.log('[Model] Phase 5 complete');
    }

    private configureInstanceModule(): void {
        const instanceModule = this.modules.get('instance') as InstanceModule;
        if (instanceModule && this.instanceId) {
            instanceModule.setLocalInstance(
                this.instanceId as any,
                'browser',
                ['AIAssistantPlan', 'ChatPlan', 'ConnectionPlan', 'MemoryPlan']
            );
        }
    }

    private async createInstanceAssemblies(): Promise<void> {
        try {
            const storyFactory = this.moduleRegistry.getStoryFactory();
            if (!storyFactory || !this.ownerId || !this.instanceId) {
                console.warn('[Model] Cannot record instance creation - missing StoryFactory or IDs');
                return;
            }

            const instancePlan = new InstancePlan({
                storyFactory,
                ownerId: this.ownerId as any,
                instanceId: this.instanceId as any,
                instanceName: this.one.currentlyLoggedInInstanceName || 'lama-browser'
            });
            await instancePlan.init();
            await instancePlan.recordInstanceCreation();
            console.log('[Model] Instance assemblies created');
        } catch (error) {
            console.error('[Model] Failed to record instance creation:', error);
            // Non-critical - continue without instance assembly
        }
    }

    private async initializeTopicAnalysis(): Promise<void> {
        console.log('[Model] Initializing topic analysis...');
        const aiModule = this.modules.get('ai');
        await aiModule.initTopicAnalysis();
        console.log('[Model] Topic analysis initialized');
    }

    private async discoverLocalModels(): Promise<void> {
        console.log('[Model] Discovering local models...');
        const aiModule = this.modules.get('ai');
        const platform = aiModule.llmManager.platform;

        if (platform?.getAvailableLocalModels) {
            const localModels = await platform.getAvailableLocalModels();
            if (localModels.length > 0) {
                await aiModule.llmManager.discoverLocalModels(localModels.map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    familyName: m.name.split(' ')[0],
                    type: 'text-generation' as const,
                    contextLength: 4096,
                    status: 'available' as const,
                    sizeBytes: m.size
                })));
                console.log(`[Model] Registered ${localModels.length} local models`);
            }
        }
    }

    private async loadAIData(): Promise<void> {
        console.log('[Model] Loading AI/LLM data from storage...');
        const aiModule = this.modules.get('ai') as AIModule;
        await aiModule.loadData();
        console.log('[Model] AI data loaded');
    }

    private initializeDocumentPlans(): void {
        // Initialize ingestion plan
        console.log('[Model] Initializing ingestion plan...');
        this.ingestionPlan = new IngestionPlan({
            topicModel: this.topicModel,
            leuteModel: this.leuteModel,
            aiAssistantPlan: this.aiAssistantPlan,
            aiPlan: this.aiPlan
        });
        console.log('[Model] Ingestion plan initialized');

        // Initialize document upload plan
        console.log('[Model] Initializing document upload plan...');
        this.documentUploadPlan = new BrowserDocumentUploadPlan(this);
        console.log('[Model] Document upload plan initialized');
    }

    private initializeGlueIdentityPlan(): void {
        try {
            if (!this._settingsPlan || !this.leuteModel) {
                console.warn('[Model] Cannot create GlueIdentityPlan - dependencies not ready');
                return;
            }

            this.glueIdentityPlan = new GlueIdentityPlan({
                leuteModel: this.leuteModel,
                settingsPlan: this._settingsPlan,
                getDefaultSecretKeysAsBase64,
                getDefaultKeys,
                getPublicKeys,
                sign,
                ensureSecretSignKey,
                uint8arrayToHexString,
                calculateIdHashOfObj,
                fromBase64,
                toBase64,
            });
            console.log('[Model] GlueIdentityPlan initialized');
        } catch (error) {
            console.warn('[Model] GlueIdentityPlan creation failed:', error);
        }
    }

    private async startAIMessageListener(): Promise<void> {
        console.log('[Model] Starting AI message listener...');
        const aiModule = this.modules.get('ai');
        await aiModule.startMessageListener(this.ownerId);
        console.log('[Model] AI message listener started');
    }

    // =========================================================================
    // SHUTDOWN
    // =========================================================================

    async shutdown(): Promise<void> {
        console.log('[Model] Shutting down all modules...');

        // Use ModuleRegistry for automatic reverse-order shutdown
        await this.moduleRegistry.shutdownAll();

        this.initialized = false;
        this._initializing = false;
        this.ownerId = null;

        console.log('[Model] Shutdown complete');
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Update the display name advertised via mDNS discovery.
     * This updates the TXT record name field - connections are not affected.
     */
    updateDiscoveryDisplayName(newName: string): void {
        const connectionModule = this.modules.get('connection');
        if (connectionModule?.updateDiscoveryDisplayName) {
            connectionModule.updateDiscoveryDisplayName(newName);
        }
    }

    // =========================================================================
    // GETTERS - Module Services
    // =========================================================================

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

    // PlanRegistry (global singleton)
    get planRegistry() { return planRegistry; }

    // Additional services (to be moved to appropriate modules in future iterations)
    get cubeStorage() { return this.modules.get('ai').cubeStorage; }
    get cubePlan() { return this.modules.get('ai').cubePlan; }
}

// =============================================================================
// GLOBAL MODEL SINGLETON
// =============================================================================

let globalModel: Model | null = null;

export function getModel(): Model | null {
    return globalModel;
}

export function setGlobalModel(model: Model | null): void {
    globalModel = model;
}
