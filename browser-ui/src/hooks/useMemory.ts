/**
 * useMemory - Hook for accessing memory data
 *
 * Fetches subjects from ALL topics using the same topicAnalysis plan that
 * works for per-chat subjects. Aggregates and deduplicates across topics.
 */

import { useState, useEffect, useCallback } from 'react'
import { useModel } from '@/model/ModelContext'
import { usePlans } from '@refinio/lama.ui'

export interface MemorySubject {
  id: string
  idHash?: string
  description: string
  keywords: string[]
  sources: Array<{
    type: string
    id: string
    extractedAt: number
  }>
  createdAt?: number
  lastSeenAt?: number
  topic?: string
}

export interface MemoryStats {
  initialized: boolean
  subjectCount: number
  keywordCount: number
  topicCount: number
}

export function useMemory() {
  const model = useModel()
  const { topicAnalysis, chat } = usePlans()
  const [subjects, setSubjects] = useState<MemorySubject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<MemoryStats>({
    initialized: false,
    subjectCount: 0,
    keywordCount: 0,
    topicCount: 0
  })

  // Load all subjects from all topics
  const loadSubjects = useCallback(async () => {
    if (!model.initialized) {
      console.log('[useMemory] Model not initialized yet')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Get all conversations/topics
      const conversationsResponse = await chat.getConversations({})
      // Note: response.data is the array directly, not response.data.conversations
      const conversations = conversationsResponse.success
        ? (conversationsResponse.data || [])
        : []

      console.log('[useMemory] Found', conversations.length, 'topics to scan')

      // Fetch subjects from each topic
      const allSubjects: MemorySubject[] = []
      const allKeywords = new Set<string>()
      const seenIdHashes = new Set<string>()

      for (const conv of conversations) {
        try {
          const topicId = conv.id || conv.topicId
          if (!topicId) continue

          const response = await topicAnalysis.getSubjects({
            topicId,
            includeArchived: false
          })

          if (response.success && response.data?.subjects) {
            for (const subject of response.data.subjects) {
              // Deduplicate by idHash
              const idHash = subject.idHash || subject.hash
              if (idHash && seenIdHashes.has(idHash)) {
                continue
              }
              if (idHash) seenIdHashes.add(idHash)

              // Collect keywords
              const keywords = subject.keywords || []
              keywords.forEach((k: string) => allKeywords.add(k))

              allSubjects.push({
                id: idHash || subject.description || `subject-${allSubjects.length}`,
                idHash,
                description: subject.description || keywords.slice(0, 3).join(', ') || 'Untitled',
                keywords,
                sources: [{
                  type: 'topic',
                  id: topicId,
                  extractedAt: subject.createdAt || Date.now()
                }],
                createdAt: subject.createdAt,
                lastSeenAt: subject.lastSeenAt,
                topic: topicId
              })
            }
          }
        } catch (err) {
          console.warn('[useMemory] Failed to load subjects for topic:', conv.id, err)
        }
      }

      // Sort by lastSeenAt (most recent first)
      allSubjects.sort((a, b) =>
        (b.lastSeenAt || b.createdAt || 0) - (a.lastSeenAt || a.createdAt || 0)
      )

      setSubjects(allSubjects)
      setStats({
        initialized: true,
        subjectCount: allSubjects.length,
        keywordCount: allKeywords.size,
        topicCount: conversations.length
      })

      console.log('[useMemory] Loaded', allSubjects.length, 'subjects with',
        allKeywords.size, 'unique keywords from', conversations.length, 'topics')

    } catch (err) {
      console.error('[useMemory] Failed to load subjects:', err)
      setError(err instanceof Error ? err.message : 'Failed to load memory')
    } finally {
      setLoading(false)
    }
  }, [model, topicAnalysis, chat])

  // Search subjects by keywords
  const searchByKeywords = useCallback(async (keywords: string[], limit: number = 10) => {
    if (!model.initialized || !model.memoryPlan) {
      return []
    }

    try {
      const results = await model.memoryPlan.searchByKeywords(keywords, limit)
      return results
    } catch (err) {
      console.error('[useMemory] Search failed:', err)
      return []
    }
  }, [model])

  // Get subjects for a specific chat
  const getSubjectsForChat = useCallback(async (topicId: string) => {
    if (!model.initialized || !model.memoryPlan) {
      return []
    }

    try {
      return await model.memoryPlan.getSubjectsForChat(topicId)
    } catch (err) {
      console.error('[useMemory] getSubjectsForChat failed:', err)
      return []
    }
  }, [model])

  // Initial load
  useEffect(() => {
    loadSubjects()
  }, [model.initialized])

  return {
    subjects,
    stats,
    loading,
    error,
    refresh: loadSubjects,
    searchByKeywords,
    getSubjectsForChat
  }
}

/**
 * Get all unique keywords across all subjects
 */
export function useMemoryKeywords() {
  const { subjects, loading } = useMemory()

  const keywords = subjects.reduce((acc, subject) => {
    subject.keywords.forEach(k => {
      if (!acc.includes(k)) {
        acc.push(k)
      }
    })
    return acc
  }, [] as string[])

  return { keywords, loading }
}
