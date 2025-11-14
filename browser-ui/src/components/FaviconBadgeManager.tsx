/**
 * FaviconBadgeManager Component
 *
 * Manages the favicon badge showing unread message count.
 * Must be rendered inside ModelProvider to access useModel.
 */

import { useEffect } from 'react'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import { updateFaviconBadge, clearFaviconBadge, initFaviconThemeListener } from '@/utils/favicon-badge'

interface FaviconBadgeManagerProps {
  isTabVisible: boolean
  selectedConversationId?: string
  isAuthenticated: boolean
  modelInitialized: boolean
}

export function FaviconBadgeManager({
  isTabVisible,
  selectedConversationId,
  isAuthenticated,
  modelInitialized
}: FaviconBadgeManagerProps) {
  // Track unread messages (safe to call here - inside ModelProvider)
  const { totalUnread, markConversationRead } = useUnreadMessages()

  // Initialize theme change listener on mount
  useEffect(() => {
    initFaviconThemeListener()
  }, [])

  // Update favicon badge based on tab visibility and unread count
  useEffect(() => {
    if (!isAuthenticated || !modelInitialized) {
      // Not logged in - clear any badge
      clearFaviconBadge()
      return
    }

    if (isTabVisible) {
      // Tab is visible - always clear badge (user is looking at the app)
      clearFaviconBadge()
    } else {
      // Tab is hidden - show badge if there are unread messages
      if (totalUnread > 0) {
        console.log('[FaviconBadgeManager] Updating favicon badge:', totalUnread)
        updateFaviconBadge(totalUnread)
      } else {
        clearFaviconBadge()
      }
    }
  }, [isTabVisible, totalUnread, isAuthenticated, modelInitialized])

  // Mark conversation as read when viewing it
  // Update continuously while viewing to keep messages marked as read in real-time
  useEffect(() => {
    if (!selectedConversationId || !isTabVisible) {
      return
    }

    // Mark as read immediately
    markConversationRead(selectedConversationId)

    // Keep marking as read every second while viewing (prevents AI responses from being counted as unread)
    const intervalId = setInterval(() => {
      markConversationRead(selectedConversationId)
    }, 1000)

    return () => {
      clearInterval(intervalId)
    }
  }, [selectedConversationId, isTabVisible, markConversationRead])

  // This component doesn't render anything - it just manages the favicon
  return null
}
