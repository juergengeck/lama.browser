/**
 * Invitation Acceptance Component
 *
 * Handles both IoM (device) and IoP (partner) invitation acceptance
 * Following the one.leute pattern for invitation handling
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle, UserPlus, Smartphone } from 'lucide-react'
import { parseInvitationUrl, type InvitationMode } from '@/utils/invitation-url-parser'
import type Model from '@/model/Model'

type InvitationAcceptanceProps = {
  model: Model
  invitationUrl: string
  onComplete: (success: boolean) => void
}

export function InvitationAcceptance(props: InvitationAcceptanceProps) {
  console.log('[InvitationAcceptance] ========== COMPONENT RENDER ==========')
  console.log('[InvitationAcceptance] Invitation URL:', props.invitationUrl)

  const [status, setStatus] = useState<'pending' | 'accepting' | 'success' | 'error'>('pending')
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<InvitationMode | undefined>(undefined)
  const [retryCount, setRetryCount] = useState(0)

  // Mount/unmount tracking
  useEffect(() => {
    console.log('[InvitationAcceptance] ========== COMPONENT MOUNTED ==========')
    return () => {
      console.log('[InvitationAcceptance] ========== COMPONENT UNMOUNTING ==========')
      console.log('[InvitationAcceptance] ⚠️ If this happens unexpectedly, it indicates a restart')
    }
  }, [])

  // Parse invitation on mount
  useEffect(() => {
    console.log('[InvitationAcceptance] Parsing invitation URL')
    const parsed = parseInvitationUrl(props.invitationUrl)
    if (parsed.error || !parsed.invitation) {
      console.error('[InvitationAcceptance] Failed to parse:', parsed.error)
      setStatus('error')
      setError(parsed.error || 'Invalid invitation URL')
      return
    }
    console.log('[InvitationAcceptance] Parsed mode:', parsed.mode)
    setMode(parsed.mode)
  }, [props.invitationUrl])

  async function handleAccept() {
    console.log('[InvitationAcceptance] ========== ACCEPT BUTTON CLICKED ==========');

    // Log to localStorage to survive page reloads
    const logError = (msg: string, error?: any) => {
      const log = `[${new Date().toISOString()}] ${msg}: ${JSON.stringify(error)}`;
      console.error(log);
      try {
        const existingLogs = localStorage.getItem('invitation-error-log') || '';
        localStorage.setItem('invitation-error-log', existingLogs + '\n' + log);
      } catch (e) {
        // Ignore localStorage errors
      }
    };

    console.log('[InvitationAcceptance] About to call setStatus');
    setStatus('accepting')
    console.log('[InvitationAcceptance] Called setStatus, about to call setError');
    setError(null)
    console.log('[InvitationAcceptance] Called setError, about to log to localStorage');

    logError('handleAccept called', { url: props.invitationUrl });

    const parsed = parseInvitationUrl(props.invitationUrl)
    if (!parsed.invitation) {
      logError('Failed to parse invitation');
      setStatus('error')
      setError('Failed to parse invitation')
      return
    }

    try {
      console.log('[InvitationAcceptance] Accepting invitation:', {
        mode: parsed.mode,
        commServer: parsed.invitation.url
      })
      logError('About to call acceptPairingInvitation');

      // Use IOMHandler to accept invitation (follows one.leute pattern with retry logic)
      const result = await props.model.iomHandler.acceptPairingInvitation({
        invitationUrl: props.invitationUrl
      })

      logError('acceptPairingInvitation returned', result);

      if (result.success) {
        console.log('[InvitationAcceptance] ✅ Invitation accepted successfully')
        console.log('[InvitationAcceptance] 🔍 PERSISTENCE DEBUG: Connection established, checking storage...')
        console.log('[InvitationAcceptance] 🔍 Model initialized:', props.model.initialized)
        console.log('[InvitationAcceptance] 🔍 Owner ID:', props.model.ownerId)

        // Check if IndexedDB has data
        if (typeof indexedDB !== 'undefined' && 'databases' in indexedDB) {
          indexedDB.databases().then(dbs => {
            console.log('[InvitationAcceptance] 🔍 IndexedDB databases:', dbs.map(db => db.name))
          }).catch(err => {
            console.error('[InvitationAcceptance] Failed to list databases:', err)
          })
        }

        setStatus('success')
        console.log('[InvitationAcceptance] 🔍 Completing in 2 seconds...')
        logError('About to call onComplete in 2 seconds');
        setTimeout(() => {
          console.log('[InvitationAcceptance] 🔍 Calling onComplete(true) - this should NOT cause a page reload')
          logError('Calling onComplete(true)');
          props.onComplete(true)
        }, 2000)
      } else {
        console.error('[InvitationAcceptance] ❌ Failed to accept invitation:', result.error)
        logError('Invitation acceptance failed', result.error);
        setStatus('error')
        setError(result.error || 'Failed to accept invitation')
      }
    } catch (err) {
      console.error('[InvitationAcceptance] Exception during acceptance:', err)
      logError('EXCEPTION in handleAccept', {
        message: err instanceof Error ? err.message : 'Unknown',
        stack: err instanceof Error ? err.stack : undefined
      });
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  function handleDecline() {
    console.log('[InvitationAcceptance] User declined invitation')
    props.onComplete(false)
  }

  function handleRetry() {
    setRetryCount(retryCount + 1)
    handleAccept()
  }

  // Determine icon and labels based on mode
  const Icon = mode === 'IoM' ? Smartphone : UserPlus
  const modeLabel = mode === 'IoM' ? 'Device Pairing' : 'Partner Connection'
  const modeDescription = mode === 'IoM'
    ? 'Connect this device to sync your data'
    : 'Connect with another person to start chatting'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon className="h-6 w-6 text-blue-600" />
            <CardTitle>{modeLabel}</CardTitle>
          </div>
          <CardDescription>{modeDescription}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {status === 'pending' && (
            <Alert>
              <AlertDescription>
                You've received an invitation to connect. Click accept to proceed.
              </AlertDescription>
            </Alert>
          )}

          {status === 'accepting' && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              <AlertDescription>
                Connecting... {retryCount > 0 && `(Attempt ${retryCount + 1})`}
              </AlertDescription>
            </Alert>
          )}

          {status === 'success' && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600 inline mr-2" />
              <AlertDescription className="text-green-800">
                Successfully connected! Redirecting...
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600 inline mr-2" />
              <AlertDescription className="text-red-800">
                {error || 'Failed to accept invitation'}
              </AlertDescription>
            </Alert>
          )}

          {mode && (
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Mode:</strong> {modeLabel}</p>
              <p className="text-xs text-gray-500">
                {mode === 'IoM'
                  ? 'Your devices will be synchronized'
                  : 'You will be able to send messages to each other'}
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex gap-2">
          {status === 'pending' && (
            <>
              <Button type="button" variant="outline" onClick={handleDecline} className="flex-1">
                Decline
              </Button>
              <Button type="button" onClick={handleAccept} className="flex-1">
                Accept Invitation
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <Button variant="outline" onClick={handleDecline} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleRetry} className="flex-1">
                Try Again
              </Button>
            </>
          )}

          {(status === 'accepting' || status === 'success') && (
            <Button disabled className="w-full">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Please wait...
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
