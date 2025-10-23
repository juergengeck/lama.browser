import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Plus, Trash2, Bot, Loader2, MoreVertical, Edit, CheckCheck, UserPlus, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { ChatView } from './ChatView'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { useTopics } from '@/hooks/useTopics'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InputDialog } from './InputDialog'
import { UserSelectionDialog } from './UserSelectionDialog'
import { GroupChatDialog } from './GroupChatDialog'

interface Conversation {
  id: string
  name: string
  type?: 'direct' | 'group'
  participants: string[]  // Array of participant person IDs
  participantCount?: number
  lastMessage?: string
  lastMessageTime?: Date | string
  modelName?: string
  isGroup?: boolean
  hasAIParticipant?: boolean
  isAITopic?: boolean
}

interface ChatLayoutProps {
  selectedConversationId?: string
}

export function ChatLayout({ selectedConversationId }: ChatLayoutProps = {}) {
  // Use topics hook to manage conversations
  const { topics, isLoading: topicsLoading, createTopic, deleteTopic, renameTopic } = useTopics()

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

  // Convert topics to conversations format
  const conversations: Conversation[] = topics.map(topic => ({
    id: topic.id,
    name: topic.name,
    participants: topic.participants,
    participantCount: topic.participants.length,
    lastMessage: topic.lastMessage || '',
    lastMessageTime: new Date(topic.lastActivity),
    modelName: topic.aiModelId,
    hasAIParticipant: topic.isAITopic || false,
    isAITopic: topic.isAITopic || false
  }))

  // Handle responsive behavior on window resize
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth
      setWindowWidth(newWidth)

      // Auto-collapse sidebar on small screens
      if (newWidth < 768 && !isCollapsed) {
        setIsCollapsed(true)
      }

      // Adjust sidebar width based on window size
      if (!isCollapsed) {
        if (newWidth < 1024) {
          setSidebarWidth(Math.max(280, Math.min(300, newWidth * 0.25)))
        } else if (newWidth < 1440) {
          setSidebarWidth(300)
        } else {
          setSidebarWidth(Math.min(350, newWidth * 0.2))
        }
      }
    }

    handleResize() // Initial call
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isCollapsed])

  // Update selected conversation when prop changes
  useEffect(() => {
    console.log('[ChatLayout] 🔴 selectedConversationId prop changed to:', selectedConversationId)
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
      // TODO: Get current user ID from worker
      const currentUserId = 'current-user-id'

      // Create topic through worker
      const topic = await createTopic(chatName, [currentUserId])

      // Select the new conversation
      setSelectedConversation(topic.id)

      // Mark as processing
      setProcessingConversations(prev => {
        const next = new Set(prev)
        next.add(topic.id)
        return next
      })
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

  // Handle adding users to conversation
  const handleAddUsers = async (selectedUserIds: string[]) => {
    if (!conversationToAddUsers) return

    try {
      // TODO: Add worker message for adding participants
      console.log('[ChatLayout] Add users not yet implemented in browser:', conversationToAddUsers, selectedUserIds)
      throw new Error('Adding users to conversations not available in browser yet')
    } catch (error: any) {
      console.error('[ChatLayout] Error adding users:', error)
      const errorMessage = error?.message || 'Failed to add users to conversation'
      alert(`Error: ${errorMessage}`)
    } finally {
      setConversationToAddUsers(null)
    }
  }

  // Create new group conversation with selected users
  const handleCreateGroupConversation = async (selectedUserIds: string[], chatName?: string) => {
    try {
      const conversationName = chatName || `Group Chat ${conversations.length + 1}`

      // Create topic through worker
      const topic = await createTopic(conversationName, selectedUserIds)

      // Select the new conversation
      setSelectedConversation(topic.id)
    } catch (error: any) {
      console.error('[ChatLayout] Error creating group conversation:', error)
      const errorMessage = error?.message || 'Failed to create group conversation'
      alert(`Error: ${errorMessage}`)
    }
  }

  // Filter conversations by search
  console.log('[ChatLayout] Filtering conversations:', {
    conversationsLength: conversations.length,
    searchQuery,
    conversations: conversations.map(c => ({ id: c.id, name: c.name }))
  })
  const filteredConversations = conversations.filter(conv =>
    conv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  console.log('[ChatLayout] Filtered conversations:', filteredConversations.length)

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
  const handleProcessingChange = useCallback((isProcessing: boolean) => {
    setProcessingConversations(prev => {
      const next = new Set(prev)
      if (isProcessing && selectedConversation) {
        next.add(selectedConversation)
      } else if (!isProcessing && selectedConversation) {
        next.delete(selectedConversation)
      }
      return next
    })
  }, [selectedConversation])

  // Note: Message preview updates removed since conversations is derived from topics
  // Preview updates will come from worker via refreshTopics()

  return (
    <>
    <div className="flex h-full overflow-hidden">
      {/* Sidebar with conversation list */}
      <div
        className="border-r border-border bg-card flex flex-col flex-shrink-0 transition-all duration-300"
        style={{
          width: isCollapsed ? 48 : sidebarWidth,
          minWidth: isCollapsed ? '48px' : '280px',
          maxWidth: isCollapsed ? '48px' : `${Math.min(450, windowWidth * 0.35)}px`
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
          <ScrollArea className="flex-1">
            <div className={isCollapsed ? "py-2 space-y-1" : "p-2 space-y-1"}>
              {filteredConversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {isCollapsed ? (
                    <Bot className="h-6 w-6 mx-auto opacity-50" />
                  ) : (
                    <>
                      <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No matches found</p>
                      <p className="text-xs">Try a different search</p>
                    </>
                  )}
                </div>
              ) : (
                filteredConversations.map((conv) =>
                  isCollapsed ? (
                    // Collapsed: minimal avatar only
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`w-8 h-8 mx-auto rounded-full cursor-pointer transition-all flex items-center justify-center ${
                        selectedConversation === conv.id
                          ? 'bg-primary text-primary-foreground ring-1 ring-primary/50'
                          : 'bg-primary/10 hover:bg-primary/20'
                      }`}
                      title={conv.name}
                    >
                      {processingConversations.has(conv.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>
                  ) : (
                    // Expanded: full conversation card
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`group flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedConversation === conv.id
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-muted/50 border border-transparent'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        {processingConversations.has(conv.id) ? (
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        ) : (
                          <Bot className="w-4 h-4 text-primary" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h3 className="font-medium text-xs truncate">{conv.name}</h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              onClick={(e) => e.stopPropagation()}
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100"
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                openRenameDialog(conv.id)
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Rename
                            </DropdownMenuItem>
                            {/* Show Add User option for all chats */}
                            {/* For P2P chats, this will create a new group chat */}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                openAddUsersDialog(conv.id)
                              }}
                            >
                              <UserPlus className="mr-2 h-4 w-4" />
                              Add User
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteConversation(conv.id)
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {conv.lastMessage && (
                        <p className="text-[10px] text-muted-foreground mb-0.5 line-clamp-1">
                          {(() => {
                            const cleaned = stripMarkdown(conv.lastMessage)
                            return cleaned.length > 40
                              ? cleaned.substring(0, 40) + '...'
                              : cleaned
                          })()}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span>{formatTime(conv.lastMessageTime)}</span>
                          {conv.lastMessage && (
                            <CheckCheck className="h-3 w-3 text-primary/70" />
                          )}
                        </div>
                        {conv.modelName && (
                          <span className="text-primary text-[10px] font-medium">{conv.modelName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  )
                ))
              }
            </div>
          </ScrollArea>

          {/* Resize handle */}
          {!isCollapsed && (
            <div
              className="w-1 cursor-col-resize hover:bg-primary/20 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault()
                const startX = e.clientX
                const startWidth = sidebarWidth

                const handleMouseMove = (e: MouseEvent) => {
                  const diff = e.clientX - startX
                  const minWidth = 280
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
            />
          )}
        </>
      </div>

      {/* Main chat area */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {selectedConversation ? (
          <ChatView
            key={selectedConversation}
            conversationId={selectedConversation}
            isInitiallyProcessing={processingConversations.has(selectedConversation)}
            onProcessingChange={handleProcessingChange}
            hasAIParticipant={conversations.find(c => c.id === selectedConversation)?.hasAIParticipant}
            onAddUsers={() => openAddUsersDialog(selectedConversation)}
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
        ? (conversations.find(c => c.id === conversationToAddUsers)?.participants || [])
        : []
      }
    />

    {/* New Group Chat Dialog */}
    <GroupChatDialog
      open={showNewGroupDialog}
      onOpenChange={setShowNewGroupDialog}
      onSubmit={handleCreateGroupConversation}
    />
  </>
  )
}