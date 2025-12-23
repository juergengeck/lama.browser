/**
 * LAMA Bridge - Thin wrapper around Model for legacy compatibility
 *
 * This bridge provides compatibility for components that expect the old
 * lamaBridge API. New code should use useModel() directly.
 */

import { getModel } from '@/model'
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js'
import { Events, EventPayloads, addAIEventListener } from '@/events/AIEventTypes'
import { AICreationService, CreationContextCollector, type CreationContextProvider } from '@lama/core/services'

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

  constructor() {
    // Set up window event listeners to forward AI events to bridge listeners
    this.setupAIEventForwarding()
  }

  /**
   * Set up channel update forwarding from channelManager
   * Call this after model is initialized
   */
  setupChannelUpdateForwarding(): void {
    if (this.channelUpdateUnsubscribe) return // Already set up

    const model = getModel()
    if (!model.channelManager) {
      console.warn('[LamaBridge] channelManager not available yet')
      return
    }

    this.channelUpdateUnsubscribe = model.channelManager.onUpdated((
      _channelInfoIdHash: any,
      channelId: string
    ) => {
      console.log('[LamaBridge] 📡 channelManager.onUpdated fired:', channelId?.substring(0, 20) + '...')
      this.emit('channel:updated', { channelId })
    })

    console.log('[LamaBridge] Channel update forwarding set up')
  }

  /**
   * Forward AI platform events (window CustomEvents) to bridge event listeners
   *
   * Platform events → Bridge events:
   * - ai:responding → message:thinking (AI is processing)
   * - llm:stream → message:stream (streaming content)
   * - llm:complete → message:updated (response complete)
   */
  private setupAIEventForwarding(): void {
    // Forward ai:responding → message:thinking
    this.windowListenerCleanups.push(
      addAIEventListener(Events.AI_RESPONDING, (event) => {
        const data = event.detail
        console.log('[LamaBridge] Forwarding ai:responding → message:thinking', data.topicId)
        this.emit('message:thinking', {
          conversationId: data.topicId,
          status: 'thinking'
        })
      })
    )

    // Forward llm:stream → message:stream
    this.windowListenerCleanups.push(
      addAIEventListener(Events.LLM_STREAM, (event) => {
        const data = event.detail
        this.emit('message:stream', {
          conversationId: data.topicId,
          messageId: data.messageId,
          content: data.content,
          modelId: data.modelId,
          modelName: data.modelName
        })
      })
    )

    // Forward llm:complete → message:updated
    this.windowListenerCleanups.push(
      addAIEventListener(Events.LLM_COMPLETE, (event) => {
        const data = event.detail
        console.log('[LamaBridge] Forwarding llm:complete → message:updated', data.topicId)
        this.emit('message:updated', {
          conversationId: data.topicId,
          messageId: data.messageId,
          content: data.content,
          modelId: data.modelId,
          modelName: data.modelName
        })
      })
    )

    console.log('[LamaBridge] AI event forwarding set up')
  }

  on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  off(event: string, handler: Function) {
    this.eventHandlers.get(event)?.delete(handler)
  }

  private emit(event: string, data: any) {
    this.eventHandlers.get(event)?.forEach(handler => handler(data))
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const model = getModel()
    const result = await model.chatPlan.getMessages({ conversationId })

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
      topicId: conversationId
    }))
  }

  async sendMessage(topicId: string, content: string, attachments?: any[]): Promise<string> {
    const model = getModel()
    const result = await model.chatPlan.sendMessage({
      conversationId: topicId,
      content,
      attachments
    })

    // ChatPlan returns data.id, not data.messageId
    const messageId = result.data?.messageId || result.data?.id
    if (result.success && messageId) {
      // Emit event for listeners
      this.emit('chat:newMessages', {
        conversationId: topicId,
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

  async getSubjects(topicId: string): Promise<{ success: boolean; data?: { subjects: any[] }; error?: string }> {
    const model = getModel()
    return await model.topicAnalysisPlan.getSubjects({ topicId })
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
}

export const lamaBridge = new LamaBridge()
