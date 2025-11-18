/**
 * NodeUdpTransport - Node.js/Electron UDP transport implementation
 *
 * Provides UDP socket functionality for Node.js and Electron environments
 * using the built-in dgram module. Implements IQuicTransport interface
 * from connection.discovery.
 */

import dgram from 'dgram';
import { EventEmitter } from 'events';
import type {
  IQuicTransport,
  QuicTransportOptions,
  TransportStats,
  UdpRemoteInfo
} from '@lama/connection.discovery';
import Debug from 'debug';

const debug = Debug('lama:udp:node');

export class NodeUdpTransport extends EventEmitter implements IQuicTransport {
  private socket: dgram.Socket | null = null;
  private services: Map<number, (data: any, rinfo: UdpRemoteInfo) => void> = new Map();
  private _initialized = false;
  private options?: QuicTransportOptions;

  private _stats: TransportStats = {
    packetsReceived: 0,
    packetsSent: 0,
    bytesReceived: 0,
    bytesSent: 0,
    errors: 0
  };

  constructor(options?: QuicTransportOptions) {
    super();
    this.options = options;
    debug('NodeUdpTransport created with options:', options);
  }

  async init(options?: QuicTransportOptions): Promise<void> {
    if (this._initialized && this.socket) {
      debug('NodeUdpTransport already initialized');
      return;
    }

    try {
      // Merge options
      this.options = { ...this.options, ...options };

      // Create UDP4 socket
      debug('Creating UDP4 socket...');
      this.socket = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true
      });

      // Set up event handlers
      this.socket.on('message', (msg: Buffer, rinfo: dgram.RemoteInfo) => {
        this.handleMessage(msg, rinfo);
      });

      this.socket.on('error', (err: Error) => {
        debug('Socket error:', err);
        this._stats.errors++;
        this.emit('error', err);
      });

      this.socket.on('close', () => {
        debug('Socket closed');
        this._initialized = false;
        this.emit('close');
      });

      // Bind to port if specified
      if (this.options?.port) {
        await new Promise<void>((resolve, reject) => {
          const host = this.options?.host || '0.0.0.0';
          debug(`Binding to ${host}:${this.options!.port}...`);

          this.socket!.bind(this.options!.port, host, () => {
            debug(`Socket bound to port ${this.options!.port}`);

            // Enable broadcast if needed
            try {
              this.socket!.setBroadcast(true);
              debug('Broadcast enabled');
            } catch (err) {
              debug('Failed to enable broadcast:', err);
            }

            resolve();
          });

          this.socket!.once('error', reject);
        });
      }

      this._initialized = true;
      debug('NodeUdpTransport initialized successfully');
      this.emit('ready');

    } catch (error) {
      debug('NodeUdpTransport initialization failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Alias for init() to maintain compatibility with IQuicTransport interface
   */
  async listen(options?: QuicTransportOptions): Promise<void> {
    return this.init(options);
  }

  private handleMessage(data: Buffer, rinfo: dgram.RemoteInfo): void {
    try {
      this._stats.packetsReceived++;
      this._stats.bytesReceived += data.length;

      const udpRinfo: UdpRemoteInfo = {
        address: rinfo.address,
        port: rinfo.port,
        family: rinfo.family,
        size: rinfo.size
      };

      // Check if message has service type byte prefix
      if (data.length > 0) {
        const firstByte = data[0]!;

        // Check for QUICVC long header packet (bit 7 = 1)
        const isLongHeader = (firstByte & 0x80) !== 0;
        if (isLongHeader && data.length > 20) {
          debug(`Detected QUICVC packet from ${rinfo.address}:${rinfo.port}`);
          this.emit('message', data, udpRinfo);
          return;
        }

        // Check for service-prefixed message
        const serviceType = firstByte;
        if (this.services.has(serviceType)) {
          debug(`Received service message type ${serviceType} from ${rinfo.address}:${rinfo.port}`);

          // Strip service byte and pass payload to handler
          const payload = data.slice(1);
          const handler = this.services.get(serviceType);
          if (handler) {
            try {
              handler(payload, udpRinfo);
            } catch (err) {
              debug(`Handler for service type ${serviceType} threw:`, err);
            }
          }

          // Also emit raw message event
          this.emit('message', data, udpRinfo);
          return;
        }
      }

      // Try to parse as JSON
      try {
        const message = JSON.parse(data.toString());
        const serviceType = message.serviceType || message.type || 0;
        debug(`Received JSON message from ${rinfo.address}:${rinfo.port}, service: ${serviceType}`);

        const handler = this.services.get(serviceType);
        if (handler) {
          handler(message.data || message, udpRinfo);
        }
      } catch {
        // Not JSON, emit as raw message
        debug(`Received non-JSON message from ${rinfo.address}:${rinfo.port}`);
        this.emit('message', data, udpRinfo);
      }

    } catch (error) {
      debug('Error handling message:', error);
      this._stats.errors++;
      this.emit('error', error);
    }
  }

  async send(data: Uint8Array | string, address: string, port: number): Promise<void> {
    if (!this._initialized || !this.socket) {
      throw new Error('NodeUdpTransport not initialized');
    }

    try {
      const buffer = typeof data === 'string'
        ? Buffer.from(data, 'utf8')
        : Buffer.from(data);

      await new Promise<void>((resolve, reject) => {
        this.socket!.send(buffer, port, address, (err) => {
          if (err) {
            debug('Send error:', err);
            this._stats.errors++;
            reject(err);
          } else {
            this._stats.packetsSent++;
            this._stats.bytesSent += buffer.length;
            resolve();
          }
        });
      });

      debug(`Sent ${buffer.length} bytes to ${address}:${port}`);

    } catch (error) {
      debug('Error sending message:', error);
      throw error;
    }
  }

  addService(serviceType: number, handler: (data: any, rinfo: UdpRemoteInfo) => void): void {
    this.services.set(serviceType, handler);
    debug(`Added service handler for type: ${serviceType}`);
  }

  removeService(serviceType: number): void {
    this.services.delete(serviceType);
    debug(`Removed service handler for type: ${serviceType}`);
  }

  clearServices(): void {
    this.services.clear();
    debug('Cleared all service handlers');
  }

  async getInfo(): Promise<{ port: number; host: string } | null> {
    if (!this.socket) {
      return null;
    }

    try {
      const address = this.socket.address() as {address: string; port: number; family: string};
      return {
        port: address.port,
        host: address.address
      };
    } catch (error) {
      debug('Error getting socket info:', error);
      return {
        port: this.options?.port || 0,
        host: this.options?.host || '0.0.0.0'
      };
    }
  }

  async close(): Promise<void> {
    debug('Closing NodeUdpTransport...');

    if (this.socket) {
      await new Promise<void>((resolve) => {
        this.socket!.close(() => {
          resolve();
        });
      });
      this.socket = null;
    }

    this.services.clear();
    this._initialized = false;
    debug('NodeUdpTransport closed');
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  get stats(): TransportStats {
    return { ...this._stats };
  }

  async runDiagnostics(): Promise<string> {
    const isInit = this.isInitialized();
    const hasSocket = !!this.socket;
    const serviceCount = this.services.size;

    return `NodeUdpTransport Diagnostics:
- Initialized: ${isInit}
- Socket: ${hasSocket ? 'Active' : 'None'}
- Services: ${serviceCount}
- Stats: ${JSON.stringify(this.stats, null, 2)}`;
  }

  get socketId(): string | undefined {
    return this.socket ? `node-udp-${this.options?.port || 'dynamic'}` : undefined;
  }
}
