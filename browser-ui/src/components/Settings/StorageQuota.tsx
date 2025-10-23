/**
 * Storage Quota Component
 *
 * Displays current storage usage, quota, and warnings.
 * Allows user to request persistent storage.
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { HardDrive, AlertTriangle, CheckCircle, Shield } from 'lucide-react'
import { storagePermissions } from '@/services/storage-permissions'

interface StorageState {
  quota: number
  usage: number
  percentage: number
  available: number
  persistent: boolean
  warnings: Array<{
    level: 'info' | 'warning' | 'critical'
    message: string
    threshold: number
    timestamp: number
  }>
}

export function StorageQuota() {
  const [storageState, setStorageState] = useState<StorageState | null>(null)
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    loadStorageState()

    // Refresh every 30 seconds
    const interval = setInterval(loadStorageState, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadStorageState = async () => {
    try {
      const quota = await storagePermissions.getQuota()
      const percentage = quota.quota > 0 ? (quota.usage / quota.quota) * 100 : 0
      const available = quota.quota - quota.usage

      // Generate warnings based on usage
      const warnings: Array<{level: 'info' | 'warning' | 'critical', message: string, threshold: number, timestamp: number}> = []
      if (percentage >= 95) {
        warnings.push({
          level: 'critical',
          message: 'Storage critically low',
          threshold: 95,
          timestamp: Date.now()
        })
      } else if (percentage >= 80) {
        warnings.push({
          level: 'warning',
          message: 'Storage running low',
          threshold: 80,
          timestamp: Date.now()
        })
      }

      setStorageState({
        quota: quota.quota,
        usage: quota.usage,
        percentage,
        available,
        persistent: quota.persistent,
        warnings
      })
    } catch (error) {
      console.error('[StorageQuota] Failed to load storage state:', error)
    } finally {
      setLoading(false)
    }
  }

  const requestPersistent = async () => {
    try {
      setRequesting(true)
      const result = await storagePermissions.requestPersistent()

      if (result.granted) {
        await loadStorageState() // Refresh to show new persistent status
      }

      alert(result.message)
    } catch (error) {
      console.error('[StorageQuota] Failed to request persistent storage:', error)
      alert('Failed to request persistent storage')
    } finally {
      setRequesting(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const getWarningColor = (percentage: number): string => {
    if (percentage >= 95) return 'text-red-600'
    if (percentage >= 80) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 95) return 'bg-red-500'
    if (percentage >= 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <HardDrive className="h-5 w-5" />
            <span>Storage Quota</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Loading storage information...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!storageState) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <HardDrive className="h-5 w-5" />
            <span>Storage Quota</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Storage information not available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <HardDrive className="h-5 w-5" />
          <span>Storage Quota</span>
        </CardTitle>
        <CardDescription>
          Monitor your browser storage usage and manage space
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Storage Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Storage Used</span>
            <span className={`font-medium ${getWarningColor(storageState.percentage)}`}>
              {formatBytes(storageState.usage)} / {formatBytes(storageState.quota)}
              {' '}({storageState.percentage.toFixed(1)}%)
            </span>
          </div>
          <Progress
            value={storageState.percentage}
            className="h-2"
          />
        </div>

        {/* Available Space */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Available</span>
          <span className="font-medium">{formatBytes(storageState.available)}</span>
        </div>

        {/* Persistent Storage Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Persistent Storage</span>
            <Badge variant={storageState.persistent ? 'default' : 'secondary'}>
              {storageState.persistent ? (
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-3 w-3" />
                  <span>Granted</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1">
                  <Shield className="h-3 w-3" />
                  <span>Not Granted</span>
                </div>
              )}
            </Badge>
          </div>

          {!storageState.persistent && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Without persistent storage, your data may be cleared if storage is low.
                Request persistent storage to protect your data.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={requestPersistent}
                disabled={requesting}
                className="w-full"
              >
                {requesting ? 'Requesting...' : 'Request Persistent Storage'}
              </Button>
            </div>
          )}
        </div>

        {/* Warnings */}
        {storageState.warnings.length > 0 && (
          <div className="space-y-2">
            {storageState.warnings.map((warning, index) => (
              <div
                key={index}
                className={`flex items-start space-x-2 p-3 rounded-md ${
                  warning.level === 'critical'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-yellow-50 border border-yellow-200'
                }`}
              >
                <AlertTriangle
                  className={`h-4 w-4 mt-0.5 ${
                    warning.level === 'critical' ? 'text-red-600' : 'text-yellow-600'
                  }`}
                />
                <p
                  className={`text-xs ${
                    warning.level === 'critical' ? 'text-red-700' : 'text-yellow-700'
                  }`}
                >
                  {warning.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
