/**
 * Pairing Dialog
 *
 * Allows users to pair their browser instance with other devices/users.
 * Displays pairing codes and handles the pairing flow using worker-based operations.
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QrCode, Copy, CheckCircle, RefreshCw, Link2, AlertTriangle } from 'lucide-react'

interface PairingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPaired?: (contactId: string) => void
}

export function PairingDialog({ open, onOpenChange, onPaired }: PairingDialogProps) {
  const [mode, setMode] = useState<'generate' | 'enter'>('generate')
  const [pairingCode, setPairingCode] = useState<string>('')
  const [enteredCode, setEnteredCode] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState<'idle' | 'pairing' | 'paired' | 'error'>('idle')

  useEffect(() => {
    if (open && mode === 'generate') {
      generatePairingCode()
    }
  }, [open, mode])

  const generatePairingCode = async () => {
    setLoading(true)
    setError(null)

    try {
      // TODO: Implement pairing code generation via Model handlers
      // Placeholder implementation
      const code = `LAMA-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      setPairingCode(code)

      console.log('[PairingDialog] Generated pairing code:', code)
    } catch (err) {
      console.error('[PairingDialog] Failed to generate pairing code:', err)
      setError('Failed to generate pairing code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyPairingCode = () => {
    navigator.clipboard.writeText(pairingCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePair = async () => {
    if (!enteredCode.trim()) {
      setError('Please enter a pairing code')
      return
    }

    setLoading(true)
    setError(null)
    setStatus('pairing')

    try {
      // TODO: Implement pairing via Model handlers
      // Placeholder implementation
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const mockContactId = `contact-${Date.now()}`

      setStatus('paired')
      console.log('[PairingDialog] Paired successfully:', mockContactId)

      // Notify parent
      if (onPaired) {
        onPaired(mockContactId)
      }

      // Close dialog after a moment
      setTimeout(() => {
        onOpenChange(false)
        resetState()
      }, 2000)
    } catch (err) {
      console.error('[PairingDialog] Pairing failed:', err)
      setError('Invalid pairing code or connection failed. Please try again.')
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const resetState = () => {
    setEnteredCode('')
    setError(null)
    setStatus('idle')
    setCopied(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Link2 className="h-5 w-5" />
            <span>Pair Device</span>
          </DialogTitle>
          <DialogDescription>
            Connect with another LAMA instance to sync conversations
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'generate' | 'enter')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Share Code</TabsTrigger>
            <TabsTrigger value="enter">Enter Code</TabsTrigger>
          </TabsList>

          {/* Generate Code Tab */}
          <TabsContent value="generate" className="space-y-4">
            <div className="space-y-2">
              <Label>Your Pairing Code</Label>
              <div className="flex items-center space-x-2">
                <Input
                  value={pairingCode}
                  readOnly
                  className="font-mono text-lg text-center"
                  placeholder="Generating..."
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyPairingCode}
                  disabled={!pairingCode}
                >
                  {copied ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this code with another device. Expires in 5 minutes.
              </p>
            </div>

            {/* QR Code Placeholder */}
            <div className="flex items-center justify-center p-6 bg-muted rounded-lg">
              <div className="text-center space-y-2">
                <QrCode className="h-16 w-16 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground">QR code coming soon</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={generatePairingCode}
              disabled={loading}
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Generate New Code
            </Button>
          </TabsContent>

          {/* Enter Code Tab */}
          <TabsContent value="enter" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pairing-code">Pairing Code</Label>
              <Input
                id="pairing-code"
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value.toUpperCase())}
                placeholder="LAMA-XXXXXX"
                className="font-mono text-lg text-center"
                disabled={loading || status === 'paired'}
              />
              <p className="text-xs text-muted-foreground">
                Enter the pairing code from the other device
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {status === 'paired' && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Successfully paired! You can now sync conversations.
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handlePair}
              disabled={loading || !enteredCode.trim() || status === 'paired'}
              className="w-full"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Pairing...
                </>
              ) : status === 'paired' ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Paired
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Pair Device
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter className="sm:justify-between">
          <Badge variant="secondary" className="text-xs">
            Via commserver relay
          </Badge>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
