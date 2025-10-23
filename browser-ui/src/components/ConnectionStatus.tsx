/**
 * Connection Status Indicator
 *
 * Displays current connection status to commserver and sync state.
 * Shows visual feedback for connected/disconnected/syncing states.
 */

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'syncing'

export function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionState>('disconnected')
  const [queueSize, setQueueSize] = useState(0)
  const [reconnecting, setReconnecting] = useState(false)

  useEffect(() => {
    // Check connection status periodically
    const checkStatus = async () => {
      try {
        // TODO: Implement connection status check via model.connections
        // Placeholder - assume disconnected
        setStatus('disconnected')
      } catch (error) {
        console.error('[ConnectionStatus] Failed to get status:', error)
        setStatus('error')
      }
    }

    checkStatus()

    // Poll every 10 seconds
    const interval = setInterval(checkStatus, 10000)

    return () => clearInterval(interval)
  }, [])

  const handleReconnect = async () => {
    setReconnecting(true)
    try {
      // TODO: Implement reconnect via model.connections
      console.log('[ConnectionStatus] Reconnect requested')

      // Simulate reconnect
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setStatus('connected')
    } catch (error) {
      console.error('[ConnectionStatus] Reconnect failed:', error)
      setStatus('error')
    } finally {
      setReconnecting(false)
    }
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: <Wifi className="h-3 w-3" />,
          text: 'Connected',
          variant: 'default' as const,
          color: 'bg-green-500'
        }
      case 'connecting':
        return {
          icon: <RefreshCw className="h-3 w-3 animate-spin" />,
          text: 'Connecting...',
          variant: 'secondary' as const,
          color: 'bg-blue-500'
        }
      case 'syncing':
        return {
          icon: <RefreshCw className="h-3 w-3 animate-spin" />,
          text: 'Syncing...',
          variant: 'secondary' as const,
          color: 'bg-blue-500'
        }
      case 'disconnected':
        return {
          icon: <WifiOff className="h-3 w-3" />,
          text: 'Offline',
          variant: 'outline' as const,
          color: 'bg-gray-500'
        }
      case 'error':
        return {
          icon: <AlertTriangle className="h-3 w-3" />,
          text: 'Connection Error',
          variant: 'destructive' as const,
          color: 'bg-red-500'
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className="flex items-center space-x-2">
      <Badge variant={config.variant} className="flex items-center space-x-1">
        {config.icon}
        <span className="text-xs">{config.text}</span>
      </Badge>

      {queueSize > 0 && (
        <Badge variant="secondary" className="text-xs">
          {queueSize} queued
        </Badge>
      )}

      {(status === 'disconnected' || status === 'error') && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReconnect}
          disabled={reconnecting}
          className="h-6 px-2"
        >
          {reconnecting ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            'Reconnect'
          )}
        </Button>
      )}

      {/* Visual indicator dot */}
      <div
        className={`h-2 w-2 rounded-full ${config.color} ${
          status === 'connected' ? 'animate-pulse' : ''
        }`}
      />
    </div>
  )
}
