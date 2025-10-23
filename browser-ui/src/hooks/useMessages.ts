/**
 * useMessages Hook
 *
 * React hook for managing messages in a topic using Model and ChatHandler
 */

import { useState, useEffect, useCallback } from 'react'
import { useModel } from '@/model/index.js'

export interface Message {
  $type$: 'Message'
  id: string
  topic: string
  author: any // SHA256IdHash<Person>
  content: string
  timestamp: number
  attachments?: any[]
  replyTo?: any // SHA256Hash<Message>
}

interface UseMessagesOptions {
  topicId: string
  limit?: number
  autoRefresh?: boolean
}

interface UseMessagesReturn {
  messages: Message[]
  isLoading: boolean
  error: Error | null
  hasMore: boolean
  refreshMessages: () => Promise<void>
  loadMore: () => Promise<void>
  sendMessage: (content: string, attachments?: any[]) => Promise<Message>
}

export function useMessages({
  topicId,
  limit = 50,
  autoRefresh = false
}: UseMessagesOptions): UseMessagesReturn {
  const model = useModel()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const refreshMessages = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Call ChatHandler.getMessages
      const response = await model.chatHandler.getMessages({
        conversationId: topicId,
        limit,
        offset: 0
      })

      if (response.success && response.messages) {
        setMessages(response.messages as Message[])
        setHasMore(response.hasMore || false)
        setOffset(0) // Reset pagination
      } else {
        throw new Error(response.error || 'Failed to fetch messages')
      }
    } catch (err) {
      console.error('[useMessages] Failed to fetch messages:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch messages'))
    } finally {
      setIsLoading(false)
    }
  }, [topicId, limit, model])

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return

    try {
      setIsLoading(true)

      const newOffset = offset + limit

      const response = await model.chatHandler.getMessages({
        conversationId: topicId,
        limit,
        offset: newOffset
      })

      if (response.success && response.messages) {
        // Append older messages
        setMessages(prev => [...prev, ...(response.messages as Message[])])
        setHasMore(response.hasMore || false)
        setOffset(newOffset)
      } else {
        throw new Error(response.error || 'Failed to load more messages')
      }
    } catch (err) {
      console.error('[useMessages] Failed to load more messages:', err)
      setError(err instanceof Error ? err : new Error('Failed to load more messages'))
    } finally {
      setIsLoading(false)
    }
  }, [topicId, limit, hasMore, isLoading, offset, model])

  const sendMessage = useCallback(async (
    content: string,
    attachments?: any[]
  ): Promise<Message> => {
    try {
      const response = await model.chatHandler.sendMessage({
        conversationId: topicId,
        text: content,
        attachments
      })

      if (response.success && response.data) {
        const message = response.data as Message

        // Optimistically add message to list
        setMessages(prev => [message, ...prev])

        return message
      } else {
        throw new Error(response.error || 'Failed to send message')
      }
    } catch (err) {
      console.error('[useMessages] Failed to send message:', err)
      throw err
    }
  }, [topicId, model])

  // Load messages on mount or when topicId changes
  useEffect(() => {
    refreshMessages()
  }, [refreshMessages])

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      refreshMessages()
    }, 10000) // Refresh every 10 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, refreshMessages])

  return {
    messages,
    isLoading,
    error,
    hasMore,
    refreshMessages,
    loadMore,
    sendMessage
  }
}
