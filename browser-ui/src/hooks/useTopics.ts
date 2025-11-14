/**
 * useTopics Hook
 *
 * React hook for managing topics/conversations using Model and ChatHandler
 */

import { useState, useEffect, useCallback } from 'react'
import { useModel } from '@/model/index.js'

export interface Topic {
  $type$: 'Topic'
  id: string
  name: string
  participants: any[] // SHA256IdHash<Person>[]
  createdBy: any // SHA256IdHash<Person>
  created: number
  lastActivity: number
  lastMessage?: string // Preview of the last message
  isAITopic?: boolean // Whether this topic has an AI participant
  aiModelId?: string // LLM model ID if this is an AI topic
  modelName?: string // Human-readable model name (e.g., "Llama 3.2 3B")
}

interface UseTopicsReturn {
  topics: Topic[]
  isLoading: boolean
  error: Error | null
  refreshTopics: () => Promise<void>
  createTopic: (name: string, participantIds: string[], aiModelId?: string) => Promise<Topic>
  deleteTopic: (topicId: string) => Promise<void>
  renameTopic: (topicId: string, newName: string) => Promise<void>
  updateTopicLastMessage: (topicId: string, lastMessage: string) => void
}

export function useTopics(): UseTopicsReturn {
  const model = useModel()
  const [topics, setTopics] = useState<Topic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refreshTopics = useCallback(async () => {
    // CRITICAL: Do not call before Instance is created
    // Instance is owner-specific and created during login
    // Storage operations require owner context
    if (!model.initialized) {
      console.log('[useTopics] ⏸️ Skipping refresh - model not initialized (no Instance yet)')
      setIsLoading(false)
      return
    }

    console.log('[useTopics] 🔄 Refreshing topics...');

    try {
      setIsLoading(true)
      setError(null)

      // Default AI chats are created during aiAssistantModel.init()
      // No need to call ensureDefaultChats() here - it's handled during initialization

      // Call ChatHandler.getConversations (topics and conversations are the same)
      console.log('[useTopics] 📞 Calling ChatPlan.getConversations...');
      const response = await model.chatPlan.getConversations({
        limit: 100,  // Get all topics
        offset: 0
      })

      console.log('[useTopics] 📨 ChatPlan response:', {
        success: response.success,
        dataLength: response.data?.length || 0,
        firstTopic: response.data?.[0],
        error: response.error
      });

      if (response.success && response.data) {
        console.log(`[useTopics] ✅ Setting ${response.data.length} topics in state`);
        console.log('[useTopics] 📋 Topics data:', response.data);
        const typedTopics = response.data as Topic[];
        setTopics(typedTopics);
        // Verify what we're setting
        console.log('[useTopics] 📋 Setting topics:', typedTopics.map(t => ({ id: t.id, name: t.name })));
      } else {
        console.error(`[useTopics] ❌ Response not successful:`, response.error);
        throw new Error(response.error || 'Failed to fetch topics')
      }
    } catch (err) {
      console.error('[useTopics] ❌ Failed to fetch topics:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch topics'))
    } finally {
      setIsLoading(false)
      // Note: topics here is stale closure value - actual state updates on next render
      console.log(`[useTopics] ✅ Refresh complete (stale closure shows ${topics.length}, actual state will update on next render)`);
    }
  }, [model])

  const createTopic = useCallback(async (name: string, participantIds: string[], aiModelId?: string): Promise<Topic> => {
    try {
      const response = await model.chatPlan.createConversation({
        name,
        participants: participantIds,
        type: participantIds.length > 1 ? 'group' : 'direct',
        aiModelId // Pass AI model ID if provided
      })

      if (response.success && response.data) {
        // Refresh topics to include the new one
        await refreshTopics()
        return response.data as Topic
      } else {
        throw new Error(response.error || 'Failed to create topic')
      }
    } catch (err) {
      console.error('[useTopics] Failed to create topic:', err)
      throw err
    }
  }, [model, refreshTopics])

  const deleteTopic = useCallback(async (topicId: string): Promise<void> => {
    // Optimistically remove from UI
    setTopics(prev => prev.filter(t => t.id !== topicId))

    try {
      // TODO: ChatHandler doesn't have deleteTopic yet
      console.log('[useTopics] Delete topic (not implemented):', topicId)
      // When implemented: await model.chatPlan.deleteTopic({ topicId })
    } catch (err) {
      console.error('[useTopics] Failed to delete topic:', err)
      // Reload to restore if delete failed
      await refreshTopics()
      throw err
    }
  }, [refreshTopics])

  const renameTopic = useCallback(async (topicId: string, newName: string): Promise<void> => {
    // Optimistically update in UI
    setTopics(prev => prev.map(t => t.id === topicId ? { ...t, name: newName } : t))

    try {
      // TODO: ChatHandler doesn't have renameTopic yet
      console.log('[useTopics] Rename topic (not implemented):', topicId, 'to', newName)
      // When implemented: await model.chatPlan.renameTopic({ topicId, newName })
    } catch (err) {
      console.error('[useTopics] Failed to rename topic:', err)
      // Reload to restore if rename failed
      await refreshTopics()
      throw err
    }
  }, [refreshTopics])

  const updateTopicLastMessage = useCallback((topicId: string, lastMessage: string) => {
    // Optimistically update the lastMessage for the topic
    setTopics(prev => prev.map(t =>
      t.id === topicId
        ? { ...t, lastMessage, lastActivity: Date.now() }
        : t
    ))
  }, [])

  // Debug: Log when topics state actually changes
  useEffect(() => {
    console.log(`[useTopics] 📊 Topics state changed: ${topics.length} topics`, topics.map(t => ({ id: t.id, name: t.name })));
  }, [topics]);

  // Load topics when model is ready (not on mount)
  // This prevents wasteful double-refresh: mount call would skip (model not ready),
  // then model ready event would trigger a second refresh
  useEffect(() => {
    // If already initialized, refresh immediately
    if (model.initialized) {
      console.log('[useTopics] Model already initialized - refreshing topics')
      refreshTopics()
    }

    // Listen for model initialization and refresh topics when ready
    const handler = () => {
      console.log('[useTopics] Model initialized - refreshing topics to ensure default chats')
      refreshTopics()
    }

    // Subscribe to model ready event using OEvent.listen()
    // Returns a disconnect function
    const disconnect = model.onOneModelsReady.listen(handler)

    // Cleanup - call disconnect function returned by listen()
    return disconnect
  }, [model, refreshTopics])

  return {
    topics,
    isLoading,
    error,
    refreshTopics,
    createTopic,
    deleteTopic,
    renameTopic,
    updateTopicLastMessage
  }
}
