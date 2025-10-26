/**
 * Connection Setup for Browser Platform
 *
 * Example of how to instantiate ConnectionManager with browser-specific
 * implementations of platform dependencies.
 *
 * This demonstrates the integration pattern that all platforms should follow.
 */

import { ConnectionManager } from '@lama/connection.core';
import type { PlatformDependencies } from '@lama/connection.core';
import { BrowserTransportFactory } from './BrowserTransportFactory';
import { BrowserIndexedDBStorage } from './BrowserStorage';
import { BrowserUICallbacks } from './BrowserUICallbacks';

/**
 * Create and initialize ConnectionManager for browser platform
 *
 * @returns Initialized ConnectionManager instance
 *
 * @example
 * ```typescript
 * // In your app initialization
 * const connectionManager = await setupBrowserConnectionManager();
 *
 * // Discover peers
 * const peers = await connectionManager.discoverPeers();
 *
 * // Connect to peer
 * const connection = await connectionManager.connect(peers[0].id);
 *
 * // Send data
 * const message = new TextEncoder().encode('Hello!');
 * await connection.send(message);
 * ```
 */
export async function setupBrowserConnectionManager(): Promise<ConnectionManager> {
  // Create platform-specific dependency implementations
  const deps: PlatformDependencies = {
    transport: new BrowserTransportFactory(),
    storage: new BrowserIndexedDBStorage(),
    ui: new BrowserUICallbacks(),
  };

  // Instantiate ConnectionManager with dependencies
  const connectionManager = new ConnectionManager(deps);

  // Initialize
  await connectionManager.initialize();

  // Setup event listeners (optional - platforms can customize)
  connectionManager.on('initialized', () => {
    console.log('[ConnectionManager] Initialized');
  });

  connectionManager.on('connectionEstablished', (connection) => {
    console.log('[ConnectionManager] Connection established:', connection);
  });

  connectionManager.on('connectionClosed', (peerId) => {
    console.log('[ConnectionManager] Connection closed:', peerId);
  });

  connectionManager.on('error', (error) => {
    console.error('[ConnectionManager] Error:', error);
  });

  return connectionManager;
}

/**
 * Singleton instance (optional pattern)
 *
 * Platforms may choose to export a singleton instance if they want
 * a single global ConnectionManager throughout the application.
 */
let browserConnectionManagerInstance: ConnectionManager | null = null;

export async function getBrowserConnectionManager(): Promise<ConnectionManager> {
  if (!browserConnectionManagerInstance) {
    browserConnectionManagerInstance = await setupBrowserConnectionManager();
  }
  return browserConnectionManagerInstance;
}
