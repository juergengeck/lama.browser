/**
 * Instances View - Shows connected devices/instances
 * Similar to one.leute's InstancesSettingsView
 */

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Monitor,
  Smartphone,
  Tablet,
  HardDrive,
  AlertCircle,
  MoreVertical,
  CheckCircle,
  XCircle,
  Plus,
  Copy,
  User
} from 'lucide-react'
import { useModel } from '@/model'

interface Instance {
  id: string
  personId: string
  name: string
  platform: 'browser' | 'nodejs' | 'mobile' | 'desktop' | 'unknown'
  role: 'hub' | 'client' | 'peer'
  isLocal: boolean
  isConnected: boolean
  trusted: boolean
  lastSeen: Date
  capabilities?: {
    network?: boolean
    storage?: boolean
    llm?: boolean
  }
  connectionInfo?: {
    endpoint?: string
    protocol?: string
    latency?: number
  }
}

export default function InstancesView() {
  const model = useModel()
  const [browserInstance, setBrowserInstance] = useState<Instance | null>(null)
  const [nodeInstance, setNodeInstance] = useState<Instance | null>(null)
  const [myDevices, setMyDevices] = useState<Instance[]>([])
  const [contacts, setContacts] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [inviteType, setInviteType] = useState<'device' | 'contact'>('device')

  useEffect(() => {
    loadInstances()
    
    // Listen for instance updates via CHUM sync
    const handleChumSync = (event: any) => {
      if (event.detail?.type === 'ConnectionInfo') {
        loadInstances()
      }
    }
    
    window.addEventListener('chum:sync', handleChumSync)
    return () => window.removeEventListener('chum:sync', handleChumSync)
  }, [])


  const loadInstances = async () => {
    try {
      // Get browser instance info
      const browserInfo = {
        id: 'browser-instance',
        personId: model.ownerId || 'local',
        name: 'Browser Instance',
        platform: 'browser' as const,
        role: 'client' as const,
        isLocal: true,
        isConnected: model.initialized,
        trusted: true,
        lastSeen: new Date(),
        capabilities: {
          network: true,   // P2P via WebRTC/WebSocket
          storage: true,   // IndexedDB for ONE.core storage
          llm: false       // No LLM in browser
        }
      }
      setBrowserInstance(browserInfo)

      // No separate Node.js instance in browser-only architecture
      setNodeInstance(null)

      // Get contacts from ONE.core
      try {
        const result = await model.contactsHandler.getContacts()
        const chumContacts: Instance[] = []

        if (result.success && result.data && Array.isArray(result.data)) {
          console.log(`[InstancesView] Found ${result.data.length} contacts`)

          for (const contact of result.data) {
            chumContacts.push({
              id: `contact-${contact.id || Date.now()}`,
              personId: contact.personId || contact.id || 'unknown',
              name: contact.name || `Contact ${(contact.personId || '').substring(0, 8)}`,
              platform: 'external' as const,
              role: 'contact' as const,
              isLocal: false,
              isConnected: true,
              trusted: true,
              lastSeen: new Date(),
              capabilities: {}
            })
          }
        }

        setContacts(chumContacts)
        console.log(`[InstancesView] Set ${chumContacts.length} total contacts`)
      } catch (error) {
        console.error('[InstancesView] Error getting contacts:', error)
        setContacts([])
      }

      // TODO: Get actual my devices from connections model
      setMyDevices([])
    } catch (error) {
      console.error('[InstancesView] Error loading instances:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateInvitation = async () => {
    try {
      console.log('[InstancesView] Creating invitation...')
      // TODO: Implement invitation creation in Worker
      // For now, show not implemented message
      alert('Invitation creation not yet implemented in browser-only mode')
    } catch (error) {
      console.error('[InstancesView] Error creating invitation:', error)
      alert('Error creating invitation: ' + (error as Error).message)
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'browser':
        return <Monitor className="h-4 w-4" />
      case 'mobile':
        return <Smartphone className="h-4 w-4" />
      case 'desktop':
        return <Monitor className="h-4 w-4" />
      case 'nodejs':
        return <HardDrive className="h-4 w-4" />
      case 'tablet':
        return <Tablet className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (role) {
      case 'hub':
        return 'default'
      case 'client':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Loading instances...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Local Instances */}
      <div>
        <h3 className="text-sm font-medium mb-2">Local Instances</h3>
        <Card>
          <CardContent className="p-0">
            {/* Browser Instance */}
            {browserInstance && (
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      {getPlatformIcon(browserInstance.platform)}
                    </div>
                    <div>
                      <div className="font-medium">{browserInstance.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Renderer Process
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={getRoleBadgeVariant(browserInstance.role)}>
                          {browserInstance.role}
                        </Badge>
                        <Badge variant="outline">
                          {browserInstance.platform}
                        </Badge>
                        {browserInstance.capabilities?.storage && (
                          <Badge variant="secondary">Sparse Storage</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>
            )}
            
            <Separator />
            
            {/* Node.js Instance */}
            {nodeInstance && (
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {getPlatformIcon(nodeInstance.platform)}
                    </div>
                    <div>
                      <div className="font-medium">{nodeInstance.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Main Process - {nodeInstance.id?.substring(0, 12)}...
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={getRoleBadgeVariant(nodeInstance.role)}>
                          {nodeInstance.role}
                        </Badge>
                        <Badge variant="outline">
                          {nodeInstance.platform}
                        </Badge>
                        {nodeInstance.capabilities?.network && (
                          <Badge variant="secondary">Network</Badge>
                        )}
                        {nodeInstance.capabilities?.storage && (
                          <Badge variant="secondary">Archive Storage</Badge>
                        )}
                        {nodeInstance.capabilities?.llm && (
                          <Badge variant="secondary">LLM</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {nodeInstance.isConnected ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* My Devices (Internet of Me) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">
            My Devices ({myDevices.length})
          </h3>
          <Button
            size="sm"
            onClick={() => {
              setInviteType('device')
              handleCreateInvitation()
            }}
            className="gap-2"
          >
            <Plus className="h-3 w-3" />
            Add Device
          </Button>
        </div>

        {myDevices.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                No additional devices. Add your phone, tablet, or other devices to your Internet of Me.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {myDevices.map((device, index) => (
                <div key={device.id}>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${
                          device.isConnected ? 'bg-green-500/10' : 'bg-gray-500/10'
                        }`}>
                          {getPlatformIcon(device.platform)}
                        </div>
                        <div>
                          <div className="font-medium">{device.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {device.personId ? `${device.personId.substring(0, 12)}...` : 'No ID'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Last seen: {device.lastSeen.toLocaleString()}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">
                              {device.platform}
                            </Badge>
                            <Badge variant="secondary">My Device</Badge>
                            {device.isConnected && (
                              <Badge variant="default">Connected</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {device.isConnected ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-400" />
                        )}
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {index < myDevices.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* Contacts */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">
            Contacts ({contacts.length})
          </h3>
          {/* TODO: Implement invitation creation in Worker
          <Button
            size="sm"
            onClick={() => {
              handleCreateInvitation()
            }}
            className="gap-2"
          >
            {copiedInvite ? (
              <>
                <Copy className="h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <User className="h-3 w-3" />
                Add Contact
              </>
            )}
          </Button>
          */}
        </div>

        {contacts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                No contacts yet. Share your invitation link to connect with other users.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {contacts.map((contact, index) => (
                <div key={contact.id}>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${
                          contact.isConnected ? 'bg-blue-500/10' : 'bg-gray-500/10'
                        }`}>
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">{contact.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {contact.personId ? `${contact.personId.substring(0, 12)}...` : 'No ID'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Last seen: {contact.lastSeen.toLocaleString()}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {contact.trusted && (
                              <Badge variant="secondary">Trusted</Badge>
                            )}
                            {contact.isConnected && (
                              <Badge variant="default">Connected</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {contact.isConnected ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-400" />
                        )}
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {index < contacts.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}