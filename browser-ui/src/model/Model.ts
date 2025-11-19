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
import PropertyTreeStore from '@refinio/one.models/lib/models/SettingsModel.js';
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
import ProfileModel from '@refinio/one.models/lib/models/Leute/ProfileModel.js';
import {storeVersionedObject, getObjectByIdHash} from '@refinio/one.core/lib/storage-versioned-objects.js';
import {getIdObject} from '@refinio/one.core/lib/storage-versioned-objects.js';
import {getObject, storeUnversionedObject} from '@refinio/one.core/lib/storage-unversioned-objects.js';
import {getAllEntries} from '@refinio/one.core/lib/reverse-map-query.js';
import {createAccess} from '@refinio/one.core/lib/access.js';
import {SET_ACCESS_MODE} from '@refinio/one.core/lib/storage-base-common.js';
import {calculateHashOfObj, calculateIdHashOfObj} from '@refinio/one.core/lib/util/object.js';
import {createDefaultKeys, hasDefaultKeys} from '@refinio/one.core/lib/keychain/keychain.js';
import {getInstanceIdHash} from '@refinio/one.core/lib/instance.js';

// LAMA core plans (platform-agnostic business logic - AI-related)
import {AIPlan} from '@lama/core/plans/AIPlan';
import {AIAssistantPlan} from '@lama/core/plans/AIAssistantPlan';
import {TopicAnalysisPlan} from '@lama/core/plans/TopicAnalysisPlan';
import {ProposalsPlan} from '@lama/core/plans/ProposalsPlan';
import {KeywordDetailPlan} from '@lama/core/plans/KeywordDetailPlan';
import {WordCloudSettingsPlan} from '@lama/core/plans/WordCloudSettingsPlan';
import {LLMConfigPlan} from '@lama/core/plans/LLMConfigPlan';
import {CryptoPlan} from '@lama/core/plans/CryptoPlan';
import {AuditPlan} from '@lama/core/plans/AuditPlan';
import {JournalPlan} from '@lama/core/plans/JournalPlan';
import {SubjectsPlan} from '@lama/core/plans/SubjectsPlan';

// LAMA core services
import {SubjectService} from '@lama/core/services/SubjectService';

// LAMA core AI models (message listener)
import {AIMessageListener} from '@lama/core/models/ai';

// Proposal services
import {ProposalEngine} from '@lama/core/services/proposal-engine';
import {ProposalRanker} from '@lama/core/services/proposal-ranker';
import {ProposalCache} from '@lama/core/services/proposal-cache';

// Chat core plans (platform-agnostic business logic - chat-related)
import {ChatPlan} from '@chat/core/plans/ChatPlan.js';
import {GroupPlan} from '@chat/core/plans/GroupPlan.js';
import {ContactsPlan} from '@chat/core/plans/ContactsPlan.js';
import {ExportPlan} from '@chat/core/plans/ExportPlan.js';
import {FeedForwardPlan} from '@chat/core/plans/FeedForwardPlan.js';

// Plan system for assembly tracking
import {StoryFactory} from '@refinio/refinio-api/plan-system';
import {AssemblyPlan} from '@assembly/core';

// Connection core plans (platform-agnostic business logic - P2P connections and group chat)
import {ConnectionPlan, type TrustPlanDependencies, type PairingEventCallbacks} from '@connection/core/plans/ConnectionPlan.js';
import {GroupChatPlan, type GroupChatPlanDependencies} from '@connection/core/plans/GroupChatPlan.js';

// Trust core (platform-agnostic trust management)
import {TrustModel} from '@trust/core/models/TrustModel.js';
import {TrustPlan} from '@trust/core/plans/TrustPlan.js';

// Chat core services (contact creation, P2P topics)
import {handleReceivedProfile, ensureContactExists} from '@chat/core/services/ContactCreation.js';
import {autoCreateP2PTopicAfterPairing} from '@chat/core/services/P2PTopicService.js';

// LAMA core models
import TopicAnalysisModel from '@lama/core/one-ai/models/TopicAnalysisModel';

// Cube.core for dimensional indexing
// TODO: Re-enable when cube.core storage layer is implemented
import {
    // CubeStorage,
    // CustomDimensionManager,
    CubeObjectRecipe,
    DimensionRecipe,
    DimensionValueRecipe,
    QueryResultRecipe
} from '@cube/cube.core';

// Chat core models
import TopicGroupManager from '@chat/core/models/TopicGroupManager.js';

// LAMA core recipes
import {SubjectRecipe} from '@lama/core/one-ai/recipes/SubjectRecipe';
import {KeywordRecipe} from '@lama/core/one-ai/recipes/KeywordRecipe';
import {SummaryRecipe} from '@lama/core/one-ai/recipes/SummaryRecipe';
import {KeywordAccessStateRecipe} from '@lama/core/one-ai/recipes/KeywordAccessState';
import {WordCloudSettingsRecipe} from '@lama/core/one-ai/recipes/WordCloudSettingsRecipe';
import {AIRecipe} from '@lama/core/recipes/AIRecipe';
import {LLMRecipe} from '@lama/core/recipes/LLMRecipe';
import {ProposalConfigRecipe} from '@lama/core/recipes/ProposalConfigRecipe';
import {SubscriptionBalanceRecipe} from '../recipes/SubscriptionBalanceRecipe';
import {MessageReadStatusRecipe} from '../recipes/MessageReadStatusRecipe';
import {AvatarPreferenceRecipe} from '../recipes/AvatarPreferenceRecipe';
import {StoryRecipe} from '../recipes/StoryRecipe';

// Assembly.core recipes
import {AssemblyRecipe} from '@assembly/core/recipes/index.js';

// LAMA core models (LLM and AI object management)
import {LLMObjectManager} from '@lama/core/models/LLMObjectManager';
import {AIObjectManager} from '@lama/core/models/AIObjectManager';

// Trust core recipes (identity subscription system)
import {AllRecipes as TrustCoreRecipes, AllReverseMaps as TrustCoreReverseMaps} from '@trust/core/recipes/index.js';

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
    public onContactsChanged = new OEvent<() => void>();
    public onTopicsChanged = new OEvent<() => void>();
    public onConnectionsChanged = new OEvent<() => void>();
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

        // Settings model for storing secure configuration (API keys, etc.)
        // Uses ONE.core's encrypted storage (master key protection)
        this.settings = new PropertyTreeStore('lama.browser.settings');

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
                AIRecipe,
                LLMRecipe,
                ProposalConfigRecipe,
                SubscriptionBalanceRecipe,
                MessageReadStatusRecipe,
                AvatarPreferenceRecipe,
                StoryRecipe,  // Assembly tracking
                AssemblyRecipe,  // Assembly (Product) tracking
                // Trust.core recipes (identity subscription system)
                ...TrustCoreRecipes,
                // Cube.core recipes (dimensional storage)
                CubeObjectRecipe,
                DimensionRecipe,
                DimensionValueRecipe,
                QueryResultRecipe
            ],
            reverseMaps: new Map([
                ...ReverseMapsStable,
                ...ReverseMapsExperimental,
                // Trust.core reverse maps (identity subscription system)
                ...TrustCoreReverseMaps,
                // LAMA reverse maps for querying objects by owner
                ['LLM', new Set(['owner'])]
            ]),
            reverseMapsForIdObjects: new Map([
                ...ReverseMapsForIdObjectsStable,
                ...ReverseMapsForIdObjectsExperimental
                // ONE.core automatically creates reverse maps for versioned objects (isId: true)
            ]),
            storageInitTimeout: 20000
        });

        // LAMA-specific models (will be initialized in init() after topicModel and channelManager are ready)
        // TopicAnalysisModel requires topicModel and channelManager in constructor
        this.topicAnalysisModel = null as any; // Will be created in init()

        // LLM management (browser platform) - MUST be created before AIAssistantPlan
        const llmPlatform = new BrowserLLMPlatform();
        this.llmManager = new LLMManager(llmPlatform);

        // No CORS proxy needed - Anthropic API supports CORS natively
        // API calls are made directly from browser to api.anthropic.com

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
        const that = this; // Capture 'this' for closure
        this.llmObjectManager = new LLMObjectManager(
            {
                storeVersionedObject,
                createAccess,
                queryAllLLMObjects: async function* () {
                    // Query all LLM objects from storage using reverse map
                    // This is needed to restore AI contacts on reload
                    console.log('[Model/queryAllLLMObjects] 🔍 Step 1: Getting owner ID...');
                    const myId = await that.leuteModel.myMainIdentity();
                    console.log(`[Model/queryAllLLMObjects] 🔍 Step 2: Got owner ID: ${myId.substring(0, 8)}...`);

                    console.log(`[Model/queryAllLLMObjects] 🔍 Step 3: Calling getAllEntries(${myId.substring(0, 8)}, 'LLM')...`);
                    const llmEntries = await getAllEntries(myId, 'LLM');
                    console.log(`[Model/queryAllLLMObjects] 🔍 Step 4: getAllEntries returned ${llmEntries.length} LLM entries`);
                    console.log(`[Model/queryAllLLMObjects] 🔍 First entry structure:`, llmEntries[0]);

                    for (const entry of llmEntries) {
                        // getAllEntries returns objects with 'obj' property, not 'hash'
                        const objectHash = entry.obj || entry.hash || entry;
                        console.log(`[Model/queryAllLLMObjects] Processing entry:`, entry);
                        console.log(`[Model/queryAllLLMObjects] Extracted hash: ${objectHash?.toString().substring(0, 8)}...`);

                        // Get the actual LLM object using the hash from the reverse map entry
                        const llmObject = await getObject(objectHash);
                        console.log(`[Model/queryAllLLMObjects] Retrieved object:`, llmObject);
                        if (llmObject && llmObject.$type$ === 'LLM') {
                            console.log(`[Model/queryAllLLMObjects] Yielding LLM object: ${llmObject.name}`);
                            yield llmObject;
                        }
                    }
                    console.log(`[Model/queryAllLLMObjects] Query complete`);
                },
                getOwnerId: async () => {
                    return await that.leuteModel.myMainIdentity();
                }
            }
            // No federation group for browser (optional parameter)
        );

        // AIObjectManager - platform-agnostic AI object management
        this.aiObjectManager = new AIObjectManager(
            {
                storeVersionedObject,
                createAccess,
                queryAllAIObjects: async function* () {
                    // Query all AI objects from storage using reverse map
                    console.log('[Model/queryAllAIObjects] 🔍 Querying AI objects...');
                    const myId = await that.leuteModel.myMainIdentity();
                    const aiEntries = await getAllEntries(myId, 'AI');
                    console.log(`[Model/queryAllAIObjects] Found ${aiEntries.length} AI entries`);

                    for (const entry of aiEntries) {
                        const objectHash = entry.obj || entry.hash || entry;
                        const aiObject = await getObject(objectHash);
                        if (aiObject && aiObject.$type$ === 'AI') {
                            console.log(`[Model/queryAllAIObjects] Yielding AI object: ${aiObject.displayName}`);
                            yield aiObject;
                        }
                    }
                },
                getOwnerId: async () => {
                    return await that.leuteModel.myMainIdentity();
                }
            }
        );

        // LAMA Plans (AI-related)
        this.aiPlan = new AIPlan(this);

        // AI Assistant Plan with all dependencies ready
        this.aiAssistantPlan = new AIAssistantPlan({
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
            settingsPersistence: undefined, // Optional - use llmConfigPlan instead
            llmConfigPlan: undefined, // Will be set right after
            storageDeps: {
                storeVersionedObject,
                storeUnversionedObject,
                getIdObject,
                getObjectByIdHash,
                getObject,
                createDefaultKeys,
                hasDefaultKeys,
                channelManager: this.channelManager,    // Required: for querying LLM objects
                trustPlan: this.trustPlan,              // For assigning 'high' trust to AI contacts
                journalPlan: this.journalPlan,          // For recording AI contact creation as assemblies
                aiObjectManager: this.aiObjectManager,  // For creating AI storage objects
                llmObjectManager: this.llmObjectManager // For creating/updating LLM storage objects
            }
        });

        // Create LLMConfigPlan with settings for secure API key storage
        // Settings uses ONE.core's master key encryption automatically
        this.llmConfigPlan = new LLMConfigPlan(
            this,
            this.aiAssistantPlan,
            this.llmManager,
            this.settings, // ONE.core SettingsModel (encrypted storage)
            browserOllamaValidator,
            {
                computeBaseUrl: browserConfigManager.computeBaseUrl.bind(browserConfigManager)
            }
        );

        // Set llmConfigPlan on aiAssistantPlan for settings persistence
        (this.aiAssistantPlan as any).llmConfigPlan = this.llmConfigPlan;

        // topicAnalysisPlan, proposalsPlan, and aiMessageListener will be created in init()
        this.topicAnalysisPlan = null as any;
        this.proposalsPlan = null as any;
        this.aiMessageListener = null; // Created in init() after aiAssistantPlan
        this.keywordDetailPlan = new KeywordDetailPlan(this);
        this.wordCloudSettingsPlan = new WordCloudSettingsPlan(this);
        this.cryptoPlan = new CryptoPlan(this);
        this.auditPlan = new AuditPlan(this);

        // Chat plans (platform-agnostic from chat.core)
        this.chatPlan = new ChatPlan(this);
        this.contactsPlan = new ContactsPlan(this);
        this.exportPlan = new ExportPlan(this);
        this.feedForwardPlan = new FeedForwardPlan(this);

        // Initialize GroupPlan with StoryFactory for assembly tracking
        // This enables assembly creation through the proper abstraction layers
        console.log('[Model] Initializing GroupPlan with StoryFactory and AssemblyPlan');

        // Create AssemblyPlan (connects to ONE.core)
        const assemblyPlan = new AssemblyPlan({
            storeVersionedObject,
            storeUnversionedObject,
            getObjectByIdHash
        });

        // Create StoryFactory with AssemblyPlan
        const storyFactory = new StoryFactory(assemblyPlan);
        console.log('[Model] StoryFactory created with AssemblyPlan');

        // Create GroupPlan with TopicGroupManager and StoryFactory
        this.groupPlan = new GroupPlan(
            this.topicGroupManager,
            this,  // oneCore
            storyFactory
        );

        // Inject GroupPlan into ChatPlan for assembly creation
        this.chatPlan.setGroupPlan(this.groupPlan);
        console.log('[Model] GroupPlan initialized and injected into ChatPlan');

        // Trust management (platform-agnostic from trust.core)
        // Initialize TrustModel and TrustPlan for trust level tracking and chain of trust
        // TrustModel expects: (leuteModel, trustedKeysManager?)
        this.trustModel = new TrustModel(this.leuteModel, undefined);
        this.trustPlan = new TrustPlan(this.trustModel);

        // Journal plan for recording LLM interactions and AI contact creation as assemblies
        this.journalPlan = new JournalPlan({
            storeVersionedObject,
            getInstanceIdHash,
            calculateIdHashOfObj
        });

        // Subjects plan for managing memory/topics/keywords (uses singleton SubjectService)
        this.subjectsPlan = new SubjectsPlan(SubjectService.getInstance());

        // Wire up JournalPlan's external dependencies for unified journal aggregation
        this.journalPlan.setExternalDeps({
            chatPlan: this.chatPlan,
            subjectsPlan: this.subjectsPlan
        });

        // Prepare TrustPlan dependencies for automatic trust establishment
        const trustDeps: TrustPlanDependencies = {
            getAllEntries,
            getObject,
            ProfileModel,
            leuteModel: this.leuteModel
        };

        // Prepare pairing event callbacks for browser-specific handling
        const pairingCallbacks: PairingEventCallbacks = {
            onContactCreated: async (contact) => {
                console.log('[Model] Contact created:', contact.displayName);
                // Contact is already in LeuteModel - browser just needs to refresh UI
                this.onContactsChanged.emit();
            },

            onTopicCreated: async (topic) => {
                console.log('[Model] Topic created:', topic.channelId);
                // Topic is already created - browser just needs to refresh UI
                this.onTopicsChanged.emit();
            },

            onPairingComplete: async (details) => {
                console.log('[Model] ✅ Pairing complete:', details.type);
                // Emit general event for UI updates
                this.onConnectionsChanged.emit();
            }
        };

        // Connection plan (platform-agnostic from connection.core)
        // Now automatically handles trust establishment via integrated TrustPlan
        // and fires callbacks for platform-specific UI updates
        this.connectionPlan = new ConnectionPlan(
            this as any,
            undefined,     // No storage provider for browser
            commServerUrl,
            undefined,     // No discovery config for browser
            trustDeps,     // Trust dependencies - enables automatic trust after pairing
            pairingCallbacks,  // Platform-specific UI updates
            this.trustPlan     // trust.core TrustPlan for automatic trust level assignment
        );

        // Group chat plan dependencies (platform-agnostic from connection.core)
        const groupChatDeps: GroupChatPlanDependencies = {
            // ONE.core storage functions
            storeVersionedObject,
            storeUnversionedObject,
            getObjectByIdHash,
            calculateIdHashOfObj,

            // Access control - use ONE.core's createAccess API
            grantReadAccess: async (hash: any, personId: any) => {
                try {
                    await createAccess([{
                        object: hash,
                        person: [personId],
                        group: [],
                        mode: SET_ACCESS_MODE.ADD
                    }]);
                } catch (error) {
                    console.error('[GroupChatPlan] Failed to grant read access:', error);
                    throw error;
                }
            },

            // Leute model for trust and identity
            leuteModel: {
                myMainIdentity: async () => this.leuteModel.myMainIdentity(),
                others: async () => {
                    const others = await this.leuteModel.others();
                    // Convert SomeoneModel[] to SHA256IdHash<Person>[]
                    return others.map((someone: any) => someone.personId) as any[];
                },
                trust: {
                    certify: (certType: 'AffirmationCertificate', params: any) => this.leuteModel.trust.certify(certType, params),
                    isAffirmedBy: (hash: any, affirmerId: any) => this.leuteModel.trust.isAffirmedBy(hash, affirmerId),
                    affirmedBy: (hash: any) => this.leuteModel.trust.affirmedBy(hash),
                    refreshCaches: () => this.leuteModel.trust.refreshCaches()
                }
            },

            // Channel manager for group chat channels
            channelManager: {
                getOrCreateChannel: async (channelId: string, owner: any) => {
                    // Get existing channels
                    const existingChannels = await this.channelManager.channels();
                    const existing = existingChannels.find((ch: any) => ch.id === channelId && ch.owner === owner);
                    if (existing) return existing;
                    // Create new channel
                    return this.channelManager.createChannel(channelId, owner);
                },
                postToChannel: (topicId: string, message: any, owner?: any) =>
                    this.channelManager.postToChannel(topicId, message, owner)
            }
        };

        // Group chat plan (platform-agnostic from connection.core)
        this.groupChatPlan = new GroupChatPlan(groupChatDeps);

        // Setup event handler that initialize the models when somebody logged in
        // and shuts down the model when somebody logs out.
        console.log('[Model] 🔍 Registering onLogin callback for Model.init...');
        this.one.onLogin((...args: any[]) => {
            console.log('[Model] 🔍 onLogin callback fired! Args:', args);
            return this.init(...args);
        });
        this.one.onLogout(this.shutdown.bind(this));

        console.log('[Model] Model construction complete');
    }

    /**
     * Initialize all models after login
     */
    public async init(_instanceName?: string, _secret?: string): Promise<void> {
        console.log('[Model] 🔍 INIT CALLED! Args:', {instanceName: _instanceName, secret: _secret ? '***' : undefined});

        // Fail fast: Don't allow double-init
        if (this.initialized) {
            const error = new Error('Model already initialized - call shutdown() first before re-initializing');
            console.error('[Model] ❌ INIT FAILED - already initialized!', error);
            throw error;
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

            // Initialize settings model (secure storage for API keys, etc.)
            console.log('[Model] Initializing settings model...');
            await this.settings.init();
            console.log('[Model] ✅ Settings model initialized');

            // Update LLMManager with settings wrapper (needed for API key retrieval)
            console.log('[Model] Updating LLMManager with settings reference...');
            this.llmManager.userSettingsManager = {
                getApiKey: async (provider: string) => {
                    console.log(`[Model] getApiKey called for provider: ${provider}`);
                    // LLMConfigPlan stores keys as llm.{modelName}.apiKey
                    // For discovery, we need to check by provider
                    // Anthropic: Check common Claude model names
                    // OpenAI: Check common GPT model names
                    if (provider === 'anthropic') {
                        // Try common Claude model names
                        const models = ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-opus-4-1'];
                        for (const model of models) {
                            const settingsKey = `llm.${model}.apiKey`;
                            console.log(`[Model] Checking for key: ${settingsKey}`);
                            const key = await this.settings.getValue(settingsKey);
                            if (key) {
                                console.log(`[Model] ✅ Found API key for ${model}: ${key.substring(0, 20)}...`);
                                return key;
                            }
                        }
                        console.log(`[Model] ❌ No Anthropic API key found`);
                    } else if (provider === 'openai') {
                        // Try common GPT model names
                        const models = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
                        for (const model of models) {
                            const settingsKey = `llm.${model}.apiKey`;
                            console.log(`[Model] Checking for key: ${settingsKey}`);
                            const key = await this.settings.getValue(settingsKey);
                            if (key) {
                                console.log(`[Model] ✅ Found API key for ${model}`);
                                return key;
                            }
                        }
                        console.log(`[Model] ❌ No OpenAI API key found`);
                    }
                    return null;
                }
            };
            console.log('[Model] ✅ LLMManager now has access to encrypted settings');

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

                            // Skip ContactCreation for AI/LLM Persons - AIManager already created them properly
                            const isAIOrLLM = obj.email?.endsWith('@ai.local') || obj.email?.endsWith('@llm.local');
                            if (isAIOrLLM) {
                                console.log('[Model] ⏭️  Skipping ContactCreation for AI/LLM Person - AIManager already created it');
                            } else {
                                // Ensure a contact exists for this Person (regular contacts only)
                                await ensureContactExists(result.idHash as any, this.leuteModel, {
                                    displayName: obj.email?.split('@')[0]
                                });
                                console.log('[Model] ✅ Ensured contact exists for Person');
                            }
                        } catch (error) {
                            console.error('[Model] Failed to handle received Person:', error);
                        }
                    } else {
                        console.log('[Model] ⏸️  Skipping Person - LeuteModel not yet initialized');
                    }
                }
            });
            console.log('[Model] ✅ CHUM listeners registered');

            // CRITICAL: Set channelManager reference so LLMManager can read from storage
            // Must be set BEFORE CoreInitializer calls llmManager.init()
            this.llmManager.channelManager = this.channelManager;

            // Use centralized initialization from lama.core
            // This enforces correct order: LeuteModel → LLM → Channels → Topics
            const { initializeCoreModels } = await import('@lama/core/initialization/CoreInitializer.js');

            await initializeCoreModels({
                oneCore: this,
                leuteModel: this.leuteModel,
                channelManager: this.channelManager,
                topicModel: this.topicModel,
                connections: this.connections,
                llmManager: this.llmManager,
                llmObjectManager: this.llmObjectManager,
                aiAssistantModel: this.aiAssistantPlan,
                chatPlan: this.chatPlan,
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

            // Initialize AI Assistant Plan (required before message processing starts)
            console.log('[Model] Initializing AIAssistantPlan...');
            await this.aiAssistantPlan.init();
            console.log('[Model] ✅ AIAssistantPlan initialized');

            // Initialize LLMObjectManager to load LLM objects from storage
            // CRITICAL: This populates the LLM cache used by ChatPlan to identify AI topics
            console.log('[Model] Initializing LLMObjectManager...');
            await this.llmObjectManager.initialize();
            console.log('[Model] ✅ LLMObjectManager initialized');

            // Scan existing conversations for AI topics and register them
            // CRITICAL: Must run after LLMObjectManager.initialize() (AI contacts loaded)
            // and after ChannelManager is ready (channels loaded during login)
            console.log('[Model] Scanning existing conversations for AI topics...');
            try {
                const scannedCount = await this.aiAssistantPlan.scanExistingConversations();
                console.log(`[Model] ✅ Scanned and registered ${scannedCount} AI topics`);
            } catch (error) {
                console.error('[Model] ❌ Failed to scan AI topics:', error);
                // Don't throw - this is not a fatal error for initialization
            }

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

            // DEPRECATED: P2P topic creation is now handled by ConnectionPlan
            // ConnectionPlan calls handlePairingCompletion() internally which creates the topic
            // The onTopicCreated callback (defined above) will fire when topic is ready
            //
            // OLD CODE (for reference):
            // this.connections.onProtocolStart(...) => autoCreateP2PTopicAfterPairing(...)
            //
            // NEW ARCHITECTURE:
            // ConnectionPlan.handlePairingSuccess() => handlePairingCompletion() => onTopicCreated callback
            console.log('[Model] ℹ️  P2P topic creation handled by ConnectionPlan (not onProtocolStart)');

            // Initialize TrustModel for trust level tracking
            console.log('[Model] Initializing TrustModel...');
            await this.trustModel.init();
            console.log('[Model] ✅ TrustModel initialized');

            // Initialize LAMA-specific models (create TopicAnalysisModel now that dependencies are ready)
            this.topicAnalysisModel = new TopicAnalysisModel(this.channelManager, this.topicModel);
            await this.topicAnalysisModel.init();

            // TODO: Re-enable when cube.core storage layer is implemented
            // Initialize CubeStorage for dimensional indexing of subjects/keywords
            // console.log('[Model] Initializing CubeStorage for subject/keyword indexing...');

            // Create custom dimensions for subject/keyword indexing
            // const dimensions = CustomDimensionManager.createDimensions([
            //     { name: 'topic', type: 'string', description: 'Topic ID' },
            //     { name: 'keyword', type: 'string', description: 'Keyword term' },
            //     { name: 'subjectType', type: 'string', description: 'Subject classification' }
            // ]);

            // this.cubeStorage = new CubeStorage({ dimensions });
            // await this.cubeStorage.init();
            // console.log('[Model] ✅ CubeStorage initialized with 3 custom dimensions');

            // CRITICAL: Inject topicAnalysisModel into AIAssistantPlan deps so it can create subjects
            // The AIAssistantPlan was created with topicAnalysisModel: undefined (line 296)
            // Now that topicAnalysisModel exists, we need to inject it
            console.log('[Model] 💉 Injecting topicAnalysisModel into AIAssistantPlan.deps');
            (this.aiAssistantPlan as any).deps.topicAnalysisModel = this.topicAnalysisModel;

            // Also inject into messageProcessor for backwards compatibility
            if (this.aiAssistantPlan.messageProcessor) {
                (this.aiAssistantPlan.messageProcessor as any).topicAnalysisModel = this.topicAnalysisModel;
            }

            // CRITICAL: Inject topicAnalysisModel into taskManager so analysis can be processed
            if (this.aiAssistantPlan.taskManager) {
                console.log('[Model] 💉 Injecting topicAnalysisModel into AITaskManager');
                (this.aiAssistantPlan.taskManager as any).topicAnalysisModel = this.topicAnalysisModel;
            }

            // Create TopicAnalysisPlan now that topicAnalysisModel and cubeStorage are ready
            this.topicAnalysisPlan = new TopicAnalysisPlan(
                this.topicAnalysisModel,
                this.topicModel,
                this.llmManager,
                this, // nodeOneCore
                this.cubeStorage
            );

            // Create ProposalsPlan with all dependencies
            const proposalEngine = new ProposalEngine(this.topicAnalysisModel);
            const proposalRanker = new ProposalRanker();
            const proposalCache = new ProposalCache();
            this.proposalsPlan = new ProposalsPlan(
                this, // nodeOneCore
                this.topicAnalysisModel,
                proposalEngine,
                proposalRanker,
                proposalCache
            );
            console.log('[Model] ✅ ProposalsPlan initialized');

            // Check if user has a saved default model and create chats if needed
            // (AI was already initialized earlier, before channels)
            const savedDefaultModel = this.aiAssistantPlan.topicManager.getDefaultModel();
            if (savedDefaultModel) {
                console.log('[Model] Found saved default model:', savedDefaultModel);

                // Validate that the saved model still exists and is available
                const availableModels = await this.llmManager.getAvailableModels();
                const modelExists = availableModels.some((m: any) => m.id === savedDefaultModel);

                if (modelExists) {
                    // Call setConfig to trigger chat creation
                    // Find the model to get its correct modelType
                    try {
                        const modelInfo = availableModels.find((m: any) => m.id === savedDefaultModel);
                        if (!modelInfo) {
                            throw new Error(`Model ${savedDefaultModel} not found in available models`);
                        }

                        // Use the model's actual modelType (local for Ollama, remote for API services)
                        await this.llmConfigPlan.setConfig({
                            modelType: modelInfo.modelType || 'local',
                            modelName: savedDefaultModel,
                            setAsActive: true
                        });
                        console.log('[Model] ✅ Default model restored and chats ensured');
                    } catch (error) {
                        console.error('[Model] ❌ Failed to restore default model and create chats:', error);
                        // Clear the problematic model and continue initialization
                        this.aiAssistantPlan.topicManager.setDefaultModel('');
                        console.warn('[Model] Cleared problematic model - user will need to reselect');
                    }
                } else {
                    console.warn('[Model] ⚠️ Saved model no longer available:', savedDefaultModel);
                    console.warn('[Model] Available models:', availableModels.map((m: any) => m.id));
                    // Clear the invalid saved model
                    this.aiAssistantPlan.topicManager.setDefaultModel('');
                    console.log('[Model] Cleared invalid model - user will select via onboarding');
                }
            } else {
                console.log('[Model] No saved default model - user will select via onboarding');
            }

            // Create and start AIMessageListener (listens for new messages and triggers AI responses)
            this.aiMessageListener = new AIMessageListener({
                channelManager: this.channelManager,
                topicModel: this.topicModel,
                aiPlan: this.aiAssistantPlan,
                ownerId: myMainId
            });
            await this.aiMessageListener.start();
            console.log('[Model] ✅ AIMessageListener started');

            // Initialize remaining handlers (core models already initialized via CoreInitializer)
            await this.topicAnalysisPlan.init?.();
            await this.proposalsPlan.init?.();
            await this.keywordDetailPlan.init?.();
            await this.wordCloudSettingsPlan.init?.();
            await this.llmConfigPlan.init?.();
            await this.cryptoPlan.init?.();
            await this.auditPlan.init?.();

            // Chat plans (chatPlan already initialized via CoreInitializer)
            await this.contactsPlan.init?.();
            await this.exportPlan.init?.();
            await this.feedForwardPlan.init?.();
            // NOTE: topicGroupManager has no init() method

            // Initialize AIPlan with all dependencies
            console.log('[Model] Initializing AIPlan with dependencies...');
            this.aiPlan.setModels(
                this.llmManager,
                this.aiAssistantPlan,
                this.topicModel,
                this, // nodeOneCore
                undefined // stateManager (not used in browser)
            );
            console.log('[Model] ✅ AIPlan initialized');

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
            { name: 'AuditPlan', fn: () => this.auditPlan?.shutdown?.() },
            { name: 'CryptoPlan', fn: () => this.cryptoPlan?.shutdown?.() },
            { name: 'LLMConfigPlan', fn: () => this.llmConfigPlan?.shutdown?.() },
            { name: 'WordCloudSettingsPlan', fn: () => this.wordCloudSettingsPlan?.shutdown?.() },
            { name: 'KeywordDetailPlan', fn: () => this.keywordDetailPlan?.shutdown?.() },
            { name: 'ProposalsPlan', fn: () => this.proposalsPlan?.shutdown?.() },
            { name: 'TopicAnalysisPlan', fn: () => this.topicAnalysisPlan?.shutdown?.() },
            { name: 'AIMessageListener', fn: () => this.aiMessageListener?.stop?.() },
            { name: 'AIPlan', fn: () => this.aiPlan?.shutdown?.() },
            { name: 'FeedForwardPlan', fn: () => this.feedForwardPlan?.shutdown?.() },
            { name: 'ExportPlan', fn: () => this.exportPlan?.shutdown?.() },
            { name: 'ContactsPlan', fn: () => this.contactsPlan?.shutdown?.() },
        ];

        for (const handler of platformHandlers) {
            try {
                await handler.fn();
            } catch (error) {
                console.error(`[Model] Shutdown error (${handler.name}):`, error);
            }
        }

        // Use centralized shutdown from lama.core for core models
        const { shutdownCoreModels } = await import('@lama/core/initialization/CoreInitializer.js');
        await shutdownCoreModels({
            oneCore: this,
            leuteModel: this.leuteModel,
            channelManager: this.channelManager,
            topicModel: this.topicModel,
            connections: this.connections,
            llmManager: this.llmManager,
            llmObjectManager: this.llmObjectManager,
            aiAssistantPlan: this.aiAssistantPlan,
            chatHandler: this.chatPlan,
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

    /**
     * Setup access rights after pairing to enable CHUM sync
     *
     * @deprecated NO LONGER NEEDED - PairingManager in ONE.models handles this automatically via
     * convertIdentityToProfile(). This method is kept as a no-op for compatibility.
     *
     * Historical context: This used to manually create Profile with TrustKeysCertificate, but
     * that caused duplicate CHUM connection attempts. ONE.models now handles everything correctly.
     */
    public async setupPairingAccessRights(remotePersonId: string, localPersonId: string): Promise<void> {
        console.log('[Model] setupPairingAccessRights called (no-op - handled by ONE.models)');
        // Do nothing - PairingManager.convertIdentityToProfile() already did everything
    }

    // ONE.core models
    public one: MultiUser;
    public leuteModel: LeuteModel;
    public channelManager: ChannelManager;
    public topicModel: TopicModel;
    public connections: ConnectionsModel;
    public settings: PropertyTreeStore;

    // connection.core integration - DISABLED: Browser adapters not implemented yet
    // public connectionManagerOneCore!: ConnectionManagerOneCore;

    // Alias for IOMHandler compatibility (expects connectionsModel)
    public get connectionsModel() {
        return this.connections;
    }

    // LAMA models
    public topicAnalysisModel: TopicAnalysisModel;
    public cubeStorage: CubeStorage;

    // LAMA Plans (AI-related from lama.core)
    public aiPlan: AIPlan;
    public aiAssistantPlan: AIAssistantPlan;
    public aiMessageListener: AIMessageListener | null;
    public topicAnalysisPlan: TopicAnalysisPlan;
    public proposalsPlan: ProposalsPlan;
    public keywordDetailPlan: KeywordDetailPlan;
    public wordCloudSettingsPlan: WordCloudSettingsPlan;
    public llmConfigPlan: LLMConfigPlan;
    public cryptoPlan: CryptoPlan;
    public auditPlan: AuditPlan;
    public journalPlan: JournalPlan;
    public subjectsPlan: SubjectsPlan;

    // Chat plans (platform-agnostic from chat.core)
    public chatPlan: ChatPlan;
    public groupPlan: GroupPlan;
    public contactsPlan: ContactsPlan;
    public exportPlan: ExportPlan;
    public feedForwardPlan: FeedForwardPlan;

    // Connection plans (platform-agnostic from connection.core)
    public connectionPlan: ConnectionPlan;
    public groupChatPlan: GroupChatPlan;

    // Trust management (platform-agnostic from trust.core)
    public trustModel: TrustModel;
    public trustPlan: TrustPlan;

    // Chat models
    public topicGroupManager: TopicGroupManager;

    // LLM services
    public llmManager: LLMManager;
    public llmObjectManager: LLMObjectManager;
    public aiObjectManager: AIObjectManager;

    /**
     * Send message - AIMessageListener will automatically trigger AI response
     * IMPORTANT: Do NOT manually call aiAssistantPlan.processMessage() here!
     * AIMessageListener (started in init()) listens to channelManager.onUpdated()
     * and automatically triggers AI responses for AI topics.
     */
    async sendMessageWithAI(topicId: string, content: string, attachments?: any[]): Promise<any> {
        // Send user message via ChatPlan
        const response = await this.chatPlan.sendMessage({
            conversationId: topicId,
            content,
            attachments
        });

        if (response.success && response.data) {
            // Message sent successfully
            // AIMessageListener will detect the channel update and trigger AI response automatically
            console.log('[Model] Message sent, AIMessageListener will handle AI response');
            return response.data;
        }

        throw new Error(response.error || 'Failed to send message');
    }

    /**
     * Switch a topic to use a different AI model
     */
    async switchTopicModel(topicId: string, modelId: string): Promise<void> {
        if (!this.initialized) {
            throw new Error('Model not initialized');
        }

        await this.aiAssistantPlan.switchTopicModel(topicId, modelId);
    }

    /**
     * Compatibility alias for UI components that expect llmHandler
     * Maps to llmConfigPlan for LLM configuration operations
     */
    public get llmHandler() {
        return this.llmConfigPlan;
    }

    /**
     * Compatibility alias for ContactsPlan and other services
     * Maps to aiAssistantPlan to identify AI contacts and topics
     */
    public get aiAssistantModel() {
        return this.aiAssistantPlan;
    }
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
