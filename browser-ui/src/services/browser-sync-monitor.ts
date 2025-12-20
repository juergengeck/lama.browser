/**
 * BrowserSyncMonitor - Tracks CHUM sync activity in lama.browser
 *
 * Monitors object events to track sync statistics:
 * - Objects received (from remote peers via CHUM)
 * - Objects sent (local objects synced to peers)
 * - Pending operations
 * - Failed operations
 */

import type { SyncStats } from '@lama/ui'

/**
 * Singleton sync monitor for browser
 */
class BrowserSyncMonitor {
  private stats: SyncStats = {
    sent: 0,
    received: 0,
    pending: 0,
    failed: 0,
    syncing: false,
    lastSync: undefined
  }

  private listeners: Set<(stats: SyncStats) => void> = new Set()

  /**
   * Record an object received from CHUM sync
   */
  recordReceived(count: number = 1): void {
    this.stats.received += count
    this.stats.lastSync = Date.now()
    this.notifyListeners()
  }

  /**
   * Record an object sent via CHUM sync
   */
  recordSent(count: number = 1): void {
    this.stats.sent += count
    this.stats.lastSync = Date.now()
    this.notifyListeners()
  }

  /**
   * Record a pending sync operation
   */
  recordPending(count: number = 1): void {
    this.stats.pending += count
    this.notifyListeners()
  }

  /**
   * Record completion of pending operations
   */
  recordPendingComplete(count: number = 1): void {
    this.stats.pending = Math.max(0, this.stats.pending - count)
    this.notifyListeners()
  }

  /**
   * Record a failed sync operation
   */
  recordFailed(count: number = 1): void {
    this.stats.failed += count
    this.stats.pending = Math.max(0, this.stats.pending - count)
    this.notifyListeners()
  }

  /**
   * Set syncing state
   */
  setSyncing(syncing: boolean): void {
    this.stats.syncing = syncing
    if (syncing) {
      this.stats.lastSync = Date.now()
    }
    this.notifyListeners()
  }

  /**
   * Get current sync statistics
   */
  getStats(): SyncStats {
    return { ...this.stats }
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.stats = {
      sent: 0,
      received: 0,
      pending: 0,
      failed: 0,
      syncing: false,
      lastSync: undefined
    }
    this.notifyListeners()
  }

  /**
   * Subscribe to stats updates
   */
  subscribe(listener: (stats: SyncStats) => void): () => void {
    this.listeners.add(listener)
    // Immediately notify with current stats
    listener(this.getStats())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    const stats = this.getStats()
    this.listeners.forEach(listener => listener(stats))
  }
}

// Export singleton instance
export const browserSyncMonitor = new BrowserSyncMonitor()

/**
 * Hook up sync monitor to ObjectEventDispatcher
 * Call this after model initialization
 */
export function initSyncMonitor(model: any): void {
  if (!model?.objectEvents) {
    console.warn('[BrowserSyncMonitor] No objectEvents available')
    return
  }

  const objectEvents = model.objectEvents

  // Track received objects (from CHUM sync)
  // Objects with status 'new' that weren't created locally came from sync
  if (objectEvents.onNewVersion) {
    objectEvents.onNewVersion('*', '*', (result: any) => {
      // If object was created remotely (via CHUM), count as received
      if (result.status === 'new') {
        browserSyncMonitor.recordReceived()
      }
    }, '[BrowserSyncMonitor] Track received versioned objects')
  }

  if (objectEvents.onNewUnversioned) {
    objectEvents.onNewUnversioned('*', (result: any) => {
      if (result.status === 'new') {
        browserSyncMonitor.recordReceived()
      }
    }, '[BrowserSyncMonitor] Track received unversioned objects')
  }

  // Track connection state changes
  if (model.connectionsModel) {
    const connections = model.connectionsModel

    // Track when CHUM protocol starts
    if (connections.onProtocolStart) {
      connections.onProtocolStart.addListener((
        _initiatedLocally: boolean,
        _localPersonId: string,
        _localInstanceId: string,
        _remotePersonId: string,
        _remoteInstanceId: string,
        protocol: string
      ) => {
        if (protocol === 'chum') {
          browserSyncMonitor.setSyncing(true)
          console.log('[BrowserSyncMonitor] CHUM sync started')
        }
      })
    }
  }

  console.log('[BrowserSyncMonitor] Initialized')
}
