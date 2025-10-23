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
}

interface UseTopicsReturn {
  topics: Topic[]
  isLoading: boolean
  error: Error | null
  refreshTopics: () => Promise<void>
  createTopic: (name: string, participantIds: string[]) => Promise<Topic>
  deleteTopic: (topicId: string) => Promise<void>
  renameTopic: (topicId: string, newName: string) => Promise<void>
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
      console.log('[useTopics] Skipping refresh - model not initialized (no Instance yet)')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Ensure default AI chats exist before fetching conversations
      // Use AIAssistantHandler (browser architecture) instead of AIHandler (Electron architecture)
      console.log('[useTopics] Ensuring default AI chats exist...')
      await model.aiAssistantModel.ensureDefaultChats()
      console.log('[useTopics] Default chats ensured')

      // Call ChatHandler.getConversations (topics and conversations are the same)
      const response = await model.chatHandler.getConversations({
        limit: 100,  // Get all topics
        offset: 0
      })

      if (response.success && response.data) {
        setTopics(response.data as Topic[])
      } else {
        throw new Error(response.error || 'Failed to fetch topics')
      }
    } catch (err) {
      console.error('[useTopics] Failed to fetch topics:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch topics'))
    } finally {
      setIsLoading(false)
    }
  }, [model])

  const createTopic = useCallback(async (name: string, participantIds: string[]): Promise<Topic> => {
    try {
      const response = await model.chatHandler.createConversation({
        name,
        participants: participantIds,
        type: participantIds.length > 1 ? 'group' : 'direct'
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
      // When implemented: await model.chatHandler.deleteTopic({ topicId })
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
      // When implemented: await model.chatHandler.renameTopic({ topicId, newName })
    } catch (err) {
      console.error('[useTopics] Failed to rename topic:', err)
      // Reload to restore if rename failed
      await refreshTopics()
      throw err
    }
  }, [refreshTopics])

  // Load topics on mount
  useEffect(() => {
    refreshTopics()
  }, [refreshTopics])

  // Listen for model initialization and refresh topics when ready
  useEffect(() => {
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
    renameTopic
  }
}
