/**
 * useMessages Hook - Platform-Agnostic
 *
 * React hook for managing messages in a topic using usePlans()
 */

import { useState, useEffect, useCallback } from 'react'
import { useModel } from '@/model/index.js'
import { usePlans } from '@lama/ui'

export interface Message {
  $type$: 'Message'
  id: string
  topic: string
  author: any // SHA256IdHash<Person>
  sender?: any // Alias for author (for compatibility)
  senderName?: string // Human-readable sender name (from ChatPlan)
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
  // Keep Model for platform-specific features (initialized, channelManager)
  const model = useModel()

  // Use Plans for platform-agnostic operations
  const { chat } = usePlans()

  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const refreshMessages = useCallback(async () => {
    console.log(`[useMessages] 🔄 Refreshing messages for topic: ${topicId}`);

    try {
      setIsLoading(true)
      setError(null)

      // Platform-agnostic message fetching
      console.log(`[useMessages] 📞 Calling ChatPlan.getMessages...`);
      const response = await chat.getMessages({
        conversationId: topicId,
        limit,
        offset: 0
      })

      console.log(`[useMessages] 📨 Received response:`, {
        success: response.success,
        messageCount: response.messages?.length || 0,
        error: response.error
      });

      if (response.success && response.messages) {
        const newMessages = response.messages as Message[]
        console.log(`[useMessages] ✅ Processing ${newMessages.length} messages`);

        // Merge with existing messages instead of replacing
        // Deduplicate by message ID (hash)
        setMessages(prev => {
          const messageMap = new Map<string, Message>()

          // Add existing messages first
          prev.forEach(msg => {
            if (msg.id) {
              messageMap.set(msg.id, msg)
            }
          })

          // Add/update with new messages (overwrites duplicates)
          newMessages.forEach(msg => {
            if (msg.id) {
              messageMap.set(msg.id, msg)
            }
          })

          // Convert back to array and sort by timestamp
          const merged = Array.from(messageMap.values())
          merged.sort((a, b) => a.timestamp - b.timestamp)

          console.log(`[useMessages] ✅ Merged ${merged.length} messages (${newMessages.length} new)`);
          return merged
        })

        setHasMore(response.hasMore || false)
        setOffset(0) // Reset pagination
      } else {
        console.error(`[useMessages] ❌ Response not successful:`, response.error);
        throw new Error(response.error || 'Failed to fetch messages')
      }
    } catch (err) {
      console.error('[useMessages] ❌ Failed to fetch messages:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch messages'))
    } finally {
      setIsLoading(false)
      console.log(`[useMessages] ✅ Refresh complete - ${messages.length} messages in state`);
    }
  }, [topicId, limit, chat])

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return

    try {
      setIsLoading(true)

      const newOffset = offset + limit

      const response = await chat.getMessages({
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
  }, [topicId, limit, hasMore, isLoading, offset, chat])

  const sendMessage = useCallback(async (
    content: string,
    attachments?: any[]
  ): Promise<Message> => {
    try {
      // Use Model's wrapper that triggers AI response
      const message = await model.sendMessageWithAI(topicId, content, attachments)

      // Don't optimistically add - channel listener will handle it
      // This prevents duplicate messages (one from optimistic add, one from channel update)

      return message as Message
    } catch (err) {
      console.error('[useMessages] Failed to send message:', err)
      throw err
    }
  }, [topicId, model])

  // Load messages on mount or when topicId changes
  useEffect(() => {
    refreshMessages()
  }, [refreshMessages])

  // Listen to channel updates for this topic
  useEffect(() => {
    if (!model.initialized) return

    console.log(`[useMessages] Setting up channel listener for topic ${topicId}`)

    // Subscribe to channel updates for this topic
    const unsubscribe = model.channelManager.onUpdated(async (
      channelInfoIdHash,
      channelId,
      channelOwner,
      timeOfEarliestChange,
      data
    ) => {
      // Check if this update is for our topic
      if (channelId === topicId) {
        // Refresh messages to get the latest (will merge with existing)
        await refreshMessages()
      }
    })

    return () => {
      unsubscribe()
    }
  }, [model.initialized, model.channelManager, topicId, refreshMessages])

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      refreshMessages()
    }, 10000) // Refresh every 10 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, refreshMessages])

  // NOTE: Streaming is handled by ChatView via aiStreamingContent prop to MessageView
  // This hook only manages the persisted messages array
  // When streaming completes, ai:messageComplete triggers a channel update,
  // which causes this hook to refresh and fetch the new message

  const allMessages = messages

  return {
    messages: allMessages,
    isLoading,
    error,
    hasMore,
    refreshMessages,
    loadMore,
    sendMessage
  }
}
