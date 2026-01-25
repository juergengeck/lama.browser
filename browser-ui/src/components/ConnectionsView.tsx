import { useState, useEffect, useCallback } from 'react'
import { usePlans } from '@refinio/lama.ui'
import { useModel } from '@/model/index.js'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@refinio/lama.ui'
import { Button } from '@refinio/lama.ui'
import { Input } from '@refinio/lama.ui'
import { Label } from '@refinio/lama.ui'
import { Badge } from '@refinio/lama.ui'
import { ScrollArea } from '@refinio/lama.ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@refinio/lama.ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@refinio/lama.ui'
import { Alert, AlertDescription } from '@refinio/lama.ui'
import {
  Users, UserPlus, Link, QrCode, Copy, Check, Circle,
  RefreshCw, Wifi, WifiOff, Shield, X, AlertTriangle,
  Loader2, ExternalLink, Network, Smartphone
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

interface Connection {
  id: string
  personId: string
  name: string
  status: 'connected' | 'connecting' | 'disconnected'
  type: 'direct' | 'relay'
  endpoint?: string
  lastSeen: Date
  trustLevel?: 'full' | 'partial' | 'none'
}

interface PairingInvitation {
  url: string
  token: string
  mode: 'IoM' | 'IoP'
}

type InvitationMode = 'IoM' | 'IoP'

interface ConnectionsViewProps {
  onNavigateToChat?: (topicId: string, contactName: string) => void
}

export function ConnectionsView({ onNavigateToChat }: ConnectionsViewProps = {}) {
  const model = useModel() // For initialization checks
  const { connection } = usePlans() // Platform-agnostic connection operations
  const [connections, setConnections] = useState<Connection[]>([])
  const [isCreatingInvitation, setIsCreatingInvitation] = useState(false)
  const [currentInvitation, setCurrentInvitation] = useState<PairingInvitation | null>(null)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showAcceptDialog, setShowAcceptDialog] = useState(false)
  const [showModeDialog, setShowModeDialog] = useState(false)
  const [selectedMode, setSelectedMode] = useState<InvitationMode>('IoP')
  const [invitationUrl, setInvitationUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline'>('offline')
  const [commServerUrl, setCommServerUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  // All operations via IPC - no AppModel in browser

  // Get lama domain from settings with fallback
  const getLamaDomain = (): string => {
    // Check localStorage for saved domain
    const savedDomain = localStorage.getItem('lama-domain')
    if (savedDomain) {
      return savedDomain
    }

    // Default to lama.one for all environments
    return 'lama.one'
  }

  // Load connections and network status
  useEffect(() => {
    loadConnections()
    checkNetworkStatus()
    
    // Listen for connection events via IPC if needed in future
    
    console.log('[ConnectionsView] Setting up CHUM sync listeners...')
    
    // Listen for CHUM sync events from main process
    const handleChumSync = (data: any) => {
      console.log('[ConnectionsView] Received CHUM sync data:', data)
      
      if (data.type === 'Settings' && Array.isArray(data.changes)) {
        data.changes.forEach((settingsObject: any) => {
          if (settingsObject.category === 'connections') {
            console.log('[ConnectionsView] Processing connections settings from CHUM sync')
            processConnectionsSettings(settingsObject.data)
          }
        })
      }
    }

    // In browser platform, use channelManager.onUpdated for real-time updates
    // (No Electron IPC events needed)
    const unsubscribe = model.channelManager?.onUpdated?.(async () => {
      // Reload connections when channel updates occur
      await loadConnections()
    })

    // Initial load and periodic updates
    loadConnections()
    checkNetworkStatus()

    const interval = setInterval(() => {
      checkNetworkStatus() // Keep network status polling
    }, 10000)

    return () => {
      clearInterval(interval)
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  const processConnectionsSettings = (settingsData: any) => {
    try {
      console.log('[ConnectionsView] Processing connections settings:', settingsData)
      
      // Process contacts (Person objects) if available
      if (settingsData.contacts && Array.isArray(settingsData.contacts)) {
        const formattedConnections: Connection[] = settingsData.contacts.map((person: any) => ({
          id: person.connectionId || person.id || `conn-${Math.random()}`,
          personId: person.id || '',
          name: person.name || 'Unknown Contact',
          status: 'connected', // Person objects mean they're connected
          type: person.platform === 'browser' ? 'direct' : 'relay',
          endpoint: person.email || '',
          lastSeen: new Date(person.connectedAt || person.pairedAt || Date.now()),
          trustLevel: person.trusted ? 'full' : 'partial'
        }))
        
        setConnections(formattedConnections)
        console.log(`[ConnectionsView] Updated ${formattedConnections.length} contacts from CHUM sync`)
        return
      }
      
      // Fallback to connections array if no contacts
      if (settingsData.connections && Array.isArray(settingsData.connections)) {
        const formattedConnections: Connection[] = settingsData.connections.map((conn: any) => ({
          id: conn.id || `conn-${Math.random()}`,
          personId: conn.personId || '',
          name: conn.name || 'Unknown',
          status: conn.isConnected ? 'connected' : 'disconnected',
          type: conn.type === 'direct' ? 'direct' : 'relay',
          endpoint: conn.endpoint,
          lastSeen: new Date(conn.lastSeen || Date.now()),
          trustLevel: conn.trusted ? 'full' : 'partial'
        }))
        
        setConnections(formattedConnections)
        console.log(`[ConnectionsView] Updated connections from CHUM sync: ${formattedConnections.length} connections`)
      }
    } catch (error) {
      console.error('[ConnectionsView] Error processing CHUM sync connections:', error)
    }
  }

  const loadConnections = async () => {
    // Connections data will come via CHUM sync events
    // This method is kept for manual refresh if needed
    console.log('[ConnectionsView] Waiting for connections data via CHUM sync...')
  }

  const checkNetworkStatus = async () => {
    try {
      // Check network status via IPC (future enhancement)
      // For now, assume online if connections exist
      const hasActiveConnections = connections.some(c => c.status === 'connected')
      setNetworkStatus(hasActiveConnections ? 'online' : 'offline')
      
      // Get CommServer URL from environment
      const isDev = window.location.hostname === 'localhost' || process.env.NODE_ENV === 'development'
      const defaultCommServer = 'wss://comm10.dev.refinio.one'
      setCommServerUrl(defaultCommServer)
    } catch (error) {
      console.error('[ConnectionsView] Failed to check network status:', error)
      setNetworkStatus('offline')
    }
  }

  // Show mode selection dialog before creating invitation
  const handleCreateInviteClick = () => {
    setShowModeDialog(true)
  }

  // Create invitation with selected mode
  const createInvitation = async (mode: InvitationMode) => {
    setShowModeDialog(false)
    setIsCreatingInvitation(true)
    setError(null)

    try {
      console.log(`[ConnectionsView] Creating ${mode} pairing invitation...`)

      // Create invitation using platform-agnostic connection plan with mode
      const result = await connection.createPairingInvitation({ mode })

      if (!result.success) {
        throw new Error(result.error || 'Failed to create invitation')
      }

      console.log('[ConnectionsView] Invitation created:', result.invitation)

      // Use the invitation data from connection plan
      const invitation: PairingInvitation = {
        url: result.invitation!.url,
        token: result.invitation!.token,
        mode: result.invitation!.mode
      }

      setCurrentInvitation(invitation)
      setShowInviteDialog(true)
    } catch (error) {
      console.error('[ConnectionsView] Failed to create invitation:', error)
      // Provide more helpful error messages
      let errorMessage = 'Failed to create invitation'
      if (error instanceof Error) {
        if (error.message.includes('promisePlugin')) {
          errorMessage = 'Network connection not established. Please wait for connection to initialize.'
        } else {
          errorMessage = error.message
        }
      }
      setError(errorMessage)
    } finally {
      setIsCreatingInvitation(false)
    }
  }

  const acceptInvitation = async () => {
    if (!invitationUrl) {
      setError('Please enter an invitation URL')
      return
    }

    setIsRefreshing(true)
    setError(null)

    try {
      console.log('[ConnectionsView] Accepting invitation URL:', invitationUrl)

      // Accept invitation using platform-agnostic connection plan
      // ConnectionPlan expects { invitationUrl: string }
      const result = await connection.acceptPairingInvitation({ invitationUrl })

      if (result.success) {
        console.log('[ConnectionsView] Invitation accepted successfully')
        // Close dialog and refresh connections
        setShowAcceptDialog(false)
        setInvitationUrl('')
        await loadConnections()
      } else {
        setError(result.error || 'Failed to accept invitation')
      }
    } catch (error: any) {
      console.error('[ConnectionsView] Failed to accept invitation:', error)
      setError(error.message || 'Failed to accept invitation')
    } finally {
      setIsRefreshing(false)
    }
  }

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      // Use browser clipboard API (works in Electron renderer)
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      // Fallback: try selecting and copying the text
      try {
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError)
      }
    }
  }, [])

  const refreshConnections = async () => {
    setIsRefreshing(true)
    await loadConnections()
    await checkNetworkStatus()
    setIsRefreshing(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-500'
      case 'disconnected': return 'text-gray-500'
      default: return 'text-gray-500'
    }
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Network Status Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center space-x-2">
                {networkStatus === 'online' ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-gray-500" />
                )}
                <span className="font-medium">
                  {networkStatus === 'online' ? 'Connected' : 'Offline'}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Relay: {commServerUrl}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshConnections}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAcceptDialog(true)}
              >
                <Link className="h-4 w-4 mr-2" />
                Accept Invite
              </Button>
              <Button
                size="sm"
                onClick={handleCreateInviteClick}
                disabled={isCreatingInvitation}
              >
                {isCreatingInvitation ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Create Invite
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Connections Tabs */}
      <Tabs defaultValue="active" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">
            Active ({connections.filter(c => c.status === 'connected').length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({connections.filter(c => c.status === 'disconnected').length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({connections.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="flex-1 mt-4">
          <ConnectionsList 
            connections={connections.filter(c => c.status === 'connected')}
            onRefresh={refreshConnections}
          />
        </TabsContent>

        <TabsContent value="pending" className="flex-1 mt-4">
          <ConnectionsList 
            connections={connections.filter(c => c.status === 'disconnected')}
            onRefresh={refreshConnections}
          />
        </TabsContent>

        <TabsContent value="all" className="flex-1 mt-4">
          <ConnectionsList 
            connections={connections}
            onRefresh={refreshConnections}
          />
        </TabsContent>
      </Tabs>

      {/* Create Invitation Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Invitation</DialogTitle>
            <DialogDescription>
              Share this invitation link or QR code to connect with another device. This invitation creates a secure peer-to-peer connection.
            </DialogDescription>
          </DialogHeader>
          
          {currentInvitation && (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white dark:bg-gray-800 rounded-lg border">
                <QRCodeSVG value={currentInvitation.url} size={200} />
              </div>
              
              {/* URL */}
              <div className="space-y-2">
                <Label>Invitation URL</Label>
                <div className="flex space-x-2">
                  <Input 
                    value={currentInvitation.url} 
                    readOnly 
                    className="text-xs font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(currentInvitation.url)}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              {/* Connection Details */}
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Domain: {getLamaDomain()}</div>
                <div>Mode: {currentInvitation.mode === 'IoM' ? 'Device Pairing (IoM)' : 'Partner Connection (IoP)'}</div>
                <div>Token: {currentInvitation.token.substring(0, 20)}...</div>
              </div>
              
              {/* Instructions */}
              <div className="text-sm bg-blue-50 p-3 rounded-lg">
                <p className="font-medium mb-1">How to connect:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Share this QR code or URL with the other person</li>
                  <li>They scan the QR code or paste the URL in their app</li>
                  <li>Connection will be established automatically</li>
                </ol>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mode Selection Dialog */}
      <Dialog open={showModeDialog} onOpenChange={setShowModeDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Invitation Type</DialogTitle>
            <DialogDescription>
              Choose how you want to connect
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-auto p-4 flex flex-col items-start gap-1"
              onClick={() => createInvitation('IoP')}
            >
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Partner Connection (IoP)</span>
              </div>
              <span className="text-xs text-muted-foreground text-left">
                Connect with another person to start chatting
              </span>
            </Button>

            <Button
              variant="outline"
              className="w-full h-auto p-4 flex flex-col items-start gap-1"
              onClick={() => createInvitation('IoM')}
            >
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-green-600" />
                <span className="font-medium">Device Pairing (IoM)</span>
              </div>
              <span className="text-xs text-muted-foreground text-left">
                Connect your own devices to sync data
              </span>
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModeDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept Invitation Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Invitation</DialogTitle>
            <DialogDescription>
              Paste the invitation URL to connect with another device
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Invitation URL</Label>
              <Input
                placeholder="https://..."
                value={invitationUrl}
                onChange={(e) => setInvitationUrl(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAcceptDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={acceptInvitation} 
              disabled={!invitationUrl || isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Connections List Component
function ConnectionsList({ 
  connections, 
  onRefresh 
}: { 
  connections: Connection[]
  onRefresh: () => void 
}) {
  if (connections.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center py-8">
          <Network className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No connections</p>
          <p className="text-sm text-muted-foreground mt-2">
            Create an invitation to connect with other devices
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <ScrollArea className="h-full">
        <CardContent className="p-4 space-y-2">
          {connections.map((connection) => (
            <Card key={connection.id} className="hover:bg-accent transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Circle className={`h-2 w-2 fill-current ${
                      connection.status === 'connected' ? 'text-green-500' : 'text-gray-500'
                    }`} />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{connection.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {connection.type === 'direct' ? 'P2P' : 'Relay'}
                        </Badge>
                        {connection.trustLevel === 'full' && (
                          <Shield className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {connection.endpoint || connection.personId.substring(0, 8)}...
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Last seen: {connection.lastSeen.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </ScrollArea>
    </Card>
  )
}