/**
 * DiscoveryService - Simple, fast device discovery
 *
 * This is a simplified standalone version that wraps DiscoveryProtocol
 * with a simpler API. For integration with NetworkCoordinator,
 * use the DiscoveryProtocol directly.
 */

import { DiscoveryProtocol } from './DiscoveryProtocol.js';
import { IQuicTransport, Device, DiscoveryConfig } from './types.js';
import { EventEmitter } from 'events';

interface DiscoveryServiceConfig {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  capabilities: string[];
  version?: string;
  broadcastInterval?: number;
  deviceTimeout?: number;
  discoveryPort?: number;
  broadcastAddress?: string;
}

/**
 * DiscoveryService provides a simpler API on top of DiscoveryProtocol
 */
export class DiscoveryService extends EventEmitter {
  private protocol: DiscoveryProtocol;
  private config: DiscoveryServiceConfig;
  private started: boolean = false;

  constructor(transport: IQuicTransport, config: DiscoveryServiceConfig) {
    super();

    this.config = {
      version: '1.0.0',
      broadcastInterval: 5000,
      deviceTimeout: 30000,
      discoveryPort: 49497,
      broadcastAddress: '255.255.255.255',
      ...config
    };

    // Create the underlying discovery protocol
    const protocolConfig: Partial<DiscoveryConfig> = {
      deviceId: this.config.deviceId,
      deviceName: this.config.deviceName,
      deviceType: this.config.deviceType,
      capabilities: this.config.capabilities,
      version: this.config.version,
      discoveryPort: this.config.discoveryPort,
      discoveryInterval: this.config.broadcastInterval,
      maxAge: this.config.deviceTimeout,
      broadcastAddress: this.config.broadcastAddress
    };

    this.protocol = new DiscoveryProtocol(protocolConfig, transport);

    // Forward events from protocol to service
    this.setupEventForwarding();
  }

  /**
   * Set up event forwarding from protocol to service
   */
  private setupEventForwarding(): void {
    this.protocol.onDeviceDiscovered.listen((device: Device) => {
      this.emit('deviceDiscovered', device);
    });

    this.protocol.onDeviceUpdated.listen((device: Device) => {
      this.emit('deviceUpdated', device);
    });

    this.protocol.onDeviceLost.listen((deviceId: string) => {
      this.emit('deviceLost', deviceId);
    });

    this.protocol.onError.listen((error: Error) => {
      this.emit('error', error);
    });
  }

  /**
   * Initialize and start discovery
   */
  async start(): Promise<void> {
    if (this.started) {
      console.log('[DiscoveryService] Already started');
      return;
    }

    console.log('[DiscoveryService] Starting discovery...');

    try {
      // Initialize the protocol
      const initialized = await this.protocol.init();
      if (!initialized) {
        throw new Error('Failed to initialize discovery protocol');
      }

      // Start discovery
      await this.protocol.startDiscovery();

      this.started = true;
      this.emit('started');

      console.log('[DiscoveryService] Discovery started successfully');
    } catch (error) {
      console.error('[DiscoveryService] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop discovery
   */
  async stop(): Promise<void> {
    if (!this.started) {
      console.log('[DiscoveryService] Not started');
      return;
    }

    console.log('[DiscoveryService] Stopping discovery...');

    try {
      await this.protocol.stopDiscovery();
      this.started = false;
      this.emit('stopped');

      console.log('[DiscoveryService] Discovery stopped successfully');
    } catch (error) {
      console.error('[DiscoveryService] Error stopping:', error);
      throw error;
    }
  }

  /**
   * Shutdown the service completely
   */
  async shutdown(): Promise<void> {
    console.log('[DiscoveryService] Shutting down...');

    try {
      await this.protocol.shutdown();
      this.started = false;
      this.removeAllListeners();

      console.log('[DiscoveryService] Shutdown complete');
    } catch (error) {
      console.error('[DiscoveryService] Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Get all discovered devices
   */
  getDevices(): Device[] {
    return this.protocol.getDevices();
  }

  /**
   * Get a specific device
   */
  getDevice(deviceId: string): Device | undefined {
    return this.protocol.getDevice(deviceId);
  }

  /**
   * Update device ownership (convenience method)
   */
  updateDeviceOwnership(deviceId: string, ownerId: string): void {
    const device = this.protocol.getDevice(deviceId);
    if (device) {
      device.ownerId = ownerId;
      this.emit('deviceUpdated', device);
    }
  }

  /**
   * Check if discovery is currently running
   */
  get isStarted(): boolean {
    return this.started;
  }

  /**
   * Check if discovery is actively discovering
   */
  get isDiscovering(): boolean {
    return this.protocol.isDiscovering;
  }
}
