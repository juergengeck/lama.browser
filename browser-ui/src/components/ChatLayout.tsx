import { useState, useEffect, useCallback, useMemo } from 'react'
import { MessageSquare, Plus, Users, ChevronLeft, ChevronRight, Menu, ChevronDown } from 'lucide-react'
import { ChatView } from './ChatView'
import { Button } from '@lama/ui'
import { Input } from '@lama/ui'
import { useTopics } from '@/hooks/useTopics'
import { usePastIdentities } from '@/hooks/usePastIdentities'
import { useModel } from '@/model/index.js'
import { usePlans } from '@lama/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ConversationList,
  type Conversation
} from '@lama/ui'
import { AIConversationCard } from './AIConversationCard'
import { InputDialog } from './InputDialog'
import { UserSelectionDialog } from './UserSelectionDialog'
import { GroupChatDialog } from './GroupChatDialog'
import { ModelSelectionDialog, type LLMModel } from '@lama/ui'

interface ChatLayoutProps {
  selectedConversationId?: string
}

export function ChatLayout({ selectedConversationId }: ChatLayoutProps = {}) {
  // Get model instance for owner ID and platform-specific features
  const model = useModel()

  // Get Plans for platform-agnostic operations
  const { contacts: contactsPlan, chat: chatPlan } = usePlans()

  // Use topics hook to manage conversations
  const { topics, isLoading: topicsLoading, createTopic, deleteTopic, renameTopic, refreshTopics, updateTopicLastMessage } = useTopics()

  const [selectedConversation, setSelectedConversation] = useState<string | null>(selectedConversationId || null)
  const [searchQuery, setSearchQuery] = useState('')
  const [processingConversations, setProcessingConversations] = useState<Set<string>>(new Set())
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [conversationToRename, setConversationToRename] = useState<string | null>(null)
  const [showAddUsersDialog, setShowAddUsersDialog] = useState(false)
  const [conversationToAddUsers, setConversationToAddUsers] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(300)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [contactsMap, setContactsMap] = useState<Map<string, { name: string; isLLM: boolean; color?: string }>>(new Map())
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchStartWidth, setTouchStartWidth] = useState<number | null>(null)
  const [llmSectionExpanded, setLlmSectionExpanded] = useState(false)
  const [showModelSelectionDialog, setShowModelSelectionDialog] = useState(false)
  const [conversationToConfigureLLM, setConversationToConfigureLLM] = useState<string | null>(null)

  // Load contacts when model is initialized
  useEffect(() => {
    if (!model.initialized) return

    async function loadContacts() {
      try {
        // Using platform-agnostic ContactsPlan via usePlans()
        const response = await contactsPlan.getContacts()
        if (response.success && response.contacts) {
          const map = new Map()
          for (const contact of response.contacts) {
            map.set(contact.personId, {
              name: contact.name,
              isLLM: contact.isAI,
              color: undefined // TODO: Get from avatar preferences
            })
          }
          setContactsMap(map)
        }
      } catch (error) {
        console.error('[ChatLayout] Failed to load contacts:', error)
      }
    }

    loadContacts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.initialized]) // contactsPlan is stable, no need to re-run

  // Convert topics to conversations format
  // Use useMemo to ensure conversations are only computed when both topics and contactsMap are ready
  // This prevents race condition where conversations are computed before contacts finish loading
  const conversations: Conversation[] = useMemo(() => {
    return topics.map(topic => {
      // Check if topic is still generating welcome message
      const isGeneratingWelcome = model.initialized &&
        model.aiAssistantModel?.topicManager?.isTopicLoading?.(topic.id) || false;

      // Enrich participants with contact information
      const enrichedParticipants = (topic.participants || []).map(participant => {
        // Participant might be a string (hash) or an object with properties
        // Ensure we extract the ID as a string
        const participantId = typeof participant === 'string'
          ? participant
          : (participant?.id || participant?.personId || String(participant))

        const contactInfo = contactsMap.get(participantId)
        return {
          id: participantId,
          name: contactInfo?.name || `Contact ${participantId.substring(0, 8)}`,
          isLLM: contactInfo?.isLLM || false,
          color: contactInfo?.color
        }
      })

      const hasAI = topic.isAITopic || false;

      // DEBUG: Log AI topic detection
      if (topic.id === 'hi') {
        console.log('[ChatLayout] 🔍 Topic "hi" - isAITopic:', topic.isAITopic, 'hasAI:', hasAI);
      }

      return {
        id: topic.id,
        name: topic.name,
        participants: enrichedParticipants,
        participantCount: enrichedParticipants.length,
        lastMessage: isGeneratingWelcome ? 'Generating welcome message...' : (topic.lastMessage || ''),
        lastMessageTime: new Date(topic.lastActivity),
        modelName: topic.modelName || topic.aiModelId,
        hasAIParticipant: hasAI,
        isAITopic: hasAI
      };
    })
  }, [topics, contactsMap, model.initialized, model.aiAssistantModel?.topicManager])

  // Sync processingConversations with topic loading states
  useEffect(() => {
    if (!model.initialized || !model.aiAssistantModel?.topicManager) {
      return;
    }

    // Check all AI topics for loading state
    const loadingTopics = topics
      .filter(topic => topic.isAITopic)
      .filter(topic => model.aiAssistantModel.topicManager.isTopicLoading(topic.id))
      .map(topic => topic.id);

    // Update processing set if there are changes
    if (loadingTopics.length > 0) {
      setProcessingConversations(prev => {
        const next = new Set(prev);
        let changed = false;

        // Add loading topics
        for (const topicId of loadingTopics) {
          if (!next.has(topicId)) {
            next.add(topicId);
            changed = true;
          }
        }

        // Remove topics that are no longer loading
        for (const topicId of prev) {
          if (!loadingTopics.includes(topicId) && topics.find(t => t.id === topicId)?.isAITopic) {
            next.delete(topicId);
            changed = true;
          }
        }

        return changed ? next : prev;
      });
    }
  }, [model.initialized, model.aiAssistantModel, topics]);

  // Handle responsive behavior on window resize
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth
      setWindowWidth(newWidth)

      // Auto-collapse sidebar on mobile screens
      if (newWidth < 768) {
        setIsCollapsed(true)
      }

      // Adjust sidebar width based on window size
      // Use callback form to avoid dependency on isCollapsed
      setSidebarWidth(prevWidth => {
        // Only adjust if not collapsed (check via ref or use prevWidth as proxy)
        if (newWidth < 1024) {
          return Math.max(250, Math.min(300, newWidth * 0.3))
        } else if (newWidth < 1440) {
          return 300
        } else {
          return Math.min(350, newWidth * 0.2)
        }
      })
    }

    handleResize() // Initial call
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Update selected conversation when prop changes
  useEffect(() => {
    if (selectedConversationId) {
      setSelectedConversation(selectedConversationId)
    }
  }, [selectedConversationId])

  // Select first conversation when topics load - but ONLY after topics are fully loaded
  useEffect(() => {
    if (topicsLoading) return // Don't auto-select while topics are still being created

    if (selectedConversationId) {
      setSelectedConversation(selectedConversationId)
    } else if (conversations.length > 0 && !selectedConversation) {
      setSelectedConversation(conversations[0].id)
    }
  }, [conversations, selectedConversationId, selectedConversation, topicsLoading])

  // TODO: Add worker-based event listeners for new messages, P2P conversion, etc.
  // For now, we'll rely on manual refresh via refreshTopics

  // Create new conversation with the provided name
  const handleCreateConversation = async (chatName: string) => {
    try {
      // Get current user ID from model
      if (!model.ownerId) {
        throw new Error('User not authenticated')
      }
      const currentUserId = String(model.ownerId)

      // Create topic through worker
      const topic = await createTopic(chatName, [currentUserId])

      // Select the new conversation
      setSelectedConversation(topic.id)

      // Note: Processing state is managed by ChatView based on actual AI activity
      // No need to manually set processing here
    } catch (error: any) {
      console.error('[ChatLayout] Error creating conversation:', error)
      const errorMessage = error?.message || 'Failed to create conversation'
      alert(`Error: ${errorMessage}`)
    }
  }

  // Delete conversation
  const deleteConversation = async (id: string) => {
    try {
      await deleteTopic(id)
      if (selectedConversation === id) {
        setSelectedConversation(topics.length > 0 ? topics[0].id : null)
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  // Handle rename conversation
  const handleRenameConversation = async (newName: string) => {
    if (!conversationToRename) return

    try {
      await renameTopic(conversationToRename, newName)
      setConversationToRename(null)
      setShowRenameDialog(false)
    } catch (error) {
      console.error('Failed to rename conversation:', error)
    }
  }
  
  // Open rename dialog
  const openRenameDialog = (id: string) => {
    setConversationToRename(id)
    setShowRenameDialog(true)
  }

  // Open add users dialog
  const openAddUsersDialog = (id: string) => {
    setConversationToAddUsers(id)
    setShowAddUsersDialog(true)
  }

  // Open model selection dialog
  const openModelSelectionDialog = (id: string) => {
    setConversationToConfigureLLM(id)
    setShowModelSelectionDialog(true)
  }

  // Handle AI mode change
  const handleSetAIMode = async (id: string, mode: 'off' | 'listen' | 'speak') => {
    console.log(`[ChatLayout] Setting AI mode for ${id} to ${mode}`)
    // TODO: Implement AI mode setting via AIAssistantModel
    // For now, just log
    alert(`AI mode for conversation "${id}" set to: ${mode}`)
  }

  // Get available LLM models
  const getAvailableModels = async (): Promise<LLMModel[]> => {
    if (!model.initialized || !model.llmManager) {
      return []
    }

    try {
      const models = await model.llmManager.getAvailableModels()
      return models.map((m: any) => ({
        id: m.id,
        name: m.name,
        displayName: m.displayName || m.name,
        provider: m.provider || 'unknown',
        description: m.description
      }))
    } catch (error) {
      console.error('[ChatLayout] Failed to get available models:', error)
      return []
    }
  }

  // Switch topic model
  const handleSwitchTopicModel = async (topicId: string, modelId: string) => {
    try {
      await model.switchTopicModel(topicId, modelId)
      // Refresh topics to update the UI
      await refreshTopics()
    } catch (error: any) {
      console.error('[ChatLayout] Failed to switch topic model:', error)
      throw error
    }
  }

  // Handle adding users to conversation
  const handleAddUsers = async (selectedUserIds: string[]) => {
    if (!conversationToAddUsers) return

    try {
      console.log('[ChatLayout] Adding users to conversation:', conversationToAddUsers, selectedUserIds)

      const response = await chatPlan.addParticipants({
        conversationId: conversationToAddUsers,
        participantIds: selectedUserIds
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to add participants')
      }

      // Close dialog
      setShowAddUsersDialog(false)
      setConversationToAddUsers(null)

      // Handle continuity: Switch to new conversation if one was created
      if (response.data?.newConversationId) {
        console.log('[ChatLayout] New conversation created:', response.data.newConversationId)
        console.log('[ChatLayout] Original conversation:', conversationToAddUsers)

        // Refresh topics to show the new conversation
        await refreshTopics()

        // Switch to the new conversation
        setSelectedConversation(response.data.newConversationId)

        console.log('[ChatLayout] Switched to new conversation with updated participants')
      } else {
        // Fallback: Just refresh (shouldn't happen with current implementation)
        await refreshTopics()
        console.log('[ChatLayout] Successfully added users to conversation')
      }
    } catch (error: any) {
      console.error('[ChatLayout] Error adding users:', error)
      const errorMessage = error?.message || 'Failed to add users to conversation'
      alert(`Error: ${errorMessage}`)
    }
  }

  // Create new group conversation with selected users
  const handleCreateGroupConversation = async (selectedUserIds: string[], chatName?: string, aiModelId?: string) => {
    try {
      const conversationName = chatName || `Group Chat ${conversations.length + 1}`

      console.log('[ChatLayout] Creating group conversation:', { conversationName, selectedUserIds, aiModelId })

      // Create topic through worker
      const topic = await createTopic(conversationName, selectedUserIds, aiModelId)

      // Select the new conversation
      setSelectedConversation(topic.id)
    } catch (error: any) {
      console.error('[ChatLayout] Error creating group conversation:', error)
      const errorMessage = error?.message || 'Failed to create group conversation'
      alert(`Error: ${errorMessage}`)
    }
  }

  // Separate AI chats (with agency) from LLM chats (pure model conversations)
  const aiChats = conversations.filter(conv => conv.isAITopic)
  const llmChats = conversations.filter(conv => !conv.isAITopic && conv.hasAIParticipant)

  // Fetch past identities for all AI chats
  const aiChatIds = aiChats.map(chat => chat.id)
  const { pastIdentitiesMap, refreshPastIdentities } = usePastIdentities(aiChatIds)

  // Filter conversations by search
  const filteredAIChats = aiChats.filter(conv =>
    conv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredLLMChats = llmChats.filter(conv =>
    conv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Strip markdown formatting from text for preview
  const stripMarkdown = (text: string): string => {
    return text
      // Remove headers (### text)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold (**text** or __text__)
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      // Remove italic (*text* or _text_)
      .replace(/(\*|_)(.*?)\1/g, '$2')
      // Remove inline code (`code`)
      .replace(/`([^`]+)`/g, '$1')
      // Remove links [text](url)
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Remove list markers (- or * or 1.)
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Trim whitespace
      .trim()
  }

  // Format time for display
  const formatTime = (time?: Date | string): string => {
    if (!time) return ''
    const date = typeof time === 'string' ? new Date(time) : time
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (hours < 1) return 'now'
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  // Memoize callbacks to prevent re-renders
  const handleProcessingChange = useCallback((conversationId: string, isProcessing: boolean) => {
    setProcessingConversations(prev => {
      const next = new Set(prev)
      if (isProcessing) {
        next.add(conversationId)
      } else {
        next.delete(conversationId)
      }
      return next
    })
  }, [])

  // Note: Message preview updates removed since conversations is derived from topics
  // Preview updates will come from worker via refreshTopics()

  // Touch handlers for swipe to open/close sidebar on mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (windowWidth >= 768) return // Only on mobile

    const touch = e.touches[0]
    const isLeftEdge = touch.clientX < 20 && isCollapsed
    const isSidebar = !isCollapsed

    if (isLeftEdge || isSidebar) {
      setTouchStartX(touch.clientX)
    }
  }, [isCollapsed, windowWidth])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX === null || windowWidth >= 768) return

    const touch = e.touches[0]
    const deltaX = touch.clientX - touchStartX

    // Swipe right to open (when collapsed)
    if (isCollapsed && deltaX > 50) {
      setIsCollapsed(false)
      setTouchStartX(null)
    }
    // Swipe left to close (when open)
    else if (!isCollapsed && deltaX < -50) {
      setIsCollapsed(true)
      setTouchStartX(null)
    }
  }, [touchStartX, isCollapsed, windowWidth])

  const handleTouchEnd = useCallback(() => {
    setTouchStartX(null)
  }, [])

  return (
    <>
    <div
      className="flex h-full relative"
      style={{ overflow: 'hidden' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Sidebar overlay backdrop on mobile when open */}
      {!isCollapsed && windowWidth < 768 && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Sidebar with conversation list */}
      <div
        className={`border-r border-border bg-card flex flex-col flex-shrink-0 transition-all duration-300 ${
          windowWidth < 768 ? 'fixed left-0 top-0 bottom-0 z-50' : 'relative'
        }`}
        style={{
          width: isCollapsed ? (windowWidth < 768 ? 0 : 48) : sidebarWidth,
          minWidth: isCollapsed ? (windowWidth < 768 ? '0' : '48px') : '250px',
          maxWidth: isCollapsed ? (windowWidth < 768 ? '0' : '48px') : `${Math.min(450, windowWidth * 0.85)}px`,
          transform: windowWidth < 768 && isCollapsed ? 'translateX(-100%)' : 'translateX(0)'
        }}
      >
        {/* Header */}
        <div className={`${isCollapsed ? 'p-1' : 'p-3'} border-b border-border`}>
          <div className={`flex items-center justify-between ${isCollapsed ? '' : 'mb-2'}`}>
            {!isCollapsed && <h2 className="text-sm font-semibold">Conversations</h2>}
            <div className={`flex items-center gap-1 ${isCollapsed ? 'mx-auto' : ''}`}>
              {!isCollapsed && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowNewChatDialog(true)}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  New Chat
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowNewGroupDialog(true)}>
                  <Users className="mr-2 h-4 w-4" />
                  New Group Chat
                </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                onClick={() => setIsCollapsed(!isCollapsed)}
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Search */}
          {!isCollapsed && (
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 text-xs"
            />
          )}
        </div>

        <>
          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {/* AI Chats (main list) - with expandable past identities */}
            <div className={isCollapsed ? "py-2 space-y-1" : "p-2 space-y-1"}>
              {filteredAIChats.length === 0 && filteredLLMChats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs">Start a new chat</p>
                </div>
              ) : (
                filteredAIChats.map((conv) => (
                  <AIConversationCard
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedConversation === conv.id}
                    isProcessing={processingConversations.has(conv.id)}
                    isCollapsed={isCollapsed}
                    pastIdentities={pastIdentitiesMap.get(conv.id) || []}
                    onSelect={setSelectedConversation}
                    onRename={openRenameDialog}
                    onAddUsers={openAddUsersDialog}
                    onConfigureLLM={openModelSelectionDialog}
                    onSetAIMode={handleSetAIMode}
                    onDelete={deleteConversation}
                    formatTime={formatTime}
                    stripMarkdown={stripMarkdown}
                  />
                ))
              )}
            </div>

            {/* LLM Section (expandable, collapsed by default) */}
            {filteredLLMChats.length > 0 && !isCollapsed && (
              <div className="border-t border-border">
                <button
                  onClick={() => setLlmSectionExpanded(!llmSectionExpanded)}
                  className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-muted-foreground hover:bg-accent/50 transition-colors"
                >
                  <span>LLM</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${llmSectionExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
                {llmSectionExpanded && (
                  <ConversationList
                    conversations={filteredLLMChats}
                    selectedConversationId={selectedConversation}
                    processingConversations={processingConversations}
                    isCollapsed={isCollapsed}
                    onSelectConversation={setSelectedConversation}
                    onRenameConversation={openRenameDialog}
                    onAddUsers={openAddUsersDialog}
                    onConfigureLLM={openModelSelectionDialog}
                    onSetAIMode={handleSetAIMode}
                    onDeleteConversation={deleteConversation}
                    formatTime={formatTime}
                    stripMarkdown={stripMarkdown}
                  />
                )}
              </div>
            )}
          </div>

          {/* Resize handle - Desktop only */}
          {!isCollapsed && windowWidth >= 768 && (
            <div
              className="w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors touch-none"
              onMouseDown={(e) => {
                e.preventDefault()
                const startX = e.clientX
                const startWidth = sidebarWidth

                const handleMouseMove = (e: MouseEvent) => {
                  const diff = e.clientX - startX
                  const minWidth = 250
                  const maxWidth = Math.min(450, windowWidth * 0.35)
                  const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + diff))
                  setSidebarWidth(newWidth)
                }

                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove)
                  document.removeEventListener('mouseup', handleMouseUp)
                }

                document.addEventListener('mousemove', handleMouseMove)
                document.addEventListener('mouseup', handleMouseUp)
              }}
              onTouchStart={(e) => {
                const touch = e.touches[0]
                setTouchStartX(touch.clientX)
                setTouchStartWidth(sidebarWidth)
              }}
              onTouchMove={(e) => {
                if (touchStartX === null || touchStartWidth === null) return
                const touch = e.touches[0]
                const diff = touch.clientX - touchStartX
                const minWidth = 250
                const maxWidth = Math.min(450, windowWidth * 0.35)
                const newWidth = Math.max(minWidth, Math.min(maxWidth, touchStartWidth + diff))
                setSidebarWidth(newWidth)
              }}
              onTouchEnd={() => {
                setTouchStartX(null)
                setTouchStartWidth(null)
              }}
            />
          )}
        </>
      </div>

      {/* Main chat area */}
      <div className="flex-1 min-w-0 relative" style={{ overflow: 'hidden' }}>
        {/* Hamburger menu button - Mobile only, when sidebar is collapsed */}
        {windowWidth < 768 && isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(false)}
            className="absolute top-2 left-2 z-30 md:hidden h-10 w-10 bg-card/80 backdrop-blur-sm"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {selectedConversation ? (
          <ChatView
            key={selectedConversation}
            conversationId={selectedConversation}
            isInitiallyProcessing={processingConversations.has(selectedConversation)}
            onProcessingChange={handleProcessingChange}
            hasAIParticipant={conversations.find(c => c.id === selectedConversation)?.hasAIParticipant}
            onAddUsers={() => openAddUsersDialog(selectedConversation)}
            onMessageUpdate={(lastMessage) => {
              // Optimistically update the preview text immediately
              updateTopicLastMessage(selectedConversation, lastMessage)
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Welcome to LAMA</p>
              <p className="text-sm">Select a conversation or create a new one to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* New Chat Dialog */}
    <InputDialog
      open={showNewChatDialog}
      onOpenChange={setShowNewChatDialog}
      title="New Chat"
      description="Enter a name for your new chat conversation"
      label="Chat Name"
      placeholder="e.g., Project Discussion"
      defaultValue={`Chat ${conversations.length + 1}`}
      onSubmit={handleCreateConversation}
    />

    {/* Rename Chat Dialog */}
    <InputDialog
      open={showRenameDialog}
      onOpenChange={setShowRenameDialog}
      title="Rename Chat"
      description="Enter a new name for this chat"
      label="Chat Name"
      defaultValue={conversations.find(c => c.id === conversationToRename)?.name || ''}
      onSubmit={handleRenameConversation}
    />

    {/* Add Users Dialog */}
    <UserSelectionDialog
      open={showAddUsersDialog}
      onOpenChange={setShowAddUsersDialog}
      title="Add Users to Chat"
      description="Select users to add to this conversation"
      onSubmit={handleAddUsers}
      excludeUserIds={conversationToAddUsers
        ? (conversations.find(c => c.id === conversationToAddUsers)?.participants.map(p => p.id) || [])
        : []
      }
    />

    {/* New Group Chat Dialog */}
    <GroupChatDialog
      open={showNewGroupDialog}
      onOpenChange={setShowNewGroupDialog}
      onSubmit={handleCreateGroupConversation}
    />

    {/* Model Selection Dialog */}
    <ModelSelectionDialog
      open={showModelSelectionDialog}
      onOpenChange={setShowModelSelectionDialog}
      topicId={conversationToConfigureLLM}
      currentModelId={
        conversationToConfigureLLM
          ? conversations.find(c => c.id === conversationToConfigureLLM)?.modelName
          : undefined
      }
      getAvailableModels={getAvailableModels}
      switchTopicModel={handleSwitchTopicModel}
    />
  </>
  )
}