/**
 * Storage Warning Toast Component
 *
 * Displays toast notifications when storage quota warnings occur.
 * Shows different styles for warning (80%) vs critical (95%) levels.
 */

import { useState, useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, X, HardDrive } from 'lucide-react'
import { storagePermissions } from '@/services/storage-permissions'

interface StorageWarningType {
  level: 'warning' | 'critical'
  message: string
  timestamp: number
  usage: number
  quota: number
}

interface StorageWarningToast {
  id: string
  warning: StorageWarningType
  dismissed: boolean
}

export function StorageWarning() {
  const [toasts, setToasts] = useState<StorageWarningToast[]>([])

  useEffect(() => {
    // Check storage quota every 5 minutes
    const checkQuota = async () => {
      try {
        const quota = await storagePermissions.getQuota()

        // Calculate usage percentage
        const usagePercent = quota.quota > 0 ? (quota.usage / quota.quota) * 100 : 0

        // Generate warning if needed
        let warning: StorageWarningType | null = null

        if (usagePercent >= 95) {
          warning = {
            level: 'critical',
            message: `Storage critically low: ${usagePercent.toFixed(1)}% used (${formatBytes(quota.usage)} of ${formatBytes(quota.quota)}). Please free up space to avoid data loss.`,
            timestamp: Date.now(),
            usage: quota.usage,
            quota: quota.quota
          }
        } else if (usagePercent >= 80) {
          warning = {
            level: 'warning',
            message: `Storage running low: ${usagePercent.toFixed(1)}% used (${formatBytes(quota.usage)} of ${formatBytes(quota.quota)}). Consider freeing up space.`,
            timestamp: Date.now(),
            usage: quota.usage,
            quota: quota.quota
          }
        }

        // If there's a warning, show toast
        if (warning) {
          const id = `${warning.level}-${warning.timestamp}`

          setToasts((prev) => {
            // Don't add if we already have a recent warning of the same level
            const hasRecentWarning = prev.some(
              (t) => t.warning.level === warning!.level && Date.now() - t.warning.timestamp < 5 * 60 * 1000
            )

            if (hasRecentWarning) {
              return prev
            }

            return [...prev, {
              id,
              warning,
              dismissed: false
            }]
          })
        }
      } catch (error) {
        console.error('[StorageWarning] Failed to check quota:', error)
      }
    }

    // Initial check
    checkQuota()

    // Check every 5 minutes
    const interval = setInterval(checkQuota, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const dismissToast = (id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, dismissed: true } : t))
    )

    // Remove from DOM after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 300)
  }

  const dismissAll = () => {
    setToasts((prev) => prev.map((t) => ({ ...t, dismissed: true })))
    setTimeout(() => {
      setToasts([])
    }, 300)
  }

  // Don't render if no active toasts
  const activeToasts = toasts.filter((t) => !t.dismissed)
  if (activeToasts.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {activeToasts.length > 1 && (
        <div className="flex justify-end mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={dismissAll}
            className="text-xs"
          >
            Dismiss All
          </Button>
        </div>
      )}

      {activeToasts.map((toast) => {
        const isCritical = toast.warning.level === 'critical'
        const bgColor = isCritical ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
        const textColor = isCritical ? 'text-red-700' : 'text-yellow-700'
        const iconColor = isCritical ? 'text-red-600' : 'text-yellow-600'

        return (
          <Alert
            key={toast.id}
            className={`${bgColor} border shadow-lg transition-all duration-300 ${
              toast.dismissed ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
            }`}
          >
            <div className="flex items-start space-x-3">
              <AlertTriangle className={`h-5 w-5 mt-0.5 ${iconColor}`} />

              <div className="flex-1 space-y-2">
                <AlertDescription className={`${textColor} text-sm`}>
                  {toast.warning.message}
                </AlertDescription>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Open settings to storage section
                      window.location.hash = '#settings/storage'
                      dismissToast(toast.id)
                    }}
                    className="h-7 text-xs"
                  >
                    <HardDrive className="h-3 w-3 mr-1" />
                    Manage Storage
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissToast(toast.id)}
                    className="h-7 text-xs"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissToast(toast.id)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Alert>
        )
      })}
    </div>
  )
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
