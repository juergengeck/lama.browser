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
import { LAMA_CORE_RECIPES } from '@lama/core/recipes';

// Local lama.browser recipes
import { SubscriptionBalanceRecipe } from '../recipes/SubscriptionBalanceRecipe';
import { MessageReadStatusRecipe } from '../recipes/MessageReadStatusRecipe';
import { AvatarPreferenceRecipe } from '../recipes/AvatarPreferenceRecipe';

// Assembly recipes
import { AssemblyCoreRecipes } from '@assembly/core';

// Trust.core recipes
import { AllRecipes as TrustCoreRecipes, AllReverseMaps as TrustCoreReverseMaps } from '@trust/core/recipes';

// Cube.core recipes
import {
    CubeObjectRecipe,
    DimensionRecipe,
    DimensionValueRecipe,
    QueryResultRecipe
} from '@cube/core';

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
    type LLMConfigAdapter
} from '@lama/core/modules';

// Browser-specific adapters
import { BrowserLLMPlatform } from '../../../adapters/browser-llm-platform';
import { browserOllamaValidator, browserConfigManager } from '../../../adapters/browser-llm-config';

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

    private moduleRegistry: ModuleRegistry;
    private modules: Map<string, any> = new Map();

    // MultiUser instance (ONE.core authentication and storage)
    public one: MultiUser;

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

        // Supply browser-specific adapters before module registration
        this.moduleRegistry.supply('LLMPlatform', new BrowserLLMPlatform());
        this.moduleRegistry.supply('OllamaValidator', browserOllamaValidator);
        this.moduleRegistry.supply('LLMConfigManager', browserConfigManager);

        // Create and register modules
        this.modules.set('core', new CoreModule(commServerUrl));
        this.modules.set('trust', new TrustModule());
        this.modules.set('chat', new ChatModule());
        this.modules.set('analysis', new AnalysisModule());
        this.modules.set('ai', new AIModule(
            new BrowserLLMPlatform(),
            { ollamaValidator: browserOllamaValidator }
        ));
        this.modules.set('connection', new ConnectionModule(commServerUrl, webUrl));
        this.modules.set('device', new DeviceModule());
        this.modules.set('memory', new MemoryModule());
        this.modules.set('journal', new JournalModule());

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
                CubeObjectRecipe,
                DimensionRecipe,
                DimensionValueRecipe,
                QueryResultRecipe
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

    async init(_instanceName?: string, _secret?: string): Promise<void> {
        if (this.initialized) {
            throw new Error('Model already initialized');
        }

        try {
            console.log('[Model] ===== Initializing all modules via ModuleRegistry =====');

            // Use ModuleRegistry for automatic dependency-ordered initialization
            // CoreModule will initialize PlanObjectManager when OneCore Instance is ready
            // NOTE: CoreModule sets ownerId after leuteModel.init() so other modules can use it
            await this.moduleRegistry.initAll();

            // Initialize topic analysis (creates TopicAnalysisModel, ProposalsPlan, etc.)
            console.log('[Model] Initializing topic analysis...');
            const aiModule = this.modules.get('ai');
            await aiModule.initTopicAnalysis();
            console.log('[Model] ✅ Topic analysis initialized');

            // Mark as initialized
            this.initialized = true;

            // CRITICAL: Scan existing conversations to register AI topics BEFORE starting listener
            console.log('[Model] Scanning existing conversations for AI topics...');
            const registeredCount = await this.aiAssistantPlan.scanExistingConversations();
            console.log(`[Model] ✅ Registered ${registeredCount} AI topics`);

            // CRITICAL: Start AI message listener after all initialization
            console.log('[Model] Starting AI message listener...');
            await aiModule.startMessageListener(this.ownerId);
            console.log('[Model] ✅ AI message listener started');

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
    get connections() { return this.modules.get('core').connections; }
    get connectionsModel() { return this.connections; } // Alias for compatibility
    get settings() { return this.modules.get('core').settings; }

    // AIModule services
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
