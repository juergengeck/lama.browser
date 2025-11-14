/**
 * GroupChatDialog - Platform-Agnostic Component
 *
 * Uses usePlans() for platform-agnostic access to contacts and chat plans.
 * - Loading contacts through contacts plan
 * - Group chat creation through chat plan
 */

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@lama/ui'
import { Button } from '@lama/ui'
import { Input } from '@lama/ui'
import { Label } from '@lama/ui'
import { Checkbox } from '@lama/ui'
import { ScrollArea } from '@lama/ui'
import { User, Search, Loader2, Users, Bot } from 'lucide-react'
import { useModel } from '@/model/ModelContext'
import { usePlans } from '@lama/ui'

interface Contact {
  id: string
  name: string
  personId?: string
  isConnected?: boolean
  canMessage?: boolean
  isAI?: boolean
  modelId?: string
}

interface GroupChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (selectedUserIds: string[], chatName: string, aiModelId?: string) => void
}

export function GroupChatDialog({
  open,
  onOpenChange,
  onSubmit
}: GroupChatDialogProps) {
  // Keep Model for platform-specific features (initialized, ownerId)
  const model = useModel()

  // Use Plans for platform-agnostic operations
  const { contacts: contactsPlan } = usePlans()

  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [chatName, setChatName] = useState('')

  // Load contacts when dialog opens
  useEffect(() => {
    if (open) {
      loadContacts()
      setSelectedUserIds([])
      setSearchQuery('')
      setChatName('')
    }
  }, [open])

  // Listen for contacts:updated event to refresh contact list
  useEffect(() => {
    const handleContactsUpdated = () => {
      console.log('[GroupChatDialog] Contacts updated event received, reloading...')
      if (open) {
        loadContacts()
      }
    }

    // Listen to browser event (dispatched by ContactsView or other components)
    window.addEventListener('contacts:updated', handleContactsUpdated)

    return () => {
      window.removeEventListener('contacts:updated', handleContactsUpdated)
    }
  }, [open, model])

  const loadContacts = async () => {
    if (!model.initialized) {
      console.log('[GroupChatDialog] Skipping - model not initialized')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Platform-agnostic contact loading
      const result = await contactsPlan.getContacts()

      if (!result.success) {
        throw new Error(result.error || 'Failed to load contacts')
      }

      // Filter out owner and transform contacts to UI format
      const contactList = (result.contacts || [])
        .filter((contact: any) => contact.id !== model.ownerId) // Exclude owner
        .map((contact: any) => ({
          id: contact.id,
          name: contact.name || `Contact ${contact.id.substring(0, 8)}...`,
          personId: contact.personId,
          isConnected: contact.isConnected || false,
          canMessage: contact.canMessage !== false,
          isAI: contact.isAI || false,
          modelId: contact.modelId
        }))

      setContacts(contactList)
      console.log('[GroupChatDialog] Loaded contacts:', contactList.length)
    } catch (error) {
      console.error('[GroupChatDialog] Failed to load contacts:', error)
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  // Filter contacts based on search query
  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleUserToggle = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSubmit = () => {
    if (selectedUserIds.length === 0) {
      return
    }

    const finalName = chatName.trim() || 'Group Chat'
    console.log('[GroupChatDialog] 🔵 Submitting group chat:', { chatName, trimmed: chatName.trim(), finalName, selectedUserIds })

    // Use personId if available, otherwise use contact id
    const participantIds = selectedUserIds.map(userId => {
      const contact = contacts.find(c => c.id === userId)
      return contact?.personId || userId
    })

    // Check if any selected participants are AI contacts
    const aiParticipants = selectedUserIds
      .map(userId => contacts.find(c => c.id === userId))
      .filter(contact => contact?.isAI)

    // If there's exactly one AI participant, pass its modelId
    const aiModelId = aiParticipants.length === 1 ? aiParticipants[0]?.modelId : undefined

    console.log('[GroupChatDialog] 🔵 Calling onSubmit with:', { participantIds, finalName, aiModelId })
    onSubmit(participantIds, finalName, aiModelId)
    onOpenChange(false)
  }

  // Handle Enter key to submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && selectedUserIds.length > 0) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Group Chat</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Chat name input */}
          <div className="space-y-2">
            <Label htmlFor="chatName">Group Name</Label>
            <Input
              id="chatName"
              placeholder="Enter group name..."
              value={chatName}
              onChange={(e) => setChatName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* User selection section */}
          <div className="space-y-2">
            <Label>Select Members</Label>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10"
              />
            </div>

            {/* Contact list */}
            <ScrollArea className="h-64 border rounded-md">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading contacts...</span>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <User className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchQuery ? 'No matching contacts found' : 'No contacts available'}
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredContacts.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(contact.id)}
                        onCheckedChange={() => handleUserToggle(contact.id)}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          {contact.isAI ? (
                            <Bot className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium truncate">{contact.name}</span>
                        </div>

                        {!contact.isAI && (
                          <div className="flex items-center space-x-2 mt-1">
                            {contact.isConnected && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                                Connected
                              </span>
                            )}
                            {!contact.canMessage && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">
                                Limited
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Selected count */}
            {selectedUserIds.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedUserIds.length} member{selectedUserIds.length === 1 ? '' : 's'} selected
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedUserIds.length === 0}
          >
            <Users className="mr-2 h-4 w-4" />
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}