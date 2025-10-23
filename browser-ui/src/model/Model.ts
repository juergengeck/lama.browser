/**
 * LAMA Browser Model
 *
 * Main model class that initializes ONE.core and all LAMA models in the browser main thread.
 * Follows the one.leute pattern - runs ONE.core directly in main thread (no worker).
 */

// DIAGNOSTIC: Check versionedObjects before importing one.models
console.log('[Model.ts] INSTANCE CHECK: About to import ONE.models...');
import { DEBUG_versionedObjects as versionedObjects } from '@refinio/one.core/lib/object-recipes.js';
if (!(versionedObjects as any).__INSTANCE_ID) {
  (versionedObjects as any).__INSTANCE_ID = 'MODEL_TS_' + Date.now();
  console.log('[Model.ts] INSTANCE CHECK: Created NEW instance ID:', (versionedObjects as any).__INSTANCE_ID);
  console.log('[Model.ts] INSTANCE CHECK: ⚠️  THIS SHOULD NOT HAPPEN - means duplicate module!');
} else {
  console.log('[Model.ts] INSTANCE CHECK: Found existing instance ID:', (versionedObjects as any).__INSTANCE_ID);
  console.log('[Model.ts] INSTANCE CHECK: ✅ Using same instance as main.tsx');
}
console.log('[Model.ts] INSTANCE CHECK: versionedObjects size:', versionedObjects.size);

import ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js';
import ConnectionsModel from '@refinio/one.models/lib/models/ConnectionsModel.js';
import LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';
import TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js';
import {OEvent} from '@refinio/one.models/lib/misc/OEvent.js';
import RecipesStable from '@refinio/one.models/lib/recipes/recipes-stable.js';
import RecipesExperimental from '@refinio/one.models/lib/recipes/recipes-experimental.js';
import SingleUserNoAuth from '@refinio/one.models/lib/models/Authenticator/SingleUserNoAuth.js';
import {
    ReverseMapsStable,
    ReverseMapsForIdObjectsStable
} from '@refinio/one.models/lib/recipes/reversemaps-stable.js';
import {
    ReverseMapsExperimental,
    ReverseMapsForIdObjectsExperimental
} from '@refinio/one.models/lib/recipes/reversemaps-experimental.js';
import type {AnyObjectResult} from '@refinio/one.models/lib/misc/ObjectEventDispatcher.js';
import {objectEvents} from '@refinio/one.models/lib/misc/ObjectEventDispatcher.js';
import GroupModel from '@refinio/one.models/lib/models/Leute/GroupModel.js';
import {storeVersionedObject, getObjectByIdHash} from '@refinio/one.core/lib/storage-versioned-objects.js';
import {getIdObject} from '@refinio/one.core/lib/storage-versioned-objects.js';
import {getObject} from '@refinio/one.core/lib/storage-unversioned-objects.js';
import {createAccess} from '@refinio/one.core/lib/access.js';
import {calculateHashOfObj, calculateIdHashOfObj} from '@refinio/one.core/lib/util/object.js';
import {createDefaultKeys, hasDefaultKeys} from '@refinio/one.core/lib/keychain/keychain.js';

// LAMA core handlers (platform-agnostic business logic - AI-related)
import {AIHandler} from '@lama/core/handlers/AIHandler';
import {AIAssistantHandler} from '@lama/core/handlers/AIAssistantHandler';
import {TopicAnalysisHandler} from '@lama/core/handlers/TopicAnalysisHandler';
import {ProposalsHandler} from '@lama/core/handlers/ProposalsHandler';
import {KeywordDetailHandler} from '@lama/core/handlers/KeywordDetailHandler';
import {WordCloudSettingsHandler} from '@lama/core/handlers/WordCloudSettingsHandler';
import {LLMConfigHandler} from '@lama/core/handlers/LLMConfigHandler';
import {CryptoHandler} from '@lama/core/handlers/CryptoHandler';
import {AuditHandler} from '@lama/core/handlers/AuditHandler';

// LAMA core AI models (message listener)
import {AIMessageListener} from '@lama/core/models/ai';

// Proposal services
import {ProposalEngine} from '@lama/core/services/proposal-engine';
import {ProposalRanker} from '@lama/core/services/proposal-ranker';
import {ProposalCache} from '@lama/core/services/proposal-cache';

// Chat core handlers (platform-agnostic business logic - chat-related)
import {ChatHandler} from '@chat/core/handlers/ChatHandler.js';
import {ContactsHandler} from '@chat/core/handlers/ContactsHandler.js';
import {ExportHandler} from '@chat/core/handlers/ExportHandler.js';
import {FeedForwardHandler} from '@chat/core/handlers/FeedForwardHandler.js';
import {IOMHandler} from '@chat/core/handlers/IOMHandler.js';

// LAMA core models
import TopicAnalysisModel from '@lama/core/one-ai/models/TopicAnalysisModel';

// Chat core models
import TopicGroupManager from '@chat/core/models/TopicGroupManager.js';

// LAMA core recipes
import {SubjectRecipe} from '@lama/core/one-ai/recipes/SubjectRecipe';
import {KeywordRecipe} from '@lama/core/one-ai/recipes/KeywordRecipe';
import {SummaryRecipe} from '@lama/core/one-ai/recipes/SummaryRecipe';
import {KeywordAccessStateRecipe} from '@lama/core/one-ai/recipes/KeywordAccessState';
import {WordCloudSettingsRecipe} from '@lama/core/one-ai/recipes/WordCloudSettingsRecipe';
import {LLMRecipe} from '@lama/core/recipes/LLMRecipe';

// LAMA core models (LLM object management)
import {LLMObjectManager} from '@lama/core/models/LLMObjectManager';

// Browser platform adapters
import {browserOllamaValidator, browserConfigManager} from '../../../adapters/browser-llm-config';
import {BrowserLLMPlatform} from '../../../adapters/browser-llm-platform';
import {LLMManager} from '@lama/core/services/llm-manager';

export default class Model {
    public onOneModelsReady = new OEvent<() => void>();
    public initialized: boolean = false;
    public ownerId: string | null = null;

    constructor(commServerUrl: string) {
        console.log('[Model] Constructing LAMA Browser Model...');

        // Setup basic ONE.core models (following one.leute pattern)
        this.leuteModel = new LeuteModel(commServerUrl, true);
        this.channelManager = new ChannelManager(this.leuteModel);
        this.topicModel = new TopicModel(this.channelManager, this.leuteModel);
        this.connections = new ConnectionsModel(this.leuteModel, {
            commServerUrl,
            acceptIncomingConnections: true,
            acceptUnknownInstances: true,
            acceptUnknownPersons: false,
            allowPairing: true,
            allowDebugRequests: true,
            pairingTokenExpirationDuration: 60000 * 15, // 15 minutes
            establishOutgoingConnections: true
        });

        // Initialize SingleUserNoAuth with all recipes
        // CRITICAL: Do NOT pass CORE_RECIPES - they're auto-added by SingleUserNoAuth internally
        this.one = new SingleUserNoAuth({
            recipes: [
                ...RecipesStable,
                ...RecipesExperimental,
                // LAMA recipes
                SubjectRecipe,
                KeywordRecipe,
                SummaryRecipe,
                KeywordAccessStateRecipe,
                WordCloudSettingsRecipe,
                LLMRecipe
            ],
            reverseMaps: new Map([
                ...ReverseMapsStable,
                ...ReverseMapsExperimental
                // TODO: Add LAMA reverse maps if needed
            ]),
            reverseMapsForIdObjects: new Map([
                ...ReverseMapsForIdObjectsStable,
                ...ReverseMapsForIdObjectsExperimental
                // TODO: Add LAMA reverse maps for ID objects if needed
            ]),
            storageInitTimeout: 20000
        });

        // LAMA-specific models (will be initialized in init() after topicModel and channelManager are ready)
        // TopicAnalysisModel requires topicModel and channelManager in constructor
        this.topicAnalysisModel = null as any; // Will be created in init()

        // LLM management (browser platform) - MUST be created before AIAssistantHandler
        const llmPlatform = new BrowserLLMPlatform();
        this.llmManager = new LLMManager(llmPlatform);
        console.log('[Model] Created LLMManager with BrowserLLMPlatform');

        // Create dependencies first (before AIAssistantHandler needs them)
        // TopicGroupManager needs oneCore instance + storageDeps
        this.topicGroupManager = new TopicGroupManager(
            this, // OneCoreInstance (Model implements this)
            {
                storeVersionedObject,
                getObjectByIdHash,
                getObject,
                createAccess,
                calculateIdHashOfObj,
                calculateHashOfObj
            }
        );
        this.llmConfigHandler = new LLMConfigHandler(this, browserOllamaValidator, browserConfigManager);

        // LLMObjectManager - platform-agnostic LLM object management using ONE.core abstractions
        this.llmObjectManager = new LLMObjectManager(
            {
                storeVersionedObject,
                createAccess
            }
            // No federation group for browser (optional parameter)
        );

        // LAMA handlers (AI-related)
        this.aiHandler = new AIHandler(this);

        // AIAssistantHandler with all dependencies ready
        this.aiAssistantModel = new AIAssistantHandler({
            oneCore: this,
            channelManager: this.channelManager,
            topicModel: this.topicModel,
            leuteModel: this.leuteModel,
            llmManager: this.llmManager,
            platform: llmPlatform,
            stateManager: undefined, // Optional - not used in browser
            llmObjectManager: this.llmObjectManager, // Platform-agnostic LLM object manager
            contextEnrichmentService: undefined, // Optional - not used in browser
            topicAnalysisModel: undefined, // Will be set during init()
            topicGroupManager: this.topicGroupManager,
            settingsPersistence: undefined, // Optional - use llmConfigHandler instead
            llmConfigHandler: this.llmConfigHandler,
            storageDeps: {
                storeVersionedObject,
                getIdObject,
                createDefaultKeys,
                hasDefaultKeys
            }
        });

        // topicAnalysisHandler, proposalsHandler, and aiMessageListener will be created in init()
        this.topicAnalysisHandler = null as any;
        this.proposalsHandler = null as any;
        this.aiMessageListener = null; // Created in init() after aiAssistantModel
        this.keywordDetailHandler = new KeywordDetailHandler(this);
        this.wordCloudSettingsHandler = new WordCloudSettingsHandler(this);
        this.cryptoHandler = new CryptoHandler(this);
        this.auditHandler = new AuditHandler(this);

        // Chat handlers (chat-related from chat.core)
        this.chatHandler = new ChatHandler(this);
        this.contactsHandler = new ContactsHandler(this);
        this.exportHandler = new ExportHandler(this);
        this.feedForwardHandler = new FeedForwardHandler(this);
        this.iomHandler = new IOMHandler(this);

        // Setup event handler that initialize the models when somebody logged in
        // and shuts down the model when somebody logs out.
        this.one.onLogin(this.init.bind(this));
        this.one.onLogout(this.shutdown.bind(this));

        console.log('[Model] Model construction complete');
    }

    /**
     * Initialize all models after login
     */
    public async init(_instanceName: string, _secret: string): Promise<void> {
        try {
            console.log('[Model] ===== LOGIN EVENT: Initializing models (Instance created) =====');

            // Setup object event dispatcher priority override
            objectEvents.determinePriorityOverride = (result: AnyObjectResult) => {
                if (result.obj.$type$ === 'Person') {
                    return 11;
                }
                if (result.obj.$type$ === 'Profile') {
                    return 10;
                }
                return 0;
            };

            await objectEvents.init();

            // Initialize contact model (base for identity handling)
            await this.leuteModel.init();

            // Create standard groups
            const binGroup = await this.leuteModel.createGroup('bin');
            const everyoneGroup = await GroupModel.constructFromLatestProfileVersionByGroupName(
                LeuteModel.EVERYONE_GROUP_NAME
            );

            // Give the main identity the ability to define trusted keys
            const myMainId = await this.leuteModel.myMainIdentity();
            await this.leuteModel.trust.certify(
                'RightToDeclareTrustedKeysForEverybodyCertificate',
                {
                    beneficiary: myMainId
                }
            );

            // Set ownerId for handlers
            this.ownerId = myMainId;

            // Initialize core models
            await this.channelManager.init();

            // Create the 'lama' channel for LLM config storage
            // Use myMainId as the owner since LLM config is per-user
            await this.channelManager.createChannel('lama', myMainId);
            console.log('[Model] Created lama channel for LLM config storage');

            await this.topicModel.init();
            await this.connections.init();

            // Initialize LAMA-specific models (create TopicAnalysisModel now that dependencies are ready)
            this.topicAnalysisModel = new TopicAnalysisModel(this.channelManager, this.topicModel);
            await this.topicAnalysisModel.init();

            // Create TopicAnalysisHandler now that topicAnalysisModel is ready
            this.topicAnalysisHandler = new TopicAnalysisHandler(this.topicAnalysisModel);

            // Create ProposalsHandler with all dependencies
            const proposalEngine = new ProposalEngine(this.topicAnalysisModel);
            const proposalRanker = new ProposalRanker();
            const proposalCache = new ProposalCache();
            this.proposalsHandler = new ProposalsHandler(
                this, // nodeOneCore
                this.topicAnalysisModel,
                proposalEngine,
                proposalRanker,
                proposalCache
            );
            console.log('[Model] ✅ ProposalsHandler initialized');

            // Initialize LLM manager (discover models, load config, etc.)
            console.log('[Model] Initializing LLM manager...');
            await this.llmManager.init();
            console.log('[Model] ✅ LLM manager initialized');

            // Initialize LAMA handlers (AI-related)
            await this.aiHandler.init?.();
            await this.aiAssistantModel.init?.();

            // Create and start AIMessageListener (listens for new messages and triggers AI responses)
            this.aiMessageListener = new AIMessageListener({
                channelManager: this.channelManager,
                topicModel: this.topicModel,
                aiHandler: this.aiAssistantModel,
                ownerId: myMainId
            });
            await this.aiMessageListener.start();
            console.log('[Model] ✅ AIMessageListener started');

            await this.topicAnalysisHandler.init?.();
            await this.proposalsHandler.init?.();
            await this.keywordDetailHandler.init?.();
            await this.wordCloudSettingsHandler.init?.();
            await this.llmConfigHandler.init?.();
            await this.cryptoHandler.init?.();
            await this.auditHandler.init?.();

            // Initialize chat handlers
            await this.chatHandler.init?.();
            await this.contactsHandler.init?.();
            await this.exportHandler.init?.();
            await this.feedForwardHandler.init?.();
            await this.iomHandler.init?.();
            // NOTE: topicGroupManager has no init() method

            // Mark as initialized for handlers
            this.initialized = true;

            console.log('[Model] ===== All models initialized - ready for use =====');
            this.onOneModelsReady.emit();
        } catch (e) {
            console.error('[Model] Models init failed:', e);
            this.initialized = false;
            // Shutdown all models when initialization failed
            await this.shutdown().catch(console.error);
            throw e;
        }
    }

    /**
     * ONE.core storage method - required by handlers
     * Wraps the imported getObjectByIdHash function
     */
    public getObjectByIdHash = getObjectByIdHash;

    /**
     * Shutdown all models
     */
    public async shutdown(): Promise<void> {
        console.log('[Model] Shutting down models...');

        // Mark as not initialized
        this.initialized = false;
        this.ownerId = null;

        // Shutdown in reverse order
        const shutdownSteps = [
            () => this.auditHandler.shutdown?.(),
            () => this.cryptoHandler.shutdown?.(),
            () => this.llmConfigHandler.shutdown?.(),
            () => this.wordCloudSettingsHandler.shutdown?.(),
            () => this.keywordDetailHandler.shutdown?.(),
            () => this.proposalsHandler.shutdown?.(),
            () => this.topicAnalysisHandler.shutdown?.(),
            () => this.aiMessageListener?.stop(),
            () => this.aiAssistantModel.shutdown?.(),
            () => this.aiHandler.shutdown?.(),
            () => this.iomHandler.shutdown?.(),
            () => this.feedForwardHandler.shutdown?.(),
            () => this.exportHandler.shutdown?.(),
            () => this.contactsHandler.shutdown?.(),
            () => this.chatHandler.shutdown?.(),
            () => this.topicGroupManager.shutdown?.(),
            () => this.llmManager.shutdown?.(),
            () => this.topicAnalysisModel.shutdown(),
            () => this.connections.shutdown(),
            () => this.topicModel.shutdown(),
            () => this.channelManager.shutdown(),
            () => this.leuteModel.shutdown(),
            () => objectEvents.shutdown()
        ];

        for (const shutdownStep of shutdownSteps) {
            try {
                await shutdownStep();
            } catch (e) {
                console.error('[Model] Shutdown error:', e);
            }
        }

        console.log('[Model] Shutdown complete');
    }

    // ONE.core models
    public one: SingleUserNoAuth;
    public leuteModel: LeuteModel;
    public channelManager: ChannelManager;
    public topicModel: TopicModel;
    public connections: ConnectionsModel;

    // LAMA models
    public topicAnalysisModel: TopicAnalysisModel;

    // LAMA handlers (AI-related from lama.core)
    public aiHandler: AIHandler;
    public aiAssistantModel: AIAssistantHandler;
    public aiMessageListener: AIMessageListener | null;
    public topicAnalysisHandler: TopicAnalysisHandler;
    public proposalsHandler: ProposalsHandler;
    public keywordDetailHandler: KeywordDetailHandler;
    public wordCloudSettingsHandler: WordCloudSettingsHandler;
    public llmConfigHandler: LLMConfigHandler;
    public cryptoHandler: CryptoHandler;
    public auditHandler: AuditHandler;

    // Chat handlers (chat-related from chat.core)
    public chatHandler: ChatHandler;
    public contactsHandler: ContactsHandler;
    public exportHandler: ExportHandler;
    public feedForwardHandler: FeedForwardHandler;
    public iomHandler: IOMHandler;

    // Chat models
    public topicGroupManager: TopicGroupManager;

    // LLM services
    public llmManager: LLMManager;
    public llmObjectManager: LLMObjectManager;
}

// Global model instance (following one.leute pandorasModel pattern)
let globalModel: Model | null = null;

export function setGlobalModel(model: Model) {
    globalModel = model;
}

/**
 * Get the global model instance
 * This allows components to access the model without prop drilling
 *
 * @throws Error if model not initialized
 */
export function getModel(): Model {
    if (!globalModel) {
        throw new Error('Model not initialized - call setGlobalModel() first');
    }
    return globalModel;
}
