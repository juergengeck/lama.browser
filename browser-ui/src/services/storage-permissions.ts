/**
 * Storage Permissions Service
 *
 * Handles persistent storage permission requests and status checks.
 * Uses browser's native StorageManager API directly (no worker needed).
 */

export class StoragePermissionsService {
  /**
   * Check if persistent storage is already granted
   */
  async isPersistent(): Promise<boolean> {
    try {
      if (!navigator.storage || !navigator.storage.persisted) {
        console.warn('[StoragePermissions] StorageManager API not available')
        return false
      }

      return await navigator.storage.persisted()
    } catch (error) {
      console.error('[StoragePermissions] Failed to check persistent status:', error)
      return false
    }
  }

  /**
   * Request persistent storage permission
   */
  async requestPersistent(): Promise<{ granted: boolean; message: string }> {
    try {
      if (!navigator.storage || !navigator.storage.persist) {
        return {
          granted: false,
          message: 'Persistent storage not supported in this browser.'
        }
      }

      const granted = await navigator.storage.persist()

      if (granted) {
        return {
          granted: true,
          message: 'Persistent storage granted!'
        }
      } else {
        return {
          granted: false,
          message: 'Browser denied persistent storage. Your data may be cleared when storage is low.'
        }
      }
    } catch (error) {
      console.error('[StoragePermissions] Failed to request persistent storage:', error)
      return {
        granted: false,
        message: 'Failed to request persistent storage. Please try again.'
      }
    }
  }

  /**
   * Get storage quota information
   */
  async getQuota(): Promise<{ usage: number; quota: number; persistent: boolean }> {
    try {
      const [estimate, isPersistent] = await Promise.all([
        navigator.storage?.estimate() || Promise.resolve({ usage: 0, quota: 0 }),
        this.isPersistent()
      ])

      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        persistent: isPersistent
      }
    } catch (error) {
      console.error('[StoragePermissions] Failed to get quota:', error)
      return {
        usage: 0,
        quota: 0,
        persistent: false
      }
    }
  }

  /**
   * Show persistent storage request dialog
   */
  async showRequestDialog(): Promise<boolean> {
    const isPersistent = await this.isPersistent()

    if (isPersistent) {
      console.log('[StoragePermissions] Persistent storage already granted')
      return true
    }

    const confirmed = confirm(
      'LAMA would like to store data persistently.\n\n' +
      'This ensures your conversations and settings are not cleared ' +
      'when storage is low.\n\n' +
      'Allow persistent storage?'
    )

    if (!confirmed) {
      return false
    }

    const result = await this.requestPersistent()

    if (result.granted) {
      alert('Persistent storage granted! Your data is now protected.')
      return true
    } else {
      alert(result.message)
      return false
    }
  }

  /**
   * Auto-request persistent storage on first use
   */
  async autoRequestOnFirstUse(): Promise<void> {
    const hasAsked = localStorage.getItem('storage-permission-asked')

    if (hasAsked) {
      return // Already asked
    }

    // Mark as asked
    localStorage.setItem('storage-permission-asked', 'true')

    // Wait a bit before showing dialog (don't interrupt initialization)
    setTimeout(() => {
      this.showRequestDialog()
    }, 3000)
  }
}

// Export singleton instance
export const storagePermissions = new StoragePermissionsService()
