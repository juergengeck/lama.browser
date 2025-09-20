import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Plus, Trash2, Bot, Loader2, MoreVertical, Edit, Check, CheckCheck, UserPlus, Users } from 'lucide-react'
import { ChatView } from './ChatView'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { lamaBridge } from '@/bridge/lama-bridge'
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
  participants?: string[]
  lastMessage?: string
  lastMessageTime?: Date | string
  modelName?: string
  isGroup?: boolean
}

interface ChatLayoutProps {
  selectedConversationId?: string
}

export function ChatLayout({ selectedConversationId }: ChatLayoutProps = {}) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(selectedConversationId || null)
  const [searchQuery, setSearchQuery] = useState('')
  const [processingConversations, setProcessingConversations] = useState<Set<string>>(new Set())
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [conversationToRename, setConversationToRename] = useState<string | null>(null)
  const [showAddUsersDialog, setShowAddUsersDialog] = useState(false)
  const [conversationToAddUsers, setConversationToAddUsers] = useState<string | null>(null)

  // Update selected conversation when prop changes
  useEffect(() => {
    console.log('[ChatLayout] 🔴 selectedConversationId prop changed to:', selectedConversationId)
    if (selectedConversationId) {
      setSelectedConversation(selectedConversationId)
    }
  }, [selectedConversationId])

  // Load conversations from Node.js
  useEffect(() => {
    const loadConversations = async () => {
      try {
        if (!window.electronAPI) {
          throw new Error('Electron API not available')
        }

        const result = await window.electronAPI.invoke('chat:getConversations')
        if (!result.success) {
          throw new Error(result.error || 'Failed to get conversations')
        }

        const conversations = result.data || []
        console.log('[ChatLayout] 🔴 Loaded conversations from backend:', conversations.map((c: any) => ({ id: c.id, name: c.name })))

        // Convert to UI format
        const uiConversations: Conversation[] = conversations.map((conv: any) => ({
          id: conv.id,
          name: conv.name || 'Unnamed Chat',
          lastMessage: conv.lastMessage?.text || '',
          lastMessageTime: new Date(conv.lastMessageTime || conv.createdAt || Date.now()),
          modelName: conv.modelName || 'GPT-OSS'
        }))

        setConversations(uiConversations)
        console.log('[ChatLayout] 🔴 UI conversations set:', uiConversations.map(c => ({ id: c.id, name: c.name })))
        
        if (selectedConversationId) {
          setSelectedConversation(selectedConversationId)
        } else if (uiConversations.length > 0 && !selectedConversation) {
          setSelectedConversation(uiConversations[0].id)
        }
      } catch (error) {
        console.error('Failed to load conversations:', error)
        setConversations([])
      }
    }
    
    loadConversations()
  }, [])

  // Listen for new messages globally to update conversation list
  useEffect(() => {
    if (!window.electronAPI) return

    const handleNewMessages = (data: { conversationId: string; messages: any[] }) => {
      console.log('[ChatLayout] 📬 New messages received for conversation:', data.conversationId)

      // Update the conversation list to reflect the new message
      if (data.messages && data.messages.length > 0) {
        const lastMessage = data.messages[data.messages.length - 1]

        setConversations(prev => prev.map(conv =>
          conv.id === data.conversationId
            ? {
                ...conv,
                lastMessage: lastMessage.content || lastMessage.text || '',
                lastMessageTime: new Date()
              }
            : conv
        ))
      }
    }

    const handleP2PConverted = async (data: { oldConversationId: string; newConversationId: string; participantIds: string[] }) => {
      console.log('[ChatLayout] P2P converted to group:', data)

      // Reload conversations to get the new group
      await reloadConversations()

      // Select the new group conversation
      setSelectedConversation(data.newConversationId)
    }

    // Subscribe to events
    const unsubscribe = lamaBridge.on('chat:newMessages', handleNewMessages)
    const unsubP2P = window.electronAPI?.on?.('chat:p2pConvertedToGroup', handleP2PConverted)

    return () => {
      if (unsubscribe) unsubscribe()
      if (unsubP2P) unsubP2P()
    }
  }, [])

  // Reload conversations from Node.js
  const reloadConversations = async () => {
    try {
      if (!window.electronAPI) return
      
      const result = await window.electronAPI.invoke('chat:getConversations')
      if (!result.success) return
      
      const conversations = result.data || []
      const uiConversations: Conversation[] = conversations.map((conv: any) => ({
        id: conv.id,
        name: conv.name || 'Unnamed Chat',
        lastMessage: conv.lastMessage?.text || '',
        lastMessageTime: new Date(conv.lastMessageTime || conv.createdAt || Date.now()),
        modelName: conv.modelName || 'GPT-OSS'
      }))
      
      setConversations(uiConversations)
    } catch (error) {
      console.error('Failed to reload conversations:', error)
    }
  }

  // Create new conversation with the provided name
  const handleCreateConversation = async (chatName: string) => {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available')
      }
      
      // Create conversation through IPC handler
      const result = await window.electronAPI.invoke('chat:createConversation', {
        type: 'direct',
        participants: [],
        name: chatName
      })
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create conversation')
      }
      
      // Reload conversations from Node.js to get fresh data
      await reloadConversations()
      setSelectedConversation(result.data.id)
      
      // Mark as processing since welcome message will be generated
      setProcessingConversations(prev => {
        const next = new Set(prev)
        next.add(result.data.id)
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
      // For now, just remove from UI - add IPC handler later if needed
      const updated = conversations.filter(c => c.id !== id)
      setConversations(updated)
      if (selectedConversation === id) {
        setSelectedConversation(updated.length > 0 ? updated[0].id : null)
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  // Handle rename conversation
  const handleRenameConversation = (newName: string) => {
    if (!conversationToRename) return
    
    // Update locally for now - add IPC handler later if needed
    const updated = conversations.map(c => 
      c.id === conversationToRename ? { ...c, name: newName } : c
    )
    setConversations(updated)
    setConversationToRename(null)
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
      if (!window.electronAPI) {
        throw new Error('Electron API not available')
      }

      console.log('[ChatLayout] Adding users to conversation:', conversationToAddUsers, selectedUserIds)

      const result = await window.electronAPI.invoke('chat:addParticipants', {
        conversationId: conversationToAddUsers,
        participantIds: selectedUserIds
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to add users')
      }

      console.log('[ChatLayout] Successfully added users to conversation')

      // Check if a new group was created (P2P converted to group)
      if (result.newConversationId) {
        console.log('[ChatLayout] P2P converted to group, new ID:', result.newConversationId)

        // Reload conversations and select the new group
        await reloadConversations()
        setSelectedConversation(result.newConversationId)

        // Show success message
        alert(`Created new group chat with ${selectedUserIds.length + 2} participants`)
      } else {
        // Regular add to existing group
        await reloadConversations()
      }

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
      if (!window.electronAPI) {
        throw new Error('Electron API not available')
      }

      // Create group conversation through IPC handler
      const result = await window.electronAPI.invoke('chat:createConversation', {
        type: 'group',
        participants: selectedUserIds,
        name: chatName || `Group Chat ${conversations.length + 1}`
      })

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create group conversation')
      }

      // Reload conversations from Node.js to get fresh data
      await reloadConversations()
      setSelectedConversation(result.data.id)

      // Mark as processing since welcome message may be generated
      setProcessingConversations(prev => {
        const next = new Set(prev)
        next.add(result.data.id)
        return next
      })
    } catch (error: any) {
      console.error('[ChatLayout] Error creating group conversation:', error)
      const errorMessage = error?.message || 'Failed to create group conversation'
      alert(`Error: ${errorMessage}`)
    }
  }

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv =>
    conv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
    return time.toLocaleDateString()
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

  const handleMessageUpdate = useCallback((lastMessage: string) => {
    // Update the conversation's last message for preview
    setConversations(prev => prev.map(conv =>
      conv.id === selectedConversation
        ? { ...conv, lastMessage, lastMessageTime: new Date() }
        : conv
    ))
  }, [selectedConversation])

  return (
    <>
    <div className="flex h-full">
      {/* Sidebar with conversation list */}
      <div className="w-80 border-r border-border bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Conversations</h2>
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
          </div>
          
          {/* Search */}
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No matches found</p>
                <p className="text-xs">Try a different search</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => {
                    console.log('[ChatLayout] 🔴 Conversation clicked, selecting:', conv.id)
                    setSelectedConversation(conv.id)
                  }}
                  className={`group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedConversation === conv.id
                      ? 'bg-primary/10 border-2 border-primary/20'
                      : 'hover:bg-muted border-2 border-transparent'
                  }`}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {processingConversations.has(conv.id) ? (
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    ) : (
                      <Bot className="w-5 h-5 text-primary" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-sm truncate">{conv.name}</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            onClick={(e) => e.stopPropagation()}
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
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
                          {(
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                openAddUsersDialog(conv.id)
                              }}
                            >
                              <UserPlus className="mr-2 h-4 w-4" />
                              Add User
                            </DropdownMenuItem>
                          )}
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
                      <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                        {conv.lastMessage.length > 50 
                          ? conv.lastMessage.substring(0, 50) + '...'
                          : conv.lastMessage
                        }
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatTime(conv.lastMessageTime)}</span>
                      <div className="flex items-center gap-1">
                        {conv.lastMessage && (
                          <CheckCheck className="h-3 w-3 text-primary/70" />
                        )}
                        <span className="text-primary">{conv.modelName}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className="flex-1">
        {selectedConversation ? (
          <ChatView
            conversationId={selectedConversation}
            isInitiallyProcessing={processingConversations.has(selectedConversation)}
            onProcessingChange={handleProcessingChange}
            onMessageUpdate={handleMessageUpdate}
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
      excludeUserIds={[]} // TODO: Get current participants to exclude them
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