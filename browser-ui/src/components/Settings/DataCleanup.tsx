/**
 * Data Cleanup Component
 *
 * Allows users to clean up old data to free storage space.
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, RefreshCw } from 'lucide-react'

interface CleanupResult {
  success: boolean
  freedBytes: number
  itemsDeleted: number
  details: {
    oldMessages: number
    orphanedAttachments: number
    cachedData: number
  }
}

export function DataCleanup() {
  const [cleaning, setCleaning] = useState(false)
  const [dryRunning, setDryRunning] = useState(false)
  const [lastCleanup, setLastCleanup] = useState<CleanupResult | null>(null)

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const runCleanup = async (dryRun: boolean = false) => {
    try {
      if (dryRun) {
        setDryRunning(true)
      } else {
        setCleaning(true)
      }

      // TODO: Implement proper cleanup via ONE.core storage APIs
      // For now, provide a stub implementation
      const result: CleanupResult = {
        success: true,
        freedBytes: 0,
        itemsDeleted: 0,
        details: {
          oldMessages: 0,
          orphanedAttachments: 0,
          cachedData: 0
        }
      }

      setLastCleanup(result)

      if (!dryRun && result.success) {
        alert(`Cleanup successful!\n\nFreed: ${formatBytes(result.freedBytes)}\nItems deleted: ${result.itemsDeleted}\n\nNote: Full cleanup functionality coming soon.`)
      } else if (dryRun) {
        alert(`Dry run complete. Would free: ${formatBytes(result.freedBytes)}\n\nNote: Full cleanup functionality coming soon.`)
      }
    } catch (error) {
      console.error('[DataCleanup] Cleanup failed:', error)
      alert('Cleanup failed. Please try again.')
    } finally {
      setCleaning(false)
      setDryRunning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Trash2 className="h-5 w-5" />
          <span>Data Cleanup</span>
        </CardTitle>
        <CardDescription>
          Remove old data to free up storage space
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cleanup Actions */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cleanup will remove:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Old messages beyond retention period</li>
            <li>Orphaned attachments</li>
            <li>Cached data</li>
            <li>Old version history</li>
          </ul>
        </div>

        {/* Last Cleanup Results */}
        {lastCleanup && (
          <div className="space-y-2 p-3 bg-muted rounded-md">
            <h4 className="text-sm font-medium">Last Cleanup Results</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Freed:</span>
                <span className="ml-2 font-medium">{formatBytes(lastCleanup.freedBytes)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Items:</span>
                <span className="ml-2 font-medium">{lastCleanup.itemsDeleted}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Messages:</span>
                <span className="ml-2 font-medium">{lastCleanup.details.oldMessages}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Attachments:</span>
                <span className="ml-2 font-medium">{lastCleanup.details.orphanedAttachments}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => runCleanup(true)}
            disabled={dryRunning || cleaning}
            className="flex-1"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {dryRunning ? 'Analyzing...' : 'Preview Cleanup'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => runCleanup(false)}
            disabled={cleaning || dryRunning}
            className="flex-1"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {cleaning ? 'Cleaning...' : 'Run Cleanup'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> Cleanup is permanent and cannot be undone.
          Use "Preview Cleanup" to see what will be removed first.
        </p>
      </CardContent>
    </Card>
  )
}
