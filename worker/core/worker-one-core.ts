/**
 * Worker ONE.core Instance using browser platform
 * Adapted from node-one-core.ts for Web Worker context
 */

import TopicAnalysisModel from '@lama/core/one-ai/models/TopicAnalysisModel.js';
import { initializeAIAssistantHandler } from './ai-assistant-handler-adapter.js';
// TODO: Port TopicGroupManager to lama.core or create browser-compatible version
// import TopicGroupManager from './topic-group-manager.js';

// Import ONE.core model classes - same as Node version
import LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';
import ProfileModel from '@refinio/one.models/lib/models/Leute/ProfileModel.js';
import SomeoneModel from '@refinio/one.models/lib/models/Leute/SomeoneModel.js';
import GroupModel from '@refinio/one.models/lib/models/Leute/GroupModel.js';
import ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js';
import ConnectionsModel from '@refinio/one.models/lib/models/ConnectionsModel.js';
import TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js';
import { storeVersionedObject, storeVersionObjectAsChange } from '@refinio/one.core/lib/storage-versioned-objects.js';
import SingleUserNoAuth from '@refinio/one.models/lib/models/Authenticator/SingleUserNoAuth.js';
import type { Recipe, RecipeRule } from '@refinio/one.core/lib/recipes.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';

class WorkerOneCore {
  public appStateModel: any;
  public multiUserModel: any;
  public instanceModule: any;
  public aiAssistantModel?: any; // AIAssistantHandler from lama.core
  public topicGroupManager?: any; // TopicGroupManager (TODO)
  public federationGroup: any;

  onPairingStarted: any;
  onPairingFailed: any;
  getChannelInfos: any;
  author: any;
  substring: any;
  content: any;
  text: any;
  on: any;
  getDefaultModel: any;
  generateResponse: any;
  description: any;

  // Required properties
  initialized: boolean
  instanceName: string
  ownerId: SHA256IdHash<Person>
  leuteModel: LeuteModel
  channelManager: ChannelManager
  topicModel: TopicModel
  connectionsModel: ConnectionsModel
  instance: any
  settingsStore: any
  isReady: boolean
  instanceId?: string
  localInstanceId?: string
  models?: any
  topicAnalysisModel?: TopicAnalysisModel
  commServerModel?: any
  llmManager?: any
  llmObjectManager?: any

  // Additional properties
  oneAuth: SingleUserNoAuth
  grantedAccessPeers: Set<string>
  email: any
  contentSharing: any
  federationAPI: any
  aiMessageListener: any
  peerMessageListener: any
  aiPersonIds: any
  directListenerStopFn: any
  replicantGroup: any
  aiAssistant: any
  quickReply: any
  messageSyncInterval: any
  accessRightsManager: any
  initFailed: any

  constructor() {
    this.initialized = false
    this.instanceName = ''
    this.ownerId = '' as any
    this.leuteModel = null as any
    this.appStateModel = null
    this.connectionsModel = null as any
    this.channelManager = null as any
    this.topicModel = null as any
    this.instance = null as any
    this.settingsStore = null
    this.multiUserModel = null
    this.isReady = false
    this.oneAuth = null as any
    this.instanceModule = null
    this.aiAssistantModel = undefined
    this.topicGroupManager = undefined
    this.federationGroup = null
    this.grantedAccessPeers = new Set()
  }

  /**
   * Initialize ONE.core with browser platform
   * Adapted from node-one-core.ts init() method
   */
  async init(instanceName: string, email: string, options: {
    password?: string;
    commserverUrl?: string;
    enableSync?: boolean;
  } = {}): Promise<void> {
    console.log(`[WorkerOneCore] Initializing with browser platform: ${instanceName}`)
    console.log(`[WorkerOneCore] Email: ${email}`)

    this.email = email
    this.instanceName = instanceName

    try {
      console.log('[WorkerOneCore] Loading recipes...')

      // Import recipes (following Node.js pattern)
      const RecipesStable = (await import('@refinio/one.models/lib/recipes/recipes-stable.js')).default
      const RecipesExperimental = (await import('@refinio/one.models/lib/recipes/recipes-experimental.js')).default

      // Import reverse maps
      const { ReverseMapsStable, ReverseMapsForIdObjectsStable } = await import('@refinio/one.models/lib/recipes/reversemaps-stable.js')
      const { ReverseMapsExperimental, ReverseMapsForIdObjectsExperimental } = await import('@refinio/one.models/lib/recipes/reversemaps-experimental.js')

      const allRecipes = [
        ...RecipesStable,
        ...RecipesExperimental
      ]

      console.log('[WorkerOneCore] Creating SingleUserNoAuth with', allRecipes.length, 'recipes')

      // Initialize SingleUserNoAuth with configuration object (same as Node.js)
      this.oneAuth = new SingleUserNoAuth({
        directory: `browser-${instanceName}`, // Browser storage namespace
        recipes: allRecipes,
        reverseMaps: new Map([
          ...(ReverseMapsStable || []),
          ...(ReverseMapsExperimental || [])
        ]),
        reverseMapsForIdObjects: new Map([
          ...(ReverseMapsForIdObjectsStable || []),
          ...(ReverseMapsForIdObjectsExperimental || [])
        ]),
        storageInitTimeout: 20000
      })

      // In Web Workers, we can't use localStorage for isRegistered check
      // Just call register() - it will handle both new and existing instances
      console.log('[WorkerOneCore] Registering/logging in...')
      try {
        await this.oneAuth.register(instanceName, email, options.password || email)
        console.log('[WorkerOneCore] Instance registered/initialized')
      } catch (error: any) {
        // If already registered, try login instead
        if (error.message?.includes('already') || error.message?.includes('exists')) {
          console.log('[WorkerOneCore] Instance exists, attempting login...')
          await this.oneAuth.login(instanceName, email, options.password || email)
          console.log('[WorkerOneCore] Logged in successfully')
        } else {
          throw error
        }
      }

      // Initialize models (same as Node version)
      console.log('[WorkerOneCore] Initializing models...')
      const commServerUrl = options.commserverUrl || 'wss://commserver.refinio.net'

      // LeuteModel must be created first (takes commServerUrl, NOT oneAuth!)
      this.leuteModel = new LeuteModel(commServerUrl, true) // true = create everyone group
      await this.leuteModel.init()

      // ChannelManager takes leuteModel
      this.channelManager = new ChannelManager(this.leuteModel)
      await this.channelManager.init()

      // ConnectionsModel takes leuteModel + config
      this.connectionsModel = new ConnectionsModel(this.leuteModel, { commServerUrl })
      await this.connectionsModel.init()

      // TopicModel takes leuteModel
      this.topicModel = new TopicModel(this.leuteModel)
      await this.topicModel.init()

      // Get owner ID from LeuteModel (not from oneAuth)
      const meModel = await this.leuteModel.me()
      this.ownerId = meModel.personId
      console.log(`[WorkerOneCore] Owner ID: ${String(this.ownerId).substring(0, 8)}...`)

      console.log('[WorkerOneCore] Core models initialized')

      // Initialize minimal LLM Manager and AI Assistant Model for browser
      console.log('[WorkerOneCore] Initializing LLM Manager (browser mode)...')

      // Dynamic models map - browser can discover Ollama models via HTTP
      const discoveredModels = new Map()

      // Simple browser-compatible llmManager stub
      this.llmManager = {
        isInitialized: true,
        defaultModelId: null,
        models: discoveredModels,
        async init() { return true },
        async discoverModels() { return Array.from(discoveredModels.values()) },
        getAvailableModels() { return Array.from(discoveredModels.values()) },
        getModel(id: string) {
          // If model not found, create stub entry for it
          if (!discoveredModels.has(id)) {
            discoveredModels.set(id, {
              id,
              name: id,
              provider: 'ollama',
              isLoaded: true
            })
          }
          return discoveredModels.get(id)
        },
        getDefaultModel() {
          if (!this.defaultModelId) return null
          return this.getModel(this.defaultModelId)
        },
        setDefaultModel(modelId: string) {
          console.log('[Browser LLMManager] Setting default model:', modelId)
          // Accept any model ID - create stub if needed
          if (!discoveredModels.has(modelId)) {
            discoveredModels.set(modelId, {
              id: modelId,
              name: modelId,
              provider: 'ollama',
              isLoaded: true
            })
          }
          this.defaultModelId = modelId
          console.log('[Browser LLMManager] ✅ Default model set to:', modelId)
          return true
        }
      }

      console.log('[WorkerOneCore] Initializing AI Assistant Handler (refactored architecture)...')
      if (!this.aiAssistantModel) {
        this.aiAssistantModel = await initializeAIAssistantHandler(this, this.llmManager)
        console.log('[WorkerOneCore] ✅ AI Assistant Handler initialized (browser/worker)')

        // TODO: Connect to message listener when browser AI message listener is implemented
        // this.aiMessageListener.setAIAssistantModel(this.aiAssistantModel)
        // console.log('[WorkerOneCore] ✅ Connected AIAssistantHandler to message listener')
      }
      console.log('[WorkerOneCore] AI models initialized')

      // TODO: Initialize Topic Group Manager (needs browser-compatible version)
      // console.log('[WorkerOneCore] Initializing Topic Group Manager...')
      // this.topicGroupManager = new TopicGroupManager(...)

      // Initialize Topic Analysis Model
      console.log('[WorkerOneCore] Initializing Topic Analysis Model...')
      this.topicAnalysisModel = new TopicAnalysisModel(
        this.topicModel,
        this.leuteModel
      )
      await this.topicAnalysisModel.init()
      console.log('[WorkerOneCore] Topic Analysis Model initialized')

      // Configure WebSocket transport if requested
      if (options.commserverUrl && options.enableSync) {
        console.log(`[WorkerOneCore] Configuring WebSocket transport: ${options.commserverUrl}`)
        // TODO: Configure WebSocket transport
        // await this.connectionsModel.setTransport(...)
      }

      this.initialized = true
      this.isReady = true

      console.log('[WorkerOneCore] ✓ Initialization complete')
    } catch (error) {
      this.initFailed = true
      console.error('[WorkerOneCore] ✗ Initialization failed:', error)
      throw error
    }
  }

  /**
   * Grant peer access (same as Node version)
   */
  async grantPeerAccess(remotePersonId: any, context = 'unknown'): Promise<void> {
    if (!remotePersonId || !this.leuteModel) {
      console.warn('[WorkerOneCore] Cannot grant peer access - missing requirements')
      return
    }

    if (this.grantedAccessPeers.has(remotePersonId)) {
      console.log(`[WorkerOneCore] Already granted access to peer: ${String(remotePersonId).substring(0, 8)}`)
      return
    }

    const { createAccess } = await import('@refinio/one.core/lib/access.js')
    const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js')
    const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/util/object.js')

    console.log(`[WorkerOneCore] Granting peer access (${context}):`, String(remotePersonId).substring(0, 8))

    try {
      const me = await this.leuteModel.me()
      const mainProfile = await me.mainProfile()
      const mainProfileObj = await mainProfile.obj()
      const mainProfileHash = await calculateIdHashOfObj(mainProfileObj)

      await createAccess([remotePersonId], mainProfileHash, SET_ACCESS_MODE.WRITE)
      console.log(`[WorkerOneCore] ✓ Granted profile access to peer`)

      this.grantedAccessPeers.add(remotePersonId)
    } catch (error) {
      console.error('[WorkerOneCore] Failed to grant peer access:', error)
    }
  }

  /**
   * Shutdown ONE.core
   */
  async shutdown(): Promise<void> {
    console.log('[WorkerOneCore] Shutting down...')

    // Stop message listeners
    if (this.aiMessageListener?.stop) {
      this.aiMessageListener.stop()
    }
    if (this.peerMessageListener?.stop) {
      this.peerMessageListener.stop()
    }

    // TODO: Close IndexedDB connections
    // TODO: Stop sync if active

    this.initialized = false
    this.isReady = false

    console.log('[WorkerOneCore] Shutdown complete')
  }
}

// Export singleton instance
const workerOneCore = new WorkerOneCore()
export default workerOneCore
