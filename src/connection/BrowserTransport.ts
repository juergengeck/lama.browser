/**
 * BrowserTransport - WebSocket-based transport for browser platform
 *
 * Example implementation of Transport interface using WebSocket.
 * Demonstrates how platforms should implement transport layer.
 */

import type { Transport, TransportState } from '@lama/connection.core';

export class BrowserWebSocketTransport implements Transport {
  readonly type = 'websocket' as const;

  private ws: WebSocket | null = null;
  private state: TransportState = 'disconnected';
  private receiveCallbacks: ((data: Uint8Array) => void)[] = [];
  private stateCallbacks: ((state: TransportState) => void)[] = [];

  async connect(address: string): Promise<void> {
    this.setState('connecting');

    // Ensure address is a WebSocket URL
    const wsUrl = address.startsWith('ws://') || address.startsWith('wss://')
      ? address
      : `wss://${address}`;

    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';

    return new Promise((resolve, reject) => {
      this.ws!.onopen = () => {
        this.setState('connected');
        resolve();
      };

      this.ws!.onerror = (error) => {
        this.setState('disconnected');
        reject(new Error(`WebSocket connection failed: ${error}`));
      };

      this.ws!.onmessage = (event) => {
        const data = new Uint8Array(event.data as ArrayBuffer);
        this.receiveCallbacks.forEach((callback) => callback(data));
      };

      this.ws!.onclose = () => {
        this.setState('disconnected');
      };
    });
  }

  async send(data: Uint8Array): Promise<void> {
    if (this.state !== 'connected' || !this.ws) {
      throw new Error('Transport not connected');
    }

    this.ws.send(data);
  }

  onReceive(callback: (data: Uint8Array) => void): void {
    this.receiveCallbacks.push(callback);
  }

  onStateChange(callback: (state: TransportState) => void): void {
    this.stateCallbacks.push(callback);
  }

  close(): void {
    if (this.ws) {
      this.setState('disconnecting');
      this.ws.close();
    }
  }

  getState(): TransportState {
    return this.state;
  }

  private setState(newState: TransportState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.stateCallbacks.forEach((callback) => callback(newState));
    }
  }
}
