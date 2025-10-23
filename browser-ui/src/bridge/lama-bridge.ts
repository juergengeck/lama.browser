/**
 * LAMA Bridge - Thin wrapper around Model for legacy compatibility
 *
 * This bridge provides compatibility for components that expect the old
 * lamaBridge API. New code should use useModel() directly.
 */

import { getModel } from '@/model'
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js'

export interface Message {
  id: string
  senderId: string
  content: string
  timestamp: Date
  encrypted: boolean
  isAI: boolean
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
    const result = await model.chatHandler.getMessages({ topicId: conversationId })

    if (!result.success || !result.data) {
      return []
    }

    return result.data.map((msg: any) => ({
      id: msg.id || msg.hash,
      senderId: msg.sender || msg.senderId,
      content: msg.text || msg.content,
      timestamp: new Date(msg.timestamp || msg.createdAt),
      encrypted: false,
      isAI: false,
      attachments: msg.attachments,
      topicId: conversationId
    }))
  }

  async sendMessage(topicId: string, content: string, attachments?: any[]): Promise<string> {
    const model = getModel()
    const result = await model.chatHandler.sendMessage({
      topicId,
      content,
      attachments
    })

    if (result.success && result.data?.messageId) {
      // Emit event for listeners
      this.emit('chat:newMessages', {
        conversationId: topicId,
        messages: await this.getMessages(topicId)
      })
      return result.data.messageId
    }

    throw new Error(result.error?.message || 'Failed to send message')
  }

  async getPeerList(): Promise<Peer[]> {
    const model = getModel()
    const result = await model.contactsHandler.getContacts()

    if (!result.success || !result.data) {
      return []
    }

    return result.data.map((contact: any) => ({
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
    const result = await model.aiHandler.chat({
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

  async setDefaultModel(modelId: string): Promise<void> {
    const model = getModel()
    const result = await model.llmConfigHandler.setConfig({
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
    const result = await model.llmConfigHandler.getConfig({})

    if (result.success && result.config) {
      return result.config.modelName || null
    }

    return null
  }
}

export const lamaBridge = new LamaBridge()
