/**
 * LAMA Bridge - Thin wrapper around Model for legacy compatibility
 *
 * This bridge provides compatibility for components that expect the old
 * lamaBridge API. New code should use useModel() directly.
 */

import { getModel } from '@/model'
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js'
import { Events, EventPayloads, addAIEventListener } from '@/events/AIEventTypes'
import { AICreationService, CreationContextCollector, type CreationContextProvider } from '@refinio/lama.core/services'

/**
 * Browser implementation of CreationContextProvider
 * Uses browser APIs to gather context for AI creation
 */
class BrowserCreationContextProvider implements CreationContextProvider {
  async getDeviceName(): Promise<string> {
    // Browser doesn't have access to hostname, use a sensible default
    // Try to get a unique-ish identifier from user agent or just use 'browser'
    const platform = navigator.platform || 'browser'
    return platform.split(' ')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'browser'
  }

  getLocale(): string {
    return Intl.DateTimeFormat().resolvedOptions().locale
  }
}

export interface Message {
  id: string
  senderId: string
  senderName?: string
  content: string
  timestamp: Date
  encrypted: boolean
  isAI: boolean
  isOwn?: boolean
  attachments?: any[]
  topicId: string
}

export interface Peer {
  id: string
  name: string
  connected: boolean
}

class LamaBridge {
  private eventHandlers = new Map<string, Set<Function>>()
  private windowListenerCleanups: (() => void)[] = []

  private channelUpdateUnsubscribe: (() => void) | null = null
  private newTopicUnsubscribe: (() => void) | null = null

  constructor() {
    // Set up window event listeners to forward AI events to bridge listeners
    this.setupAIEventForwarding()
  }

  /**
   * Set up channel update forwarding from channelManager
   * SIMPLIFIED: Just emit channel:updated, no topic matching
   * UI components handle their own refresh logic
   */
  setupChannelUpdateForwarding(): void {
    if (this.channelUpdateUnsubscribe) return // Already set up

    const model = getModel()
    if (!model.channelManager) {
      console.warn('[LamaBridge] channelManager not available yet')
      return
    }

    this.channelUpdateUnsubscribe = model.channelManager.onUpdated(async () => {
      console.log('[LamaBridge] 📡 Channel updated - emitting channel:updated')
      this.emit('channel:updated', {})
    })

    console.log('[LamaBridge] Channel update forwarding set up')
  }

  /**
   * Set up new topic event forwarding from topicModel
   * Call this after model is initialized
   * Emits 'newTopic' event when topics are received via CHUM sync
   */
  setupNewTopicForwarding(): void {
    if (this.newTopicUnsubscribe) return // Already set up

    const model = getModel()
    if (!model.topicModel?.onNewTopicEvent) {
      console.warn('[LamaBridge] topicModel.onNewTopicEvent not available yet')
      return
    }

    this.newTopicUnsubscribe = model.topicModel.onNewTopicEvent.listen(() => {
      console.log('[LamaBridge] 📡 topicModel.onNewTopicEvent fired - emitting newTopic')
      this.emit('newTopic', {})
    })

    console.log('[LamaBridge] New topic forwarding set up')
  }

  /**
   * Forward AI platform events (window CustomEvents) to bridge event listeners
   * Events are forwarded with their original names from the Events registry
   */
  private setupAIEventForwarding(): void {
    // AI_RESPONDING: AI has started processing
    this.windowListenerCleanups.push(
      addAIEventListener(Events.AI_RESPONDING, (event) => {
        this.emit(Events.AI_RESPONDING, event.detail)
      })
    )

    // LLM_STATUS: Intermediate status updates during thinking
    this.windowListenerCleanups.push(
      addAIEventListener(Events.LLM_STATUS, (event) => {
        this.emit(Events.LLM_STATUS, event.detail)
      })
    )

    // LLM_THINKING: Reasoning/thinking content stream
    this.windowListenerCleanups.push(
      addAIEventListener(Events.LLM_THINKING, (event) => {
        this.emit(Events.LLM_THINKING, event.detail)
      })
    )

    // LLM_STREAM: Response content streaming
    this.windowListenerCleanups.push(
      addAIEventListener(Events.LLM_STREAM, (event) => {
        this.emit(Events.LLM_STREAM, event.detail)
      })
    )

    // LLM_COMPLETE: Response finished
    this.windowListenerCleanups.push(
      addAIEventListener(Events.LLM_COMPLETE, (event) => {
        this.emit(Events.LLM_COMPLETE, event.detail)
      })
    )
  }

  on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
    console.log(`[LamaBridge] on('${event}') registered, now ${this.eventHandlers.get(event)!.size} handlers`)
  }

  off(event: string, handler: Function) {
    this.eventHandlers.get(event)?.delete(handler)
  }

  private emit(event: string, data: any) {
    const handlers = this.eventHandlers.get(event)
    console.log(`[LamaBridge] emit('${event}') → ${handlers?.size ?? 0} handlers`)
    handlers?.forEach(handler => handler(data))
  }

  async getMessages(topicId: string): Promise<Message[]> {
    const model = getModel()
    const result = await model.chatPlan.getMessages({ topicId })

    console.log('[LamaBridge.getMessages] Raw result:', {
      success: result.success,
      messageCount: result.messages?.length || 0,
      messages: result.messages?.map((m: any) => ({ sender: m.senderName?.substring(0, 8), text: m.text?.substring(0, 20) }))
    })

    if (!result.success || !result.messages) {
      return []
    }

    return result.messages.map((msg: any) => ({
      id: msg.id || msg.hash,
      senderId: msg.sender || msg.senderId,
      senderName: msg.senderName,
      content: msg.text || msg.content,
      timestamp: new Date(msg.timestamp || msg.createdAt),
      encrypted: false,
      isAI: msg.isAI || false,  // Use isAI from ChatPlan (AI detection happens server-side)
      isOwn: msg.isOwn,  // Server-computed flag for current user's messages
      attachments: msg.attachments,
      topicId: topicId
    }))
  }

  async sendMessage(topicId: string, content: string, attachments?: any[]): Promise<string> {
    const model = getModel()
    const result = await model.chatPlan.sendMessage({
      topicId: topicId,
      content,
      attachments
    })

    // ChatPlan returns data.id, not data.messageId
    const messageId = result.data?.messageId || result.data?.id
    if (result.success && messageId) {
      // Emit event for listeners
      this.emit('chat:newMessages', {
        topicId: topicId,
        messages: await this.getMessages(topicId)
      })
      return messageId
    }

    throw new Error(result.error?.message || 'Failed to send message')
  }

  async getPeerList(): Promise<Peer[]> {
    const model = getModel()
    const result = await model.contactsPlan.getContacts()

    if (!result.success || !result.contacts) {
      return []
    }

    return result.contacts.map((contact: any) => ({
      id: contact.id || contact.personId,
      name: contact.name || 'Unknown',
      connected: true
    }))
  }

  // Alias for getPeerList() for compatibility
  async getContacts(): Promise<Peer[]> {
    return this.getPeerList()
  }

  async connectToPeer(peerId: string): Promise<boolean> {
    console.warn('[LamaBridge] connectToPeer not yet implemented')
    return false
  }

  async queryLocalAI(prompt: string): Promise<string> {
    const model = getModel()
    const result = await model.aiPlan.chat({
      messages: [{ role: 'user', content: prompt }]
    })

    if (result.success && result.data) {
      return result.data.response || ''
    }

    throw new Error(result.error?.message || 'AI query failed')
  }

  async getCurrentUser() {
    const model = getModel()
    return {
      id: model.ownerId || 'unknown',
      name: 'User'
    }
  }

  async login(id: string, password: string): Promise<boolean> {
    const model = getModel()
    try {
      await model.one.onLoginComplete(id, password)
      return true
    } catch (err) {
      console.error('[LamaBridge] Login failed:', err)
      return false
    }
  }

  async logout(): Promise<void> {
    const model = getModel()
    await model.shutdown()
  }

  async createIdentity(name: string, password: string): Promise<string> {
    console.warn('[LamaBridge] createIdentity not yet implemented')
    return 'identity-' + Date.now()
  }

  /**
   * Set the default AI model and create AI Person with AI creation identity
   * @param modelId - The model ID to set as default
   * @param displayName - Optional display name from AI creation
   * @param email - Optional email from AI creation
   */
  async setDefaultModel(modelId: string, displayName?: string, email?: string): Promise<void> {
    const model = getModel()

    // If displayName and email are provided, call aiAssistantPlan.setDefaultModel
    // which creates the AI Person with proper identity and default chats
    if (displayName && email) {
      console.log('[LamaBridge] setDefaultModel with AI creation identity:', modelId, displayName, email)
      await model.aiAssistantPlan.setDefaultModel(modelId, displayName, email)
      return
    }

    // Fallback: just configure LLM without AI Person creation
    // (This path should only be used for model-only configuration)
    console.log('[LamaBridge] setDefaultModel (config only):', modelId)
    const result = await model.llmConfigPlan.setConfig({
      modelType: 'local',
      modelName: modelId,
      setAsActive: true
    })

    if (!result.success) {
      throw new Error(result.error || 'Failed to set default model')
    }
  }

  async getDefaultModel(): Promise<string | null> {
    const model = getModel()
    const result = await model.llmConfigPlan.getConfig({})

    if (result.success && result.config) {
      return result.config.modelName || null
    }

    return null
  }

  async setResponseLength(maxTokens: number): Promise<void> {
    const model = getModel()
    await model.aiAssistantPlan.setResponseLength(maxTokens)
  }

  async getResponseLength(): Promise<number> {
    const model = getModel()
    return await model.aiAssistantPlan.getResponseLength()
  }

  async switchAIModel(aiPersonId: string, modelId: string): Promise<void> {
    const model = getModel()
    await model.aiAssistantPlan.switchAIModel(aiPersonId as any, modelId)
  }

  async getAIPersonForTopic(topicId: string): Promise<string | null> {
    const model = getModel()
    return model.aiAssistantPlan.getAIPersonForTopic(topicId)
  }

  async stopStreaming(topicId: string): Promise<{ success: boolean }> {
    const model = getModel()
    try {
      const cancelled = model.llmManager?.stopStreaming(topicId) ?? false
      return { success: cancelled }
    } catch (error) {
      console.error('[LamaBridge] stopStreaming error:', error)
      return { success: false }
    }
  }

  async getActiveStream(topicId: string): Promise<{ success: boolean; data?: { content: string; modelId: string; modelName?: string } | null }> {
    const model = getModel()
    try {
      const messageProcessor = model.aiAssistantPlan?.getMessageProcessor?.()
      if (!messageProcessor?.getActiveStream) {
        return { success: true, data: null }
      }
      const activeStream = messageProcessor.getActiveStream(topicId)
      return { success: true, data: activeStream }
    } catch (error) {
      console.error('[LamaBridge] getActiveStream error:', error)
      return { success: false, data: null }
    }
  }

  async getSubjects(topicId: string): Promise<{ success: boolean; data?: { subjects: any[] }; error?: string }> {
    const model = getModel()
    return await model.topicAnalysisPlan.getSubjects({ topicId })
  }

  async getSubjectResonance(subject: string): Promise<{ resonance: number; momentum: 'rising' | 'falling' | 'stable' }> {
    // TODO: Implement via topicAnalysisPlan when available
    return { resonance: 0.5, momentum: 'stable' }
  }

  async attachSubject(subject: string, hash: string, userId: string, confidence: number, topicId: string): Promise<void> {
    // TODO: Implement via topicAnalysisPlan when available
    console.warn('[LamaBridge] attachSubject not yet implemented')
  }

  async getLLMIdentity(contactId: string): Promise<{
    name: string
    topSubjects: Array<{ name: string; affinity: number }>
    uniqueSubjects: string[]
    messageCount: number
    signatureHash: string
    similarContacts: string[]
  } | null> {
    // TODO: Implement via aiAssistantPlan when available
    return null
  }

  async getAvailableModels(): Promise<Array<{ id: string; name: string }>> {
    const model = getModel()
    const result = await model.llmConfigPlan.getAvailableModels({})
    if (result.success && result.models) {
      return result.models.map((m: any) => ({ id: m.id || m.name, name: m.name }))
    }
    return []
  }

  /**
   * Record feedback (like/dislike) for a subject
   */
  async recordFeedback(subjectId: string, feedbackType: 'like' | 'dislike'): Promise<{ success: boolean; error?: string }> {
    console.log(`[LamaBridge] Recording ${feedbackType} for subject:`, subjectId)

    try {
      const { getObjectByIdHash, storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')

      // Get the subject by ID
      const result = await getObjectByIdHash(subjectId as any)
      if (!result || !result.obj) {
        console.error('[LamaBridge] Subject not found:', subjectId)
        return { success: false, error: 'Subject not found' }
      }

      const subject = result.obj as any
      console.log('[LamaBridge] Found subject:', subjectId, 'Current likes:', subject.likes, 'dislikes:', subject.dislikes)

      // Update feedback counters
      if (feedbackType === 'like') {
        subject.likes = (subject.likes || 0) + 1
      } else {
        subject.dislikes = (subject.dislikes || 0) + 1
      }

      // Store updated subject
      await storeVersionedObject(subject)
      console.log('[LamaBridge] Subject updated with', feedbackType)

      return { success: true }
    } catch (error) {
      console.error('[LamaBridge] Error recording feedback:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Generate AI name using the specified model
   * This creates a unique identity for the AI assistant
   * @param modelId - The model ID to use for name generation
   * @param _provider - Unused (LLM object's provider field is used from storage)
   */
  async generateAIName(modelId: string, _provider?: string): Promise<{
    success: boolean
    name?: string
    email?: string
    error?: string
  }> {
    const startTime = performance.now()
    console.log('[LamaBridge] generateAIName START - model:', modelId)

    if (!modelId) {
      return {
        success: false,
        error: 'modelId is required - cannot generate name without selecting a model'
      }
    }

    // On-device inference models that run via Web Worker (not through ONE.core storage)
    const ON_DEVICE_MODELS = ['granite-4.0-350m', 'granite-3.3-2b-instruct', 'phi-3.5-mini-instruct']
    const isOnDeviceModel = ON_DEVICE_MODELS.includes(modelId)
    console.log('[LamaBridge] isOnDeviceModel:', isOnDeviceModel)

    try {
      const model = getModel()

      // Collect context (device, locale, time)
      console.log('[LamaBridge] Collecting context...')
      const contextStart = performance.now()
      const contextProvider = new BrowserCreationContextProvider()
      const contextCollector = new CreationContextCollector(contextProvider)
      const context = await contextCollector.collect()
      console.log('[LamaBridge] Context collected in', (performance.now() - contextStart).toFixed(0), 'ms')

      // Create service with appropriate chat function
      // On-device models bypass storage; all others use storage (provider from LLM object)
      const creationService = new AICreationService(async (messages, reqModelId) => {
        const chatMessages = messages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }))

        console.log('[LamaBridge] LLM call START for model:', reqModelId)
        const llmStart = performance.now()

        if (isOnDeviceModel) {
          // On-device models: Use chatLocalDirect (Web Worker inference, no storage)
          console.log('[LamaBridge] Using chatLocalDirect for on-device model:', reqModelId)
          const result = await model.llmManager.chatLocalDirect(
            reqModelId,
            chatMessages,
            { temperature: 0.7, maxTokens: 256 }
          )
          console.log('[LamaBridge] chatLocalDirect completed in', (performance.now() - llmStart).toFixed(0), 'ms')
          return result
        } else {
          // All other models: Use chat() which reads LLM object from storage
          // Provider is determined from the stored LLM object's provider field
          console.log('[LamaBridge] Using chat() for storage-backed model:', reqModelId)
          const response = await model.llmManager.chat(
            chatMessages,
            reqModelId,
            { disableTools: true }
          )
          console.log('[LamaBridge] chat() completed in', (performance.now() - llmStart).toFixed(0), 'ms')

          if (typeof response === 'string') {
            return response
          } else if (response && typeof response === 'object' && 'content' in response) {
            return (response as any).content || ''
          }
          return JSON.stringify(response)
        }
      })

      // Generate name using the user's selected model
      console.log('[LamaBridge] Calling creationService.generateName...')
      const genStart = performance.now()
      const result = await creationService.generateName(context, modelId)
      console.log('[LamaBridge] generateName completed in', (performance.now() - genStart).toFixed(0), 'ms')
      console.log('[LamaBridge] generateAIName TOTAL time:', (performance.now() - startTime).toFixed(0), 'ms')

      return {
        success: true,
        name: result.name,
        email: result.email
      }
    } catch (error) {
      console.error('[LamaBridge] generateAIName FAILED after', (performance.now() - startTime).toFixed(0), 'ms:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Instance Management (IoM/IoP)
  async getMyInstances(): Promise<any[]> {
    const model = getModel()
    if (!model?.instanceRegistryPlan) {
      console.warn('[LamaBridge] InstanceRegistryPlan not available')
      return []
    }
    const result = await model.instanceRegistryPlan.getMyInstances()
    return result.instances
  }

  async getContactInstances(): Promise<Record<string, any[]>> {
    const model = getModel()
    if (!model?.instanceRegistryPlan) {
      console.warn('[LamaBridge] InstanceRegistryPlan not available')
      return {}
    }
    const result = await model.instanceRegistryPlan.getContactInstances()
    return result.instancesByPerson
  }

  async getLocalInstance(): Promise<any | null> {
    const model = getModel()
    if (!model?.instanceRegistryPlan) {
      console.warn('[LamaBridge] InstanceRegistryPlan not available')
      return null
    }
    const result = await model.instanceRegistryPlan.getLocalInstance()
    return result.instance
  }

  onInstancesChanged(handler: () => void): () => void {
    // Listen for connection changes which indicate instance status changes
    this.on('connections:changed', handler)
    return () => this.off('connections:changed', handler)
  }

  /**
   * Set composing state for the current user in a topic
   * Updates Topic.composing which syncs via CHUM to other participants
   */
  async setComposing(topicId: string, isComposing: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      const model = getModel()
      if (!model.topicModel) {
        return { success: false, error: 'TopicModel not available' }
      }

      const myId = await model.leuteModel.myMainIdentity()
      await model.topicModel.setComposing(topicId as any, myId, isComposing)

      return { success: true }
    } catch (error) {
      console.error('[LamaBridge] setComposing error:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Set up composing state change forwarding from Topic version updates
   * Emits 'chat:composingChanged' events when composing state changes
   */
  private composingUnsubscribe: (() => void) | null = null
  private composingState = new Map<string, Map<string, number>>()

  setupComposingForwarding(): void {
    if (this.composingUnsubscribe) return // Already set up

    import('@refinio/one.models/lib/misc/ObjectEventDispatcher.js').then(({ objectEvents }) => {
      this.composingUnsubscribe = objectEvents.onNewVersion(
        async (result: { obj: any; idHash: string }) => {
          if (result.obj.$type$ !== 'Topic') return

          const topicIdHash = result.idHash
          const topic = result.obj
          const newComposing: Map<string, number> = topic.composing ?? new Map()
          const prevComposing = this.composingState.get(topicIdHash) ?? new Map<string, number>()

          // Detect changes
          const changes: Array<{ personId: string; isComposing: boolean; timestamp?: number }> = []

          // Who started composing
          for (const [personId, timestamp] of newComposing) {
            if (!prevComposing.has(personId)) {
              changes.push({ personId, isComposing: true, timestamp })
            }
          }

          // Who stopped composing
          for (const [personId] of prevComposing) {
            if (!newComposing.has(personId)) {
              changes.push({ personId, isComposing: false })
            }
          }

          // Update state
          this.composingState.set(topicIdHash, new Map(newComposing))

          // Emit events
          for (const change of changes) {
            this.emit('chat:composingChanged', {
              topicId: topicIdHash,
              ...change
            })
          }
        },
        'LamaBridge: composing changes',
        'Topic'
      )

      console.log('[LamaBridge] Composing state forwarding set up')
    }).catch(err => {
      console.error('[LamaBridge] Failed to set up composing forwarding:', err)
    })
  }
}

export const lamaBridge = new LamaBridge()
