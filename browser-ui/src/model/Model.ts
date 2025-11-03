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
  // First import - this is correct
  (versionedObjects as any).__INSTANCE_ID = 'MODEL_TS_' + Date.now();
  console.log('[Model.ts] INSTANCE CHECK: ✅ Created NEW instance ID (first import):', (versionedObjects as any).__INSTANCE_ID);
} else {
  // Instance ID already exists - means duplicate module import!
  console.log('[Model.ts] INSTANCE CHECK: ⚠️  DUPLICATE MODULE! Already has instance ID:', (versionedObjects as any).__INSTANCE_ID);
  console.log('[Model.ts] INSTANCE CHECK: This means ONE.core was imported twice - check vite.config deduplication');
}
console.log('[Model.ts] INSTANCE CHECK: versionedObjects size:', versionedObjects.size);

import ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js';
import ConnectionsModel from '@refinio/one.models/lib/models/ConnectionsModel.js';
import LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';
import TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js';
import {OEvent} from '@refinio/one.models/lib/misc/OEvent.js';
import RecipesStable from '@refinio/one.models/lib/recipes/recipes-stable.js';
import RecipesExperimental from '@refinio/one.models/lib/recipes/recipes-experimental.js';
import MultiUser from '@refinio/one.models/lib/models/Authenticator/MultiUser.js';
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
import {getObject, storeUnversionedObject} from '@refinio/one.core/lib/storage-unversioned-objects.js';
import {createAccess} from '@refinio/one.core/lib/access.js';
import {SET_ACCESS_MODE} from '@refinio/one.core/lib/storage-base-common.js';
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

// Chat core services (contact creation, P2P topics)
import {handleReceivedProfile, ensureContactExists} from '@chat/core/services/ContactCreation.js';
import {autoCreateP2PTopicAfterPairing} from '@chat/core/services/P2PTopicService.js';

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

// connection.core integration - DISABLED: Browser adapters not implemented yet
// import {ConnectionManagerOneCore} from '@lama/connection.core';
// import {
//     BrowserOneCoreAdapter,
//     BrowserTransportFactory,
//     BrowserIndexedDBStorage,
//     BrowserUICallbacks
// } from '@lama/connection.core/adapters/browser';

export default class Model {
    public onOneModelsReady = new OEvent<() => void>();
    public initialized: boolean = false;
    public ownerId: string | null = null;
    private commServerUrl: string;

    constructor(commServerUrl: string) {
        this.commServerUrl = commServerUrl;
        console.log('[Model] Constructing LAMA Browser Model...');

        // Setup basic ONE.core models (following one.leute pattern)
        // Pass false for autoInit - let CoreInitializer handle initialization
        this.leuteModel = new LeuteModel(commServerUrl, false);
        this.channelManager = new ChannelManager(this.leuteModel);
        this.topicModel = new TopicModel(this.channelManager, this.leuteModel);

        // Initialize MultiUser with all recipes
        // CRITICAL: Do NOT pass CORE_RECIPES - they're auto-added by MultiUser internally
        this.one = new MultiUser({
            directory: 'lama.browser.storage', // Storage location for browser
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

        // Create TopicGroupManager BEFORE ConnectionsModel (needed for filters)
        // TopicGroupManager needs oneCore instance + storageDeps
        this.topicGroupManager = new TopicGroupManager(
            this, // OneCoreInstance (Model implements this)
            {
                storeVersionedObject,
                storeUnversionedObject,
                getObjectByIdHash,
                getObject,
                createAccess,
                calculateIdHashOfObj,
                calculateHashOfObj
            }
        );

        // Create ConnectionsModel with filters from TopicGroupManager
        this.connections = new ConnectionsModel(this.leuteModel, {
            commServerUrl,
            acceptIncomingConnections: true,
            acceptUnknownInstances: true,
            acceptUnknownPersons: false,
            allowPairing: true,
            allowDebugRequests: true,
            pairingTokenExpirationDuration: 60000 * 15, // 15 minutes
            establishOutgoingConnections: true,
            objectFilter: this.topicGroupManager.createObjectFilter(),   // Outbound: allowlist of Groups we created
            importFilter: this.topicGroupManager.createImportFilter()    // Inbound: validate certificates from trusted people
        });

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
            llmConfigHandler: undefined, // Will be set right after
            storageDeps: {
                storeVersionedObject,
                getIdObject,
                createDefaultKeys,
                hasDefaultKeys
            }
        });

        // Create LLMConfigHandler now that aiAssistantModel exists
        this.llmConfigHandler = new LLMConfigHandler(this, this.aiAssistantModel, browserOllamaValidator, browserConfigManager);

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
        // Fail fast: Don't allow double-init
        if (this.initialized) {
            throw new Error('Model already initialized - call shutdown() first before re-initializing');
        }

        try {
            console.log('[Model] ===== LOGIN EVENT: Initializing models (Instance created) =====');
            console.log('[Model] 🔍 PERSISTENCE DEBUG: Owner context now available, IndexedDB will be owner-specific');

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

            // Setup CHUM listeners for contact creation
            console.log('[Model] Setting up CHUM listeners for contact creation...');
            objectEvents.onNewVersion(async (result: AnyObjectResult) => {
                const obj = result.obj as any;

                // Handle Profile objects received via CHUM
                if (obj.$type$ === 'Profile' && obj.personId) {
                    console.log('[Model] 📨 BROWSER: Received Profile via CHUM!', {
                        personId: obj.personId?.substring(0, 8),
                        name: obj.name || 'No name'
                    });

                    // Only process if LeuteModel is initialized
                    if (this.leuteModel && this.leuteModel.state?.currentState === 'Initialised') {
                        try {
                            await handleReceivedProfile(obj.personId, obj, this.leuteModel);
                            console.log('[Model] ✅ Handled received Profile data');
                        } catch (error) {
                            console.error('[Model] Failed to handle received Profile:', error);
                        }
                    } else {
                        console.log('[Model] ⏸️  Skipping Profile - LeuteModel not yet initialized');
                    }
                }

                // Handle Person objects received via CHUM
                if (obj.$type$ === 'Person' && obj.email) {
                    console.log('[Model] 📨 BROWSER: Received Person via CHUM!', {
                        email: obj.email,
                        idHash: result.idHash ? String(result.idHash).substring(0, 8) : undefined
                    });

                    // Only process if LeuteModel is initialized
                    if (this.leuteModel && this.leuteModel.state?.currentState === 'Initialised') {
                        try {
                            // Store the Person object to ensure vheads file is created
                            const storeResult = await storeVersionedObject(obj);
                            console.log('[Model] ✅ Stored Person object (vheads created):', storeResult.idHash?.toString()?.substring(0, 8));

                            // Ensure a contact exists for this Person
                            await ensureContactExists(result.idHash as any, this.leuteModel, {
                                displayName: obj.email?.split('@')[0]
                            });
                            console.log('[Model] ✅ Ensured contact exists for Person');
                        } catch (error) {
                            console.error('[Model] Failed to handle received Person:', error);
                        }
                    } else {
                        console.log('[Model] ⏸️  Skipping Person - LeuteModel not yet initialized');
                    }
                }
            });
            console.log('[Model] ✅ CHUM listeners registered');

            // Use centralized initialization from lama.core
            // This enforces correct order: LeuteModel → LLM → Channels → Topics
            const { initializeCoreModels } = await import('@lama/core/initialization/CoreInitializer.ts');

            await initializeCoreModels({
                oneCore: this,
                leuteModel: this.leuteModel,
                channelManager: this.channelManager,
                topicModel: this.topicModel,
                connections: this.connections,
                llmManager: this.llmManager,
                llmObjectManager: this.llmObjectManager,
                aiAssistantModel: this.aiAssistantModel,
                chatHandler: this.chatHandler,
                topicAnalysisModel: this.topicAnalysisModel,
                topicGroupManager: this.topicGroupManager
            }, (progress) => {
                console.log(`[Model] Init progress: ${progress.stage} (${progress.percent}%) - ${progress.message}`);
            });

            // Now that LeuteModel is initialized, set up profile and groups
            const me = await this.leuteModel.me();
            const myMainId = await this.leuteModel.myMainIdentity();
            const myProfile = await me.mainProfile();

            // Set ownerId for handlers
            this.ownerId = myMainId;

            // CRITICAL: Ensure profile has OneInstanceEndpoint for pairing (needed for IoP connections)
            console.log('[Model] Ensuring profile has OneInstanceEndpoint...');
            if (myProfile) {
                // Check if OneInstanceEndpoint exists using the communicationEndpoints property
                const hasEndpoint = myProfile.communicationEndpoints.some(
                    (ep: any) => ep.$type$ === 'OneInstanceEndpoint'
                );

                if (!hasEndpoint) {
                    console.log('[Model] Profile missing OneInstanceEndpoint, adding it now...');
                    const {getInstanceIdHash} = await import('@refinio/one.core/lib/instance.js');
                    const {getDefaultKeys} = await import('@refinio/one.core/lib/keychain/keychain.js');

                    const instanceId = getInstanceIdHash();
                    if (instanceId) {
                        const personKeys = await getDefaultKeys(myMainId);
                        const instanceKeys = await getDefaultKeys(instanceId);

                        const endpoint = {
                            $type$: 'OneInstanceEndpoint' as const,
                            personId: myMainId,
                            url: this.commServerUrl,
                            instanceId: instanceId,
                            instanceKeys: instanceKeys,
                            personKeys: personKeys
                        };

                        // Add to the array and save
                        myProfile.communicationEndpoints.push(endpoint);
                        await myProfile.saveAndLoad();
                        console.log('[Model] ✅ OneInstanceEndpoint added to profile');
                    }
                } else {
                    console.log('[Model] ✅ Profile already has OneInstanceEndpoint');
                }
            }

            // Create standard groups
            const binGroup = await this.leuteModel.createGroup('bin');

            // Get or create everyone group
            let everyoneGroup: GroupModel;
            try {
                everyoneGroup = await GroupModel.constructFromLatestProfileVersionByGroupName(
                    LeuteModel.EVERYONE_GROUP_NAME
                );
            } catch (error) {
                // Group doesn't exist yet, create it
                console.log('[Model] Everyone group not found, creating it...');
                everyoneGroup = await this.leuteModel.createGroup(LeuteModel.EVERYONE_GROUP_NAME);
            }

            // Share main profile with everyone group (enables IoP contact pairing)
            console.log('[Model] Sharing main profile with everyone group for IoP pairing...');
            try {
                await createAccess([{
                    id: myProfile.idHash,
                    person: [],
                    group: [everyoneGroup.groupIdHash],
                    mode: SET_ACCESS_MODE.ADD
                }]);
                console.log('[Model] ✅ Main profile shared with everyone group');
            } catch (error) {
                console.error('[Model] ❌ Failed to share profile with everyone group:', error);
            }

            // Give the main identity the ability to define trusted keys
            await this.leuteModel.trust.certify(
                'RightToDeclareTrustedKeysForEverybodyCertificate',
                {
                    beneficiary: myMainId
                }
            );

            // Create the 'lama' channel for LLM config storage
            // Use myMainId as the owner since LLM config is per-user
            await this.channelManager.createChannel('lama', myMainId);
            console.log('[Model] Created lama channel for LLM config storage');

            // Initialize connection.core integration - DISABLED: Browser adapters not implemented yet
            // console.log('[Model] Initializing connection.core integration...');
            // const oneCoreAdapter = new BrowserOneCoreAdapter(
            //     this.leuteModel,
            //     this.channelManager,
            //     this.connections,
            //     this.topicModel
            // );
            // const transportFactory = new BrowserTransportFactory();
            // const storage = new BrowserIndexedDBStorage();
            // const uiCallbacks = new BrowserUICallbacks();

            // this.connectionManagerOneCore = new ConnectionManagerOneCore({
            //     transport: transportFactory,
            //     storage: storage,
            //     ui: uiCallbacks
            // });
            // this.connectionManagerOneCore.setOneCoreAdapter(oneCoreAdapter);
            // console.log('[Model] ✅ connection.core integration initialized');

            // Setup pairing success handler to auto-create P2P topics
            if (this.connections.pairing && (this.connections.pairing as any).onPairingSuccess) {
                console.log('[Model] Setting up pairing success handler for P2P topic creation...');
                (this.connections.pairing as any).onPairingSuccess(async (initiatedLocally: boolean, localPersonId: any, localInstanceId: any, remotePersonId: any, remoteInstanceId: any, token: any) => {
                    console.log('[Model] ✅ PAIRING SUCCESS - Auto-creating P2P topic');
                    console.log('[Model]   Initiated locally:', initiatedLocally);
                    console.log('[Model]   Local person:', localPersonId?.substring(0, 8));
                    console.log('[Model]   Remote person:', remotePersonId?.substring(0, 8));

                    try {
                        // Use chat.core's P2PTopicService to create the topic
                        await autoCreateP2PTopicAfterPairing({
                            topicModel: this.topicModel,
                            channelManager: this.channelManager,
                            localPersonId,
                            remotePersonId,
                            initiatedLocally,
                            sendWelcomeMessage: initiatedLocally
                        });
                        console.log('[Model] ✅ P2P topic created successfully');
                    } catch (error) {
                        console.error('[Model] Failed to auto-create P2P topic:', error);
                    }
                });
                console.log('[Model] ✅ Pairing success handler registered');
            } else {
                console.warn('[Model] ⚠️  Pairing model not available - P2P topics won\'t be auto-created');
            }

            // Initialize LAMA-specific models (create TopicAnalysisModel now that dependencies are ready)
            this.topicAnalysisModel = new TopicAnalysisModel(this.channelManager, this.topicModel);
            await this.topicAnalysisModel.init();

            // CRITICAL: Inject topicAnalysisModel into AIMessageProcessor so it can create subjects
            // The aiAssistantModel was created with topicAnalysisModel: undefined (line 214)
            // Now that topicAnalysisModel exists, we need to inject it
            if (this.aiAssistantModel.messageProcessor) {
                console.log('[Model] 💉 Injecting topicAnalysisModel into AIMessageProcessor');
                (this.aiAssistantModel.messageProcessor as any).topicAnalysisModel = this.topicAnalysisModel;
            }

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

            // Check if user has a saved default model and create chats if needed
            // (AI was already initialized earlier, before channels)
            const savedDefaultModel = this.aiAssistantModel.topicManager.getDefaultModel();
            if (savedDefaultModel) {
                console.log('[Model] Found saved default model:', savedDefaultModel);

                // Validate that the saved model still exists and is available
                const availableModels = this.llmManager.getAvailableModels();
                const modelExists = availableModels.some((m: any) => m.id === savedDefaultModel);

                if (modelExists) {
                    // Call setDefaultModel to trigger chat creation
                    try {
                        await this.llmConfigHandler.setConfig({ defaultModelId: savedDefaultModel });
                        console.log('[Model] ✅ Default model restored and chats ensured');
                    } catch (error) {
                        console.error('[Model] ❌ Failed to restore default model and create chats:', error);
                        // Clear the problematic model and continue initialization
                        this.aiAssistantModel.topicManager.setDefaultModel('');
                        console.warn('[Model] Cleared problematic model - user will need to reselect');
                    }
                } else {
                    console.warn('[Model] ⚠️ Saved model no longer available:', savedDefaultModel);
                    console.warn('[Model] Available models:', availableModels.map((m: any) => m.id));
                    // Clear the invalid saved model
                    this.aiAssistantModel.topicManager.setDefaultModel('');
                    console.log('[Model] Cleared invalid model - user will select via onboarding');
                }
            } else {
                console.log('[Model] No saved default model - user will select via onboarding');
            }

            // Create and start AIMessageListener (listens for new messages and triggers AI responses)
            this.aiMessageListener = new AIMessageListener({
                channelManager: this.channelManager,
                topicModel: this.topicModel,
                aiHandler: this.aiAssistantModel,
                ownerId: myMainId
            });
            await this.aiMessageListener.start();
            console.log('[Model] ✅ AIMessageListener started');

            // Initialize remaining handlers (core models already initialized via CoreInitializer)
            await this.topicAnalysisHandler.init?.();
            await this.proposalsHandler.init?.();
            await this.keywordDetailHandler.init?.();
            await this.wordCloudSettingsHandler.init?.();
            await this.llmConfigHandler.init?.();
            await this.cryptoHandler.init?.();
            await this.auditHandler.init?.();

            // Chat handlers (chatHandler already initialized via CoreInitializer)
            await this.contactsHandler.init?.();
            await this.exportHandler.init?.();
            await this.feedForwardHandler.init?.();
            await this.iomHandler.init?.();
            // NOTE: topicGroupManager has no init() method

            // Initialize AIHandler with all dependencies
            console.log('[Model] Initializing AIHandler with dependencies...');
            this.aiHandler.setModels(
                this.llmManager,
                this.aiAssistantModel,
                this.topicModel,
                this, // nodeOneCore
                undefined // stateManager (not used in browser)
            );
            console.log('[Model] ✅ AIHandler initialized');

            // Mark as initialized for handlers
            this.initialized = true;
            console.log('[Model] 🔍 PERSISTENCE DEBUG: Models initialized, storage should now persist all data');

            // Check IndexedDB databases
            if (typeof indexedDB !== 'undefined' && 'databases' in indexedDB) {
                indexedDB.databases().then(dbs => {
                    console.log('[Model] 🔍 IndexedDB databases after init:', dbs.map(db => `${db.name} (v${db.version})`))
                }).catch(err => {
                    console.error('[Model] Failed to list databases:', err)
                })
            }

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

        // Shutdown platform-specific handlers first
        const platformHandlers = [
            { name: 'AuditHandler', fn: () => this.auditHandler?.shutdown?.() },
            { name: 'CryptoHandler', fn: () => this.cryptoHandler?.shutdown?.() },
            { name: 'LLMConfigHandler', fn: () => this.llmConfigHandler?.shutdown?.() },
            { name: 'WordCloudSettingsHandler', fn: () => this.wordCloudSettingsHandler?.shutdown?.() },
            { name: 'KeywordDetailHandler', fn: () => this.keywordDetailHandler?.shutdown?.() },
            { name: 'ProposalsHandler', fn: () => this.proposalsHandler?.shutdown?.() },
            { name: 'TopicAnalysisHandler', fn: () => this.topicAnalysisHandler?.shutdown?.() },
            { name: 'AIMessageListener', fn: () => this.aiMessageListener?.stop?.() },
            { name: 'AIHandler', fn: () => this.aiHandler?.shutdown?.() },
            { name: 'IOMHandler', fn: () => this.iomHandler?.shutdown?.() },
            { name: 'FeedForwardHandler', fn: () => this.feedForwardHandler?.shutdown?.() },
            { name: 'ExportHandler', fn: () => this.exportHandler?.shutdown?.() },
            { name: 'ContactsHandler', fn: () => this.contactsHandler?.shutdown?.() },
        ];

        for (const handler of platformHandlers) {
            try {
                await handler.fn();
            } catch (error) {
                console.error(`[Model] Shutdown error (${handler.name}):`, error);
            }
        }

        // Use centralized shutdown from lama.core for core models
        const { shutdownCoreModels } = await import('@lama/core/initialization/CoreInitializer.ts');
        await shutdownCoreModels({
            oneCore: this,
            leuteModel: this.leuteModel,
            channelManager: this.channelManager,
            topicModel: this.topicModel,
            connections: this.connections,
            llmManager: this.llmManager,
            llmObjectManager: this.llmObjectManager,
            aiAssistantModel: this.aiAssistantModel,
            chatHandler: this.chatHandler,
            topicAnalysisModel: this.topicAnalysisModel,
        });

        // Shutdown ObjectEventDispatcher
        await objectEvents.shutdown();
        console.log('[Model] ✅ ObjectEventDispatcher shutdown');

        // ONLY mark as uninitialized if shutdown completed successfully
        // If any step above threw, this won't execute and initialized stays true
        this.initialized = false;
        this.ownerId = null;

        console.log('[Model] Shutdown complete');
    }

    // ONE.core models
    public one: MultiUser;
    public leuteModel: LeuteModel;
    public channelManager: ChannelManager;
    public topicModel: TopicModel;
    public connections: ConnectionsModel;

    // connection.core integration - DISABLED: Browser adapters not implemented yet
    // public connectionManagerOneCore!: ConnectionManagerOneCore;

    // Alias for IOMHandler compatibility (expects connectionsModel)
    public get connectionsModel() {
        return this.connections;
    }

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
