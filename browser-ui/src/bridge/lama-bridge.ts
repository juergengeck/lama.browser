/**
 * LAMA Bridge - Thin wrapper around Model for legacy compatibility
 *
 * This bridge provides compatibility for components that expect the old
 * lamaBridge API. New code should use useModel() directly.
 */

import { getModel } from '@/model'
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js'
import { AIEventNames, addAIEventListener, type AIMessageStreamData, type AIMessageCompleteData, type AIProgressData } from '@/events/AIEventTypes'
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
      this.emit('channel:updated', { channelId })
    })

    console.log('[LamaBridge] Channel update forwarding set up')
  }

  /**
   * Forward AI platform events (window CustomEvents) to bridge event listeners
   *
   * Platform events → Bridge events:
   * - ai:progress → message:thinking (AI is processing)
   * - ai:messageStream → message:stream (streaming content)
   * - ai:messageComplete → message:updated (response complete)
   */
  private setupAIEventForwarding(): void {
    // Forward ai:progress → message:thinking
    this.windowListenerCleanups.push(
      addAIEventListener(AIEventNames.PROGRESS, (event) => {
        const data = event.detail as AIProgressData
        console.log('[LamaBridge] Forwarding ai:progress → message:thinking', data.topicId)
        this.emit('message:thinking', {
          conversationId: data.topicId,
          status: 'thinking'
        })
      })
    )

    // Forward ai:messageStream → message:stream
    this.windowListenerCleanups.push(
      addAIEventListener(AIEventNames.MESSAGE_STREAM, (event) => {
        const data = event.detail as AIMessageStreamData
        this.emit('message:stream', {
          conversationId: data.topicId,
          messageId: data.messageId,
          content: data.partial,
          modelId: data.modelId,
          modelName: data.modelName
        })
      })
    )

    // Forward ai:messageComplete → message:updated
    this.windowListenerCleanups.push(
      addAIEventListener(AIEventNames.MESSAGE_COMPLETE, (event) => {
        const data = event.detail as AIMessageCompleteData
        console.log('[LamaBridge] Forwarding ai:messageComplete → message:updated', data.topicId)
        this.emit('message:updated', {
          conversationId: data.topicId,
          messageId: data.messageId,
          content: data.response,
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
   */
  async generateAIName(modelId: string): Promise<{
    success: boolean
    name?: string
    email?: string
    error?: string
  }> {
    if (!modelId) {
      return {
        success: false,
        error: 'modelId is required - cannot generate name without selecting a model'
      }
    }

    // Local models that run via Web Worker (not Ollama)
    const LOCAL_MODELS = ['granite-4.0-350m', 'granite-3.3-2b-instruct', 'phi-3.5-mini-instruct']
    const isLocalModel = LOCAL_MODELS.includes(modelId)

    try {
      const model = getModel()

      // Collect context (device, locale, time)
      const contextProvider = new BrowserCreationContextProvider()
      const contextCollector = new CreationContextCollector(contextProvider)
      const context = await contextCollector.collect()

      // Create service with appropriate chat function based on model type
      const creationService = new AICreationService(async (messages, reqModelId) => {
        const chatMessages = messages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }))

        if (isLocalModel) {
          // Local models: Use chatLocalDirect which bypasses storage lookup
          // This is specifically for first-run scenarios where model isn't yet registered
          console.log('[LamaBridge] Using chatLocalDirect for local model:', reqModelId)
          return await model.llmManager.chatLocalDirect(
            reqModelId,
            chatMessages,
            { temperature: 0.7, maxTokens: 256 }
          )
        } else {
          // Cloud/Ollama models: Use standard chat (requires model in storage)
          const response = await model.llmManager.chat(
            chatMessages,
            reqModelId,
            { disableTools: true }
          )

          if (typeof response === 'string') {
            return response
          } else if (response && typeof response === 'object' && 'content' in response) {
            return (response as any).content || ''
          }
          return JSON.stringify(response)
        }
      })

      // Generate name using the user's selected model
      const result = await creationService.generateName(context, modelId)

      return {
        success: true,
        name: result.name,
        email: result.email
      }
    } catch (error) {
      console.error('[LamaBridge] generateAIName failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

export const lamaBridge = new LamaBridge()
