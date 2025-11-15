/**
 * useContactAvatar Hook
 *
 * Loads and caches profile avatars for contacts
 */

import { useState, useEffect } from 'react'
import { useModel } from '@/model/ModelContext'
import { readBlobAsArrayBuffer } from '@refinio/one.core/lib/storage-blob.js'
import type { SHA256Hash, SHA256IdHash, BLOB, Person } from '@refinio/one.core/lib/recipes.js'

interface AvatarData {
  url: string | null
  loading: boolean
  error: string | null
}

// Global cache to avoid re-fetching the same avatar
const avatarCache = new Map<string, string>()

export function useContactAvatar(personId: SHA256IdHash<Person> | string | null): AvatarData {
  const model = useModel()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!personId || !model.initialized) {
      setAvatarUrl(null)
      return
    }

    // Check cache first
    const cached = avatarCache.get(personId)
    if (cached) {
      setAvatarUrl(cached)
      return
    }

    loadAvatar()
  }, [personId, model.initialized])

  const loadAvatar = async () => {
    if (!personId || !model.initialized) return

    setLoading(true)
    setError(null)

    try {
      const someone = await model.leuteModel.getSomeone(personId as SHA256IdHash<Person>)
      if (!someone) {
        setLoading(false)
        return
      }

      const profile = await someone.mainProfile()
      if (!profile || !profile.personDescriptions) {
        setLoading(false)
        return
      }

      // Find ProfileImage
      const imageDesc = profile.personDescriptions.find((d: any) => d.$type$ === 'ProfileImage')
      if (imageDesc && 'image' in imageDesc) {
        const blobHash = imageDesc.image as SHA256Hash<BLOB>

        // Read BLOB and create preview URL
        const arrayBuffer = await readBlobAsArrayBuffer(blobHash)
        const blob = new Blob([arrayBuffer])
        const url = URL.createObjectURL(blob)

        // Cache it
        avatarCache.set(personId, url)
        setAvatarUrl(url)
      }
    } catch (err) {
      console.error('[useContactAvatar] Failed to load avatar:', err)
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return {
    url: avatarUrl,
    loading,
    error
  }
}

/**
 * Clear avatar cache (useful when profile is updated)
 */
export function clearAvatarCache(personId?: string) {
  if (personId) {
    const cached = avatarCache.get(personId)
    if (cached) {
      URL.revokeObjectURL(cached)
      avatarCache.delete(personId)
    }
  } else {
    // Clear all cached avatars
    avatarCache.forEach(url => URL.revokeObjectURL(url))
    avatarCache.clear()
  }
}
