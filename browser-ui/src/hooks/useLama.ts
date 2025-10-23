import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useModel } from '@/model/ModelContext'

export interface Message {
  id: string
  senderId: string
  senderName?: string
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

// Main hook to access Model
export function useLama() {
  const model = useModel()
  return {
    model
  }
}

export function useLamaMessages(conversationId: string) {
  console.log('[useLamaMessages] 🎯 Hook called with conversationId:', conversationId)
  const model = useModel()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([])

  // Load messages from Model
  const loadMessages = useCallback(async () => {
    if (!model.initialized) {
      console.log('[useLamaMessages] Model not initialized yet')
      setLoading(false)
      return
    }

    console.log('🔄 Loading messages for:', conversationId)
    try {
      setLoading(true)
      const result = await model.chatHandler.getMessages({ topicId: conversationId })

      if (!result.success || !result.data) {
        setMessages([])
        return
      }

      const msgs = result.data.map((msg: any) => ({
        id: msg.id || msg.hash,
        senderId: msg.sender || msg.senderId,
        senderName: msg.senderName,
        content: msg.text || msg.content,
        timestamp: new Date(msg.timestamp || msg.createdAt),
        encrypted: false,
        isAI: false,
        attachments: msg.attachments,
        topicId: conversationId
      }))

      console.log('✅ Loaded', msgs.length, 'messages')
      setMessages(msgs)
      setOptimisticMessages([])
    } catch (err) {
      console.error('❌ Failed to load messages:', err)
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [model, conversationId])

  // Initial load
  useEffect(() => {
    loadMessages()
  }, [conversationId, model.initialized]) // Reload when conversation changes or model initializes

  // Listen for new messages via custom events
  useEffect(() => {
    const handleNewMessages = () => {
      console.log('[useLamaMessages] 📨 New message event received')
      loadMessages()
    }

    window.addEventListener('chat:newMessages', handleNewMessages)
    return () => {
      window.removeEventListener('chat:newMessages', handleNewMessages)
    }
  }, [loadMessages])

  const sendMessage = useCallback(async (topicId: string, content: string, attachments?: any[]) => {
    if (!model.initialized) {
      throw new Error('Model not initialized')
    }

    try {
      console.log('[useLama] 📤 Sending message to:', topicId)

      // Add optimistic message for instant UI feedback
      const optimisticMessage: Message = {
        id: `optimistic-${Date.now()}`,
        senderId: model.ownerId || 'user',
        senderName: 'You',
        content,
        timestamp: new Date(),
        encrypted: false,
        isAI: false,
        attachments,
        topicId
      }
      setOptimisticMessages([optimisticMessage])

      // Send via Model handler
      const result = await model.chatHandler.sendMessage({
        topicId,
        content,
        attachments
      })

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to send message')
      }

      console.log('[useLama] ✅ Message sent:', result.data?.messageId)

      // Emit custom event for other components
      window.dispatchEvent(new CustomEvent('chat:newMessages', { detail: { topicId } }))

      // Refresh messages
      await loadMessages()
      setOptimisticMessages([])

      return result.data?.messageId || ''
    } catch (err) {
      console.error('[useLama] ❌ Send failed:', err)
      setOptimisticMessages([])
      throw err
    }
  }, [model, loadMessages])

  // Combine real and optimistic messages
  const allMessages = useMemo(() => {
    return [...messages, ...optimisticMessages]
  }, [messages, optimisticMessages])

  return { messages: allMessages, loading, error, sendMessage }
}

export function useLamaPeers() {
  const model = useModel()
  const [peers, setPeers] = useState<Peer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPeers = async () => {
      if (!model.initialized) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const result = await model.contactsHandler.getContacts()

        if (!result.success || !result.data) {
          setPeers([])
          return
        }

        const peerList = result.data.map((contact: any) => ({
          id: contact.id || contact.personId,
          name: contact.name || 'Unknown',
          connected: contact.status === 'connected'
        }))

        setPeers(peerList)
      } catch (err) {
        console.error('Failed to load peers:', err)
      } finally {
        setLoading(false)
      }
    }

    loadPeers()

    // Listen for peer updates via custom events
    const handlePeerUpdate = () => {
      loadPeers()
    }

    window.addEventListener('peer:connected', handlePeerUpdate)
    window.addEventListener('peer:disconnected', handlePeerUpdate)

    return () => {
      window.removeEventListener('peer:connected', handlePeerUpdate)
      window.removeEventListener('peer:disconnected', handlePeerUpdate)
    }
  }, [model])

  const connectToPeer = useCallback(async (peerId: string) => {
    console.warn('[useLamaPeers] connectToPeer not yet implemented')
    return false
  }, [])

  return { peers, loading, connectToPeer }
}

export function useLamaAI() {
  const model = useModel()
  const [processing, setProcessing] = useState(false)
  const [response, setResponse] = useState<string | null>(null)

  useEffect(() => {
    const handleProcessing = () => setProcessing(true)
    const handleComplete = () => setProcessing(false)

    window.addEventListener('ai:processing', handleProcessing)
    window.addEventListener('ai:complete', handleComplete)

    return () => {
      window.removeEventListener('ai:processing', handleProcessing)
      window.removeEventListener('ai:complete', handleComplete)
    }
  }, [])

  const query = useCallback(async (prompt: string) => {
    if (!model.initialized) {
      throw new Error('Model not initialized')
    }

    try {
      setProcessing(true)
      window.dispatchEvent(new Event('ai:processing'))

      const result = await model.aiHandler.chat({
        messages: [{ role: 'user', content: prompt }]
      })

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'AI query failed')
      }

      const responseText = result.data.response || ''
      setResponse(responseText)
      window.dispatchEvent(new Event('ai:complete'))

      return responseText
    } catch (err) {
      window.dispatchEvent(new Event('ai:complete'))
      throw err
    } finally {
      setProcessing(false)
    }
  }, [model])

  return { query, processing, response }
}

export function useLamaAuth() {
  const model = useModel()
  const [user, setUser] = useState<{ id: string; name: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (model.initialized && model.ownerId) {
          setUser({
            id: model.ownerId,
            name: 'User'
          })
        }
      } catch (err) {
        console.error('Failed to get current user:', err)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [model])

  const login = useCallback(async (id: string, password: string) => {
    try {
      await model.one.loginOrRegister({
        email: id,
        instanceName: 'browser-instance',
        secret: password
      })

      if (model.ownerId) {
        setUser({
          id: model.ownerId,
          name: id
        })
      }

      return true
    } catch (err) {
      console.error('[useLamaAuth] Login failed:', err)
      return false
    }
  }, [model])

  const logout = useCallback(async () => {
    await model.shutdown()
    setUser(null)
  }, [model])

  const createIdentity = useCallback(async (name: string, password: string) => {
    console.warn('[useLamaAuth] createIdentity not yet implemented')
    return 'identity-' + Date.now()
  }, [])

  return { user, loading, login, logout, createIdentity }
}