/**
 * Sync Progress Indicator
 *
 * Displays sync progress when syncing messages and data with peers.
 * Shows detailed progress for large sync operations.
 */

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, CheckCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface SyncProgressInfo {
  active: boolean
  total: number
  completed: number
  current?: string
  errors: number
}

export function SyncProgress() {
  const [progress, setProgress] = useState<SyncProgressInfo>({
    active: false,
    total: 0,
    completed: 0,
    errors: 0
  })

  useEffect(() => {
    // Check sync progress periodically
    const checkProgress = async () => {
      try {
        // TODO: Implement sync progress tracking via Model handlers
        // Placeholder - no active sync
        setProgress({
          active: false,
          total: 0,
          completed: 0,
          errors: 0
        })
      } catch (error) {
        console.error('[SyncProgress] Failed to get progress:', error)
      }
    }

    checkProgress()

    // Poll every 1 second when syncing
    const interval = setInterval(checkProgress, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleCancel = async () => {
    try {
      // TODO: Implement sync cancellation via Model handlers
      console.log('[SyncProgress] Sync cancelled')
    } catch (error) {
      console.error('[SyncProgress] Failed to cancel sync:', error)
    }
  }

  // Don't render if no active sync
  if (!progress.active) {
    return null
  }

  const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0
  const isComplete = progress.completed === progress.total

  return (
    <Card className="fixed bottom-4 left-4 z-50 w-96 shadow-lg">
      <CardContent className="pt-6 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isComplete ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
            )}
            <span className="font-medium">
              {isComplete ? 'Sync Complete' : 'Syncing Data'}
            </span>
          </div>

          {!isComplete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={percentage} className="h-2" />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {progress.completed} / {progress.total} items
            </span>
            <span>{percentage.toFixed(0)}%</span>
          </div>
        </div>

        {/* Current Item */}
        {progress.current && !isComplete && (
          <p className="text-xs text-muted-foreground truncate">
            Syncing: {progress.current}
          </p>
        )}

        {/* Status Badges */}
        <div className="flex items-center space-x-2">
          {progress.errors > 0 && (
            <Badge variant="destructive" className="text-xs">
              {progress.errors} errors
            </Badge>
          )}

          {isComplete && progress.errors === 0 && (
            <Badge variant="default" className="text-xs">
              Success
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
