/**
 * useUnreadMessages Hook
 *
 * Tracks the total count of unread messages across all conversations using ONE.core storage.
 * Uses MessageReadStatus versioned objects to persist read state per conversation.
 */

import { useState, useEffect, useCallback } from 'react'
import { useModel } from '@/model/index.js'
import { usePlans } from '@lama/ui'
import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js'
import { getObjectByIdHash } from '@refinio/one.core/lib/storage-versioned-objects.js'
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js'
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js'
import type { MessageReadStatus } from '@OneObjectInterfaces'

interface UnreadCounts {
  [conversationId: string]: number
}

interface UseUnreadMessagesReturn {
  totalUnread: number
  unreadByConversation: UnreadCounts
  markConversationRead: (conversationId: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export function useUnreadMessages(): UseUnreadMessagesReturn {
  const model = useModel()
  const { chat } = usePlans()
  const [unreadByConversation, setUnreadByConversation] = useState<UnreadCounts>({})

  // Calculate total unread count
  const totalUnread = Object.values(unreadByConversation).reduce((sum, count) => sum + count, 0)

  /**
   * Get or create MessageReadStatus for a conversation
   */
  const getReadStatus = useCallback(async (conversationId: string): Promise<MessageReadStatus | null> => {
    if (!model.initialized || !model.ownerId) return null

    try {
      // Calculate ID hash for this status object
      const statusId: MessageReadStatus = {
        $type$: 'MessageReadStatus',
        conversationId,
        userId: model.ownerId,
        lastReadTimestamp: 0,
        unreadCount: 0,
        updatedAt: 0
      }
      const idHash = await calculateIdHashOfObj(statusId) as SHA256IdHash<MessageReadStatus>

      // Try to get existing status
      const existing = await getObjectByIdHash(idHash)
      return existing as MessageReadStatus
    } catch (e) {
      // Not found - return null
      return null
    }
  }, [model.initialized, model.ownerId])

  /**
   * Update MessageReadStatus for a conversation
   */
  const updateReadStatus = useCallback(async (conversationId: string, lastMessageHash?: string) => {
    if (!model.initialized || !model.ownerId) return

    try {
      // Get current messages to calculate unread count
      const response = await chat.getMessages({
        conversationId,
        limit: 100
      })

      if (!response.success || !response.messages) return

      const now = Date.now()

      // Create or update status object
      const status: MessageReadStatus = {
        $type$: 'MessageReadStatus',
        conversationId,
        userId: model.ownerId,
        lastReadMessageHash: lastMessageHash || response.messages[response.messages.length - 1]?.hash,
        lastReadTimestamp: now,
        unreadCount: 0, // User is actively viewing - no unread
        updatedAt: now
      }

      // Store as versioned object
      await storeVersionedObject(status)

      // Update local state
      setUnreadByConversation(prev => ({
        ...prev,
        [conversationId]: 0
      }))
    } catch (e) {
      console.error('[useUnreadMessages] Failed to update read status:', e)
    }
  }, [model.initialized, model.ownerId, chat])

  /**
   * Mark a conversation as read (update MessageReadStatus)
   */
  const markConversationRead = useCallback(async (conversationId: string) => {
    await updateReadStatus(conversationId)
  }, [updateReadStatus])

  /**
   * Mark all conversations as read
   */
  const markAllRead = useCallback(async () => {
    if (!model.initialized) return

    try {
      // Get all conversations
      const response = await chat.getConversations({ limit: 100 })
      if (!response.success || !response.data) return

      // Update status for each conversation
      await Promise.all(
        response.data.map(conv => updateReadStatus(conv.id))
      )
    } catch (e) {
      console.error('[useUnreadMessages] Failed to mark all read:', e)
    }
  }, [model.initialized, chat, updateReadStatus])

  /**
   * Calculate unread count for a conversation based on MessageReadStatus
   */
  const calculateUnreadCount = useCallback(async (conversationId: string): Promise<number> => {
    if (!model.initialized) return 0

    try {
      // Get read status
      const status = await getReadStatus(conversationId)
      if (!status) {
        // No status yet - all messages are unread
        const response = await chat.getMessages({ conversationId, limit: 100 })
        return response.success && response.messages ? response.messages.length : 0
      }

      // Get messages
      const response = await chat.getMessages({ conversationId, limit: 100 })
      if (!response.success || !response.messages) return 0

      // Count messages newer than last read
      const unreadCount = response.messages.filter(
        msg => msg.timestamp > status.lastReadTimestamp
      ).length

      return unreadCount
    } catch (e) {
      console.error('[useUnreadMessages] Failed to calculate unread count:', e)
      return 0
    }
  }, [model.initialized, chat, getReadStatus])

  /**
   * Listen to channel updates and recalculate unread counts
   */
  useEffect(() => {
    if (!model.initialized) return

    const updateUnreadCount = async (
      channelInfoIdHash: any,
      _channelId: string,  // NOT used - this is channel identifier, not topic ID
      channelOwner: any,
      timeOfEarliestChange: number,
      data: any
    ) => {
      try {
        // CRITICAL: channelId from onUpdated is NOT a topic ID!
        // We must find the Topic that references this channel via Topic.channel === channelInfoIdHash
        const allTopics = await model.topicModel.topics.all()
        const topic = allTopics.find((t: any) => t.channel === channelInfoIdHash)

        if (!topic) {
          // No topic found for this channel - skip (might be a system channel)
          return
        }

        // Calculate topic ID hash for use as conversation identifier
        const conversationId = await calculateIdHashOfObj(topic)

        // Check if user is actively viewing this conversation
        const status = await getReadStatus(conversationId)
        if (status) {
          const isActivelyViewing = (Date.now() - status.lastReadTimestamp) < 2000
          if (isActivelyViewing) {
            // Keep unread count at 0 for actively viewed conversations
            setUnreadByConversation(prev => ({
              ...prev,
              [conversationId]: 0
            }))
            return
          }
        }

        // Recalculate unread count
        const unreadCount = await calculateUnreadCount(conversationId)

        // Update local state
        setUnreadByConversation(prev => ({
          ...prev,
          [conversationId]: unreadCount
        }))
      } catch (e) {
        console.error('[useUnreadMessages] Failed to update unread count:', e)
      }
    }

    // Subscribe to channel updates
    const unsubscribe = model.channelManager.onUpdated(updateUnreadCount)

    return () => {
      unsubscribe()
    }
  }, [model.initialized, model.channelManager, getReadStatus, calculateUnreadCount])

  /**
   * Initial load of unread counts
   */
  useEffect(() => {
    const loadInitialUnreadCounts = async () => {
      if (!model.initialized) return

      try {
        // Get all conversations
        const response = await chat.getConversations({ limit: 100 })
        if (!response.success || !response.data) return

        const counts: UnreadCounts = {}

        // For each conversation, calculate unread count
        await Promise.all(
          response.data.map(async conv => {
            counts[conv.id] = await calculateUnreadCount(conv.id)
          })
        )

        setUnreadByConversation(counts)
      } catch (e) {
        console.error('[useUnreadMessages] Failed to load initial unread counts:', e)
      }
    }

    loadInitialUnreadCounts()
  }, [model.initialized, chat, calculateUnreadCount])

  return {
    totalUnread,
    unreadByConversation,
    markConversationRead,
    markAllRead
  }
}
