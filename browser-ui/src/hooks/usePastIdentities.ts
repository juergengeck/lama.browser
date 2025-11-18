/**
 * usePastIdentities Hook
 *
 * React hook for fetching past identities for AI conversations
 */

import { useState, useEffect } from 'react'
import { useModel } from '@/model/index.js'

export interface PastIdentity {
  personId: string
  name: string
}

interface UsePastIdentitiesReturn {
  pastIdentitiesMap: Map<string, PastIdentity[]>
  isLoading: boolean
  error: Error | null
  refreshPastIdentities: (topicId: string) => Promise<void>
}

export function usePastIdentities(topicIds: string[]): UsePastIdentitiesReturn {
  const model = useModel()
  const [pastIdentitiesMap, setPastIdentitiesMap] = useState<Map<string, PastIdentity[]>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchPastIdentities = async (topicId: string): Promise<PastIdentity[]> => {
    if (!model.initialized || !model.aiAssistantPlan) {
      return []
    }

    try {
      const identities = await model.aiAssistantPlan.getPastIdentities(topicId)
      return identities.map(identity => ({
        personId: identity.personId.toString(),
        name: identity.name
      }))
    } catch (err) {
      console.error(`[usePastIdentities] Failed to fetch for topic ${topicId}:`, err)
      return []
    }
  }

  const refreshPastIdentities = async (topicId: string) => {
    const identities = await fetchPastIdentities(topicId)
    setPastIdentitiesMap(prev => new Map(prev).set(topicId, identities))
  }

  // Fetch past identities for all AI topics
  useEffect(() => {
    if (!model.initialized || topicIds.length === 0) {
      return
    }

    async function loadPastIdentities() {
      setIsLoading(true)
      setError(null)

      try {
        const newMap = new Map<string, PastIdentity[]>()

        await Promise.all(
          topicIds.map(async (topicId) => {
            const identities = await fetchPastIdentities(topicId)
            if (identities.length > 0) {
              newMap.set(topicId, identities)
            }
          })
        )

        setPastIdentitiesMap(newMap)
      } catch (err) {
        console.error('[usePastIdentities] Failed to load past identities:', err)
        setError(err instanceof Error ? err : new Error('Failed to load past identities'))
      } finally {
        setIsLoading(false)
      }
    }

    loadPastIdentities()
  }, [model.initialized, topicIds.join(',')])

  return {
    pastIdentitiesMap,
    isLoading,
    error,
    refreshPastIdentities
  }
}
