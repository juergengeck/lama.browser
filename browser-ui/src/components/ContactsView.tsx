/**
 * ContactsView - Platform-Agnostic Component
 *
 * Uses usePlans() for platform-agnostic access to contacts, chat, and IOM plans.
 * - contacts.getContacts() → ContactsPlan
 * - chat.getOrCreateTopicForContact() → ChatPlan
 * - connection.createPairingInvitation() → ConnectionPlan (IOM)
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@lama/ui'
import { Avatar, AvatarFallback } from '@lama/ui'
import { Button } from '@lama/ui'
import { Badge } from '@lama/ui'
import { Input } from '@lama/ui'
import { ScrollArea } from '@lama/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@lama/ui'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@lama/ui'
import { Users, UserPlus, Search, Circle, Bot, MessageSquare, Download, CheckCircle, User, Edit, MoreVertical, Shield, UserCheck, Ban, Trash2, Link as LinkIcon } from 'lucide-react'
import { useModel } from '@/model/ModelContext'
import { usePlans } from '@lama/ui'
import { ProfileDialog } from './ProfileDialog'
import { ChainOfTrustView } from './ChainOfTrustView'

interface ContactsViewProps {
  onNavigateToChat?: (topicId: string, contactName: string) => void
}

export function ContactsView({ onNavigateToChat }: ContactsViewProps) {
  // Keep Model for platform-specific features (initialized state)
  const model = useModel()

  // Use Plans for platform-agnostic operations
  const { contacts: contactsPlan, connection } = usePlans()

  const [contacts, setContacts] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [creatingTopic, setCreatingTopic] = useState<string | null>(null)
  const [loadingModel, setLoadingModel] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [chainOfTrustDialogOpen, setChainOfTrustDialogOpen] = useState(false)
  const [selectedContactForTrust, setSelectedContactForTrust] = useState<any | null>(null)

  useEffect(() => {
    loadContacts()

    // Listen for contact updates
    const handleContactsUpdated = () => {
      console.log('[ContactsView] Contacts updated event received')
      loadContacts()
    }

    // Listen for browser event (dispatched when contacts change)
    const handleContactAdded = () => {
      console.log('[ContactsView] Contact added event received')
      loadContacts()
    }

    window.addEventListener('contacts:updated', handleContactsUpdated)
    window.addEventListener('contact:added', handleContactAdded)

    // Also refresh contacts periodically
    const interval = setInterval(loadContacts, 5000)

    return () => {
      window.removeEventListener('contacts:updated', handleContactsUpdated)
      clearInterval(interval)
    }
  }, [model, contactsPlan])

  const loadContacts = async () => {
    if (!model.initialized) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Platform-agnostic contact loading WITH TRUST INFORMATION
      const result = await contactsPlan.getContactsWithTrust()

      if (!result.success || !result.contacts) {
        setContacts([])
        setLoading(false)
        return
      }

      const allContacts = result.contacts
      console.log('[ContactsView] Loaded contacts with trust:', allContacts)
      console.log('[ContactsView] Contact count:', allContacts?.length)
      allContacts?.forEach((c, i) => {
        console.log(`[ContactsView]   Contact ${i}: ${c.name} (${c.id?.substring(0, 8)}...) trust=${c.trustLevel} connected=${c.isConnected}`)
      })

      // Enrich AI contacts with model information
      const enrichedContacts = await Promise.all(
        (allContacts || []).map(async (contact) => {
          if (contact.isAI) {
            try {
              // TODO: Implement getAvailableModels via Model
              // For now, return contact without model info
              console.log('[ContactsView] TODO: Implement getAvailableModels for AI contact:', contact.name)
              return contact
            } catch (error) {
              console.error(`[ContactsView] Failed to get model info for ${contact.name}:`, error)
              return contact
            }
          }
          return contact
        })
      )

      // Sort: Owner (self) first, then others
      const sortedContacts = enrichedContacts.sort((a, b) => {
        if (a.trustLevel === 'self') return -1
        if (b.trustLevel === 'self') return 1
        return 0
      })

      setContacts(sortedContacts)
    } finally {
      setLoading(false)
    }
  }

  const filteredContacts = contacts.filter(contact => {
    const name = contact.name || contact.displayName || ''
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-500'
      case 'connecting': return 'text-yellow-500'
      case 'disconnected': return 'text-gray-500'
      default: return 'text-gray-500'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected': return 'Online'
      case 'connecting': return 'Connecting...'
      case 'disconnected': return 'Offline'
      default: return 'Unknown'
    }
  }

  const getTrustIcon = (trustLevel: string) => {
    switch (trustLevel) {
      case 'high':
        return <Shield className="h-3 w-3 text-blue-500" />
      case 'medium':
        return <Shield className="h-3 w-3 text-pink-500" />
      case 'low':
        return <Shield className="h-3 w-3 text-gray-400" />
      case 'discovered':
        return <Shield className="h-3 w-3 text-yellow-500" />
      case 'blocked':
        return <Ban className="h-3 w-3 text-red-500" />
      default:
        return <Shield className="h-3 w-3 text-gray-400" />
    }
  }

  const getTrustBadgeVariant = (trustLevel: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (trustLevel) {
      case 'high':
        return 'default'
      case 'medium':
        return 'secondary'
      case 'low':
      case 'discovered':
        return 'outline'
      case 'blocked':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const handleAcceptContact = async (contactId: string) => {
    try {
      const result = await contactsPlan.acceptContact(contactId, {
        canMessage: true,
        canSync: true
      })
      if (result.success) {
        loadContacts() // Refresh the list
      } else {
        alert(result.error || 'Failed to accept contact')
      }
    } catch (error: any) {
      console.error('[ContactsView] Failed to accept contact:', error)
      alert(error.message || 'Failed to accept contact')
    }
  }

  const handleBlockContact = async (contactId: string) => {
    try {
      const result = await contactsPlan.blockContact(contactId, 'User blocked')
      if (result.success) {
        loadContacts() // Refresh the list
      } else {
        alert(result.error || 'Failed to block contact')
      }
    } catch (error: any) {
      console.error('[ContactsView] Failed to block contact:', error)
      alert(error.message || 'Failed to block contact')
    }
  }

  const handleRemoveContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to remove this contact?')) {
      return
    }
    try {
      const result = await contactsPlan.removeContact(contactId)
      if (result.success) {
        loadContacts() // Refresh the list
      } else {
        alert(result.error || 'Failed to remove contact')
      }
    } catch (error: any) {
      console.error('[ContactsView] Failed to remove contact:', error)
      alert(error.message || 'Failed to remove contact')
    }
  }

  const handleMessageClick = async (contact: any) => {
    console.log('[ContactsView] Message clicked for contact:', contact)

    if (!model.initialized) {
      console.error('[ContactsView] Model not initialized')
      return
    }

    // Set loading state for this contact
    setCreatingTopic(contact.id)

    try {
      // TODO: Implement getOrCreateTopicForContact via model.chatPlan
      console.log('[ContactsView] TODO: Implement getOrCreateTopicForContact for:', contact.id)

      // For now, just log
      console.warn('[ContactsView] getOrCreateTopicForContact not yet implemented')
    } catch (error) {
      console.error('[ContactsView] Error creating topic:', error)
    } finally {
      setCreatingTopic(null)
    }
  }

  const handleLoadModel = async (contact: any) => {
    if (!contact.modelInfo || !model.initialized) return

    setLoadingModel(contact.id)
    try {
      // TODO: Implement loadModel via model.llmManager
      console.log(`[ContactsView] TODO: Implement loadModel for: ${contact.modelInfo.id}`)
      console.warn('[ContactsView] loadModel not yet implemented')
    } catch (error) {
      console.error('[ContactsView] Failed to load model:', error)
    } finally {
      setLoadingModel(null)
    }
  }

  const handleAddContact = async () => {
    try {
      if (!model.initialized) {
        alert('Model not initialized. Please wait.')
        return
      }

      // Platform-agnostic pairing invitation creation
      console.log('[ContactsView] Creating pairing invitation...')
      const result = await connection.createPairingInvitation({})

      if (result.success && result.invitation) {
        // Copy invitation URL to clipboard
        await navigator.clipboard.writeText(result.invitation.url)
        alert('Invitation link copied to clipboard! Share it with your contact.')
      } else {
        alert(result.error || 'Failed to create invitation')
      }
    } catch (error: any) {
      console.error('[ContactsView] Failed to create invitation:', error)
      alert(error.message || 'Failed to create invitation')
    }
  }

  const handleProfileSaved = () => {
    // Reload contacts to get updated owner name
    loadContacts()
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Search and Add Contact */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Contacts</CardTitle>
            </div>
            <Button size="sm" onClick={handleAddContact}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contacts List */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="p-4 space-y-2 max-h-[calc(100vh-300px)]">
              {filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No contacts found</p>
                  <p className="text-sm mt-2">Add contacts to start messaging</p>
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <Card key={contact.id} className="hover:bg-accent transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <Avatar>
                            <AvatarFallback className={contact.isAI ? 'bg-purple-100 dark:bg-purple-900' : ''}>
                              {contact.isAI ? (
                                <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                              ) : (
                                (contact.displayName || contact.name || 'UN').substring(0, 2).toUpperCase()
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium truncate">{contact.displayName || contact.name || 'Unknown'}</span>
                              <Badge
                                variant={contact.isAI ? "secondary" : "outline"}
                                className="text-xs flex-shrink-0"
                              >
                                {contact.isAI ? 'AI' : 'P2P'}
                              </Badge>
                              {contact.trustLevel && (
                                <Badge
                                  variant={getTrustBadgeVariant(contact.trustLevel)}
                                  className="text-xs flex-shrink-0"
                                >
                                  {getTrustIcon(contact.trustLevel)}
                                  <span className="ml-1">{contact.trustLevel}</span>
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 mt-1 flex-wrap">
                              <Circle className={`h-2 w-2 fill-current ${
                                contact.isAI
                                  ? (contact.modelInfo?.isLoaded ? 'text-green-500' : 'text-yellow-500')
                                  : (contact.isConnected ? 'text-green-500' : 'text-gray-400')
                              }`} />
                              <span className="text-xs text-muted-foreground">
                                {contact.isAI
                                  ? (contact.modelInfo?.isLoaded ? 'Ready' : 'Not Loaded')
                                  : (contact.isConnected ? 'Connected' : 'Offline')}
                              </span>
                              {contact.discoverySource && (
                                <>
                                  <span className="text-xs text-muted-foreground">·</span>
                                  <Badge variant="outline" className="text-xs">
                                    <LinkIcon className="h-2 w-2 mr-1" />
                                    {contact.discoverySource}
                                  </Badge>
                                </>
                              )}
                              {contact.canMessage && (
                                <Badge variant="outline" className="text-xs">
                                  Messages
                                </Badge>
                              )}
                              {contact.canSync && (
                                <Badge variant="outline" className="text-xs">
                                  Sync
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {/* For AI contacts with local models that aren't loaded, show Load button */}
                          {contact.isAI && contact.modelInfo?.modelType === 'local' && !contact.modelInfo?.isLoaded && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleLoadModel(contact)
                              }}
                              disabled={loadingModel === contact.id}
                            >
                              {loadingModel === contact.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-1" />
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <Download className="h-3 w-3 mr-1" />
                                  Load Model
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMessageClick(contact)}
                            disabled={creatingTopic === contact.id}
                          >
                            {creatingTopic === contact.id ? (
                              <>Creating chat...</>
                            ) : (
                              <>
                                <MessageSquare className="h-4 w-4 mr-1" />
                                Message
                              </>
                            )}
                          </Button>

                          {/* Context Menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>
                                {contact.trustLevel === 'self' ? 'My Profile' : 'Contact Actions'}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />

                              {contact.trustLevel === 'self' ? (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingContactId(contact.id)
                                    setProfileDialogOpen(true)
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Profile
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedContactForTrust(contact)
                                      setChainOfTrustDialogOpen(true)
                                    }}
                                  >
                                    <Shield className="h-4 w-4 mr-2" />
                                    View Chain of Trust
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator />

                                  {contact.trustLevel === 'discovered' && (
                                    <DropdownMenuItem onClick={() => handleAcceptContact(contact.id)}>
                                      <UserCheck className="h-4 w-4 mr-2" />
                                      Accept Contact
                                    </DropdownMenuItem>
                                  )}

                                  {contact.trustLevel !== 'blocked' && contact.trustLevel !== 'self' && (
                                    <DropdownMenuItem onClick={() => handleBlockContact(contact.id)}>
                                      <Ban className="h-4 w-4 mr-2" />
                                      Block Contact
                                    </DropdownMenuItem>
                                  )}

                                  {contact.trustLevel !== 'self' && (
                                    <DropdownMenuItem
                                      onClick={() => handleRemoveContact(contact.id)}
                                      className="text-red-600 dark:text-red-400"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Remove Contact
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Profile Dialog */}
      <ProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        currentName={contacts.find(c => c.trustLevel === 'self')?.name || ''}
        required={false}
        onSave={handleProfileSaved}
      />

      {/* Chain of Trust Dialog */}
      <Dialog open={chainOfTrustDialogOpen} onOpenChange={setChainOfTrustDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chain of Trust</DialogTitle>
            <DialogDescription>
              Trust path for {selectedContactForTrust?.name || 'contact'}
            </DialogDescription>
          </DialogHeader>
          {selectedContactForTrust && (
            <ChainOfTrustView
              personId={selectedContactForTrust.personId || selectedContactForTrust.id}
              model={model}
              className="mt-4"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}