/**
 * MessageView - Platform-Agnostic Component
 *
 * Uses usePlans() for platform-agnostic access to contacts plan.
 * - Contact names loaded through contacts plan
 * - Proposals handled by useProposals hook
 * - Attachments managed by AttachmentService
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Avatar, AvatarFallback } from '@lama/ui'
import { Loader2, ChevronDown } from 'lucide-react'
import './MessageView.css'
import { useModel } from '@/model/index.js'
import { usePlans } from '@lama/ui'

// TODO: Replace with proper types from worker messages
type Message = {
  id: string
  content: string
  timestamp: number
  author: string
}

// Import enhanced components
import { EnhancedMessageInput, type EnhancedAttachment } from './chat/EnhancedMessageInput'
import { EnhancedMessageBubble, type EnhancedMessageData } from './chat/EnhancedMessageBubble'

// Import attachment system
import { attachmentService } from '@/services/attachments/AttachmentService'
import { createAttachmentView } from '@lama/ui'
import type { MessageAttachment, BlobDescriptor } from '@/types/attachments'

// Import keyword detail panel
import { KeywordDetailPanel } from './KeywordDetail/KeywordDetailPanel'

// Import proposal carousel
import { ProposalCarousel } from './ProposalCarousel'
import { useProposals } from '@/hooks/useProposals'

// Import throttled streaming content hook
import { useThrottledStreamingContent } from '@/hooks/useThrottledStreamingContent'

interface MessageViewProps {
  messages: Message[]
  currentUserId?: string
  onSendMessage: (content: string, attachments?: MessageAttachment[]) => Promise<void>
  placeholder?: string
  showSender?: boolean
  loading?: boolean
  participants?: string[] // List of participant IDs to determine if multiple people
  isAIProcessing?: boolean // Show typing indicator when AI is processing
  aiStreamingContent?: string // Show partial AI response while streaming
  aiModelName?: string // Model name for streaming responses
  aiError?: string | null // Error message from AI processing
  topicId?: string // Topic ID for context panel
}

export function MessageView({
  messages,
  currentUserId,
  onSendMessage,
  placeholder = 'Type a message...',
  showSender = true,
  loading = false,
  participants = [],
  isAIProcessing = false,
  aiStreamingContent = '',
  aiModelName,
  aiError = null,
  topicId
}: MessageViewProps) {
  // Keep Model for platform-specific features (initialized, currentUserId)
  const model = useModel()

  // Use Plans for platform-agnostic operations
  const { contacts } = usePlans()

  const [contactNames, setContactNames] = useState<Record<string, string>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false)

  // Store attachment descriptors for display
  const [attachmentDescriptors, setAttachmentDescriptors] = useState<Map<string, BlobDescriptor>>(new Map())

  // Load attachments for received messages
  useEffect(() => {
    const loadAttachments = async () => {
      for (const msg of messages) {
        if (msg.attachments && msg.attachments.length > 0) {
          for (const attachment of msg.attachments) {
            const hash = attachment.hash.toString()
            // Check against current state value, not stale closure
            setAttachmentDescriptors(prev => {
              if (!prev.has(hash)) {
                // Load attachment asynchronously
                attachmentService.getAttachment(attachment.hash)
                  .then(result => {
                    if (result) {
                      // Transform AttachmentService response to BlobDescriptor
                      // Use metadata from MessageAttachment if available, otherwise from BLOB storage
                      const descriptor: BlobDescriptor = {
                        data: result.data,
                        type: attachment.mimeType || result.metadata.mimeType,
                        name: attachment.name || result.metadata.name,
                        size: attachment.size || result.metadata.size,
                        lastModified: Date.now() // ONE.core BLOBs don't store lastModified
                      }
                      setAttachmentDescriptors(current => new Map(current).set(hash, descriptor))
                    }
                  })
                  .catch(error => {
                    console.error(`[MessageView] Failed to load attachment ${hash}:`, error)
                  })
              }
              return prev
            })
          }
        }
      }
    }
    loadAttachments()
  }, [messages])

  // Throttle streaming content updates for better markdown rendering performance
  const throttledStreamingContent = useThrottledStreamingContent(aiStreamingContent, isAIProcessing)

  // Keyword detail dialog state
  const [showKeywordDetail, setShowKeywordDetail] = useState(false)
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null)

  // Proposal carousel
  const {
    proposals,
    currentIndex,
    loading: proposalsLoading,
    error: proposalsError,
    nextProposal,
    previousProposal,
    dismissProposal,
    shareProposal
  } = useProposals({
    topicId: topicId || '',
    autoRefresh: true
  })


  // Load contact names
  useEffect(() => {
    const loadContactNames = async () => {
      if (!model.initialized) return

      try {
        // Platform-agnostic contact loading
        const result = await contacts.getContacts()
        if (!result.success || !result.data) return

        const names: Record<string, string> = {}

        // Map contact IDs to names
        for (const contact of result.data) {
          if (contact.id) {
            names[contact.id] = contact.name || contact.displayName || 'Unknown'
          }
        }

        // Don't add "You" label - users aren't idiots

        setContactNames(names)
      } catch (error) {
        console.error('Failed to load contact names:', error)
      }
    }

    loadContactNames()
  }, [currentUserId, contacts])
  
  // Track user scroll position - only update if not auto-scrolling
  const isAutoScrollingRef = useRef(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleScroll = useCallback(() => {
    if (!scrollAreaRef.current) return

    // Don't update scroll state if we're auto-scrolling
    if (isAutoScrollingRef.current) return

    // Throttle scroll updates to prevent infinite loops during streaming
    if (scrollTimeoutRef.current) return

    scrollTimeoutRef.current = setTimeout(() => {
      scrollTimeoutRef.current = null

      if (!scrollAreaRef.current) return

      const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight

      // Consider user at bottom if within 50px
      const isScrolledUp = distanceFromBottom > 50

      // Only update state if it actually changed
      setIsUserScrolledUp(prev => prev === isScrolledUp ? prev : isScrolledUp)
    }, 100) // 100ms throttle
  }, [])

  // Reset scroll tracking when topic changes
  useEffect(() => {
    setIsUserScrolledUp(false)
  }, [topicId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // If user has scrolled up, don't auto-scroll
    if (isUserScrolledUp) return

    // Skip if no messages
    if (messages.length === 0) return

    // Scroll to bottom - always use instant to avoid visible animations
    isAutoScrollingRef.current = true
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({
          behavior: 'instant',
          block: 'start' // Put marker at top of viewport = shows latest messages
        })
        // Clear flag after scroll completes
        setTimeout(() => {
          isAutoScrollingRef.current = false
        }, 100)
      }
    })
  }, [messages.length, isUserScrolledUp])



  // Enhanced send handler with proper attachment storage
  const handleEnhancedSend = async (text: string, attachments?: EnhancedAttachment[]) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) {
      return
    }

    try {
      // Extract hashtags from text
      const hashtagRegex = /#[\w-]+/g
      const hashtags = text.match(hashtagRegex) || []

      let messageContent = text
      const messageAttachments: MessageAttachment[] = []

      // Process and store attachments using AttachmentService
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          try {
            // Convert File to ArrayBuffer first
            const arrayBuffer = await attachment.file.arrayBuffer()

            // Store attachment in ONE platform
            const result = await attachmentService.storeAttachment(arrayBuffer, {
              name: attachment.file.name,
              mimeType: attachment.file.type || 'application/octet-stream',
              size: attachment.file.size
            })

            // Extract hash from result
            const hash = result.hash || result.id || result

            // Create message attachment reference
            const messageAttachment: MessageAttachment = {
              hash,
              type: 'blob',
              mimeType: attachment.file.type,
              name: attachment.file.name,
              size: attachment.file.size
            }
            messageAttachments.push(messageAttachment)

            // Cache the descriptor for immediate display
            const descriptor: BlobDescriptor = {
              data: await attachment.file.arrayBuffer(),
              type: attachment.file.type,
              name: attachment.file.name,
              size: attachment.file.size,
              lastModified: attachment.file.lastModified
            }
            setAttachmentDescriptors(prev => {
              const newMap = new Map(prev)
              newMap.set(hash, descriptor)
              return newMap
            })
          } catch (error) {
            console.error(`[MessageView] Failed to store attachment ${attachment.file.name}:`, error)
          }
        }
      }

      // Send the message with attachments
      await onSendMessage(messageContent, messageAttachments.length > 0 ? messageAttachments : undefined)

      // Reset scroll tracking - the auto-scroll effect will handle scrolling
      setIsUserScrolledUp(false)

    } catch (error) {
      console.error('Failed to send enhanced message:', error)
    }
  }

  // Handle hashtag clicks - open keyword detail dialog
  const handleHashtagClick = (hashtag: string) => {
    if (topicId) {
      // Open keyword detail dialog
      setSelectedKeyword(hashtag)
      setShowKeywordDetail(true)
    } else {
      // No topicId available - can't show context-specific details
      console.warn('[MessageView] Cannot show keyword detail - no topicId available')
      alert(`Search for #${hashtag} - Feature coming soon!`)
    }
  }

  const handleCloseKeywordDetail = () => {
    setShowKeywordDetail(false)
    setSelectedKeyword(null)
  }

  // Scroll to bottom handler
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      isAutoScrollingRef.current = true
      messagesEndRef.current.scrollIntoView({ behavior: 'instant', block: 'start' })
      setIsUserScrolledUp(false)
      setTimeout(() => {
        isAutoScrollingRef.current = false
      }, 100)
    }
  }

  // Handle attachment clicks
  const handleAttachmentClick = (attachmentId: string) => {
    // TODO: Implement attachment viewer
  }

  // Handle attachment downloads
  const handleDownloadAttachment = (attachmentId: string) => {
    // TODO: Implement attachment download
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loading-spinner" />
      </div>
    )
  }

  // Determine if we should show sender labels (only when multiple other participants)
  const otherParticipants = participants.filter(p => p !== currentUserId)
  const shouldShowSenderLabels = otherParticipants.length > 1

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Keyword Detail Panel - Inline at top */}
      {showKeywordDetail && selectedKeyword && topicId && (
        <div className="border-b border-gray-700 bg-gray-900/50 max-h-[25vh] overflow-y-auto ios-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
          <KeywordDetailPanel
            keyword={selectedKeyword}
            topicId={topicId}
            onClose={handleCloseKeywordDetail}
          />
        </div>
      )}

      <div
        className="flex-1 px-4 py-2 overflow-y-auto ios-scroll"
        ref={scrollAreaRef}
        onScroll={handleScroll}
        style={{
          minHeight: 0,
          WebkitOverflowScrolling: 'touch',
          overflowScrolling: 'touch'
        }}
      >
        <div className="space-y-4" style={{ paddingBottom: '8px' }}>
          {messages.length === 0 && !loading && !isAIProcessing && !aiStreamingContent && (
            <div className="text-center py-8 text-muted-foreground">
              No messages yet. Start a conversation!
            </div>
          )}
          {messages.map((message) => {
            // Check if this is the current user's message
            const isCurrentUser = message.sender === 'user' || message.sender === currentUserId
            // Use the isAI flag from the message
            const isAIMessage = message.isAI === true

            // Always use EnhancedMessageBubble for consistent rendering and features
            // Extract hashtags from message content
            const hashtagRegex = /#[\w-]+/g
            const hashtags = message.content.match(hashtagRegex) || []
            const subjects = hashtags.map(tag => tag.slice(1)) // Remove # prefix



            const enhancedMessage: EnhancedMessageData = {
              id: message.id,
              content: message.content,  // Fixed: property name now matches
              senderId: message.sender,
              senderName: message.senderName || contactNames[message.sender] || 'Unknown',
              timestamp: message.timestamp,
              isOwn: isCurrentUser,
              subjects: subjects,
              trustLevel: 3, // Default colleague level
              attachments: message.attachments,
              topicName: message.topicName, // Pass topic name to enhanced bubble
              format: message.format || 'markdown' // Use message format if available, otherwise markdown
            }

            const senderInitials = (enhancedMessage.senderName || 'U')
              .split(' ')
              .filter(n => n && n.length > 0)
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .substring(0, 2) || 'U'

            return (
              <div key={message.id} className="flex gap-2 mb-2" style={{ justifyContent: isCurrentUser ? 'flex-end' : 'flex-start' }}>
                {!isCurrentUser && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs bg-primary/20 text-primary">
                      {senderInitials}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1 max-w-[80%]">
                  <EnhancedMessageBubble
                    message={enhancedMessage}
                    onHashtagClick={handleHashtagClick}
                    onAttachmentClick={handleAttachmentClick}
                    onDownloadAttachment={handleDownloadAttachment}
                    theme="dark"
                    attachmentDescriptors={attachmentDescriptors}
                  />
                </div>
              </div>
            )
          })}

          {/* AI Processing Spinner - show when processing and NO streaming content */}
          {isAIProcessing && !aiStreamingContent && (
            <div className="flex gap-2 mb-2 justify-start">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs bg-primary/20 text-primary">AI</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <div className="message-bubble message-bubble-ai flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {/* AI Streaming Content - show the actual streaming response (throttled for performance) */}
          {throttledStreamingContent && (
            <div className="flex gap-2 mb-2 justify-start">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs bg-primary/20 text-primary">AI</AvatarFallback>
              </Avatar>
              <div className="flex-1 max-w-[80%]">
                <EnhancedMessageBubble
                  message={{
                    id: 'streaming',
                    content: throttledStreamingContent,
                    senderId: 'ai',
                    senderName: aiModelName!,
                    timestamp: Date.now(),
                    isOwn: false,
                    subjects: [],
                    trustLevel: 3,
                    format: 'markdown'
                  }}
                  onHashtagClick={handleHashtagClick}
                  onAttachmentClick={handleAttachmentClick}
                  onDownloadAttachment={handleDownloadAttachment}
                  theme="dark"
                  attachmentDescriptors={attachmentDescriptors}
                />
              </div>
            </div>
          )}

          {/* AI Error Message - show when AI processing fails */}
          {aiError && (
            <div className="flex gap-2 mb-2 justify-start">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs bg-destructive/20 text-destructive">!</AvatarFallback>
              </Avatar>
              <div className="flex-1 max-w-[80%]">
                <div className="message-bubble bg-destructive/10 border border-destructive/30 text-destructive-foreground">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-1">AI Error</div>
                      <div className="text-sm">{aiError}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to bottom button - appears when user scrolls up */}
      {isUserScrolledUp && (
        <div className="absolute bottom-20 right-6 z-10">
          <button
            onClick={scrollToBottom}
            className="bg-gray-800 hover:bg-gray-700 text-white rounded-full p-2 shadow-lg transition-all duration-200 border border-gray-600"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Proposal Carousel - Absolutely positioned above message input */}
      {proposals.length > 0 && (
        <div className="absolute bottom-16 left-0 right-0 px-4 pointer-events-none">
          <div className="pointer-events-auto">
            <ProposalCarousel
              proposals={proposals}
              currentIndex={currentIndex}
              onNext={nextProposal}
              onPrevious={previousProposal}
              onShare={async (proposalId, pastSubjectIdHash) => {
                const result = await shareProposal(proposalId, pastSubjectIdHash, false)
                if (result.success && result.sharedContent) {
                  // Insert shared content as a message
                  const contextMessage = `Related context from "${result.sharedContent.subjectName}": ${result.sharedContent.keywords.join(', ')}`
                  await onSendMessage(contextMessage)
                }
              }}
              onDismiss={dismissProposal}
            />
          </div>
        </div>
      )}

      {/* Message input */}
      <EnhancedMessageInput
        onSendMessage={handleEnhancedSend}
        onHashtagClick={handleHashtagClick}
        placeholder={placeholder}
        theme="dark"
        conversationId={topicId}
        disabled={loading || isAIProcessing}
        isStreaming={isAIProcessing && !!aiStreamingContent}
      />
    </div>
  )
}