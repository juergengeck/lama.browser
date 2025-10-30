/**
 * Browser WebSocket Transport Implementation
 *
 * Wraps browser native WebSocket for connection.core
 */

import type { Transport, TransportState } from '@lama/connection.core';

export class BrowserWebSocketTransport implements Transport {
  readonly type = 'websocket' as const;
  private ws: WebSocket | null = null;
  private state: TransportState = 'disconnected';
  private receiveCallback: ((data: Uint8Array) => void) | null = null;
  private stateChangeCallback: ((state: TransportState) => void) | null = null;

  async connect(address: string): Promise<void> {
    if (this.ws) {
      throw new Error('Transport already connected');
    }

    this.state = 'connecting';
    this.notifyStateChange();

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(address);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          this.state = 'connected';
          this.notifyStateChange();
          resolve();
        };

        this.ws.onerror = (error) => {
          this.state = 'disconnected';
          this.notifyStateChange();
          reject(new Error(`WebSocket error: ${error}`));
        };

        this.ws.onclose = () => {
          this.state = 'disconnected';
          this.notifyStateChange();
        };

        this.ws.onmessage = (event) => {
          if (this.receiveCallback && event.data instanceof ArrayBuffer) {
            this.receiveCallback(new Uint8Array(event.data));
          }
        };
      } catch (error) {
        this.state = 'disconnected';
        this.notifyStateChange();
        reject(error);
      }
    });
  }

  async send(data: Uint8Array): Promise<void> {
    if (!this.ws || this.state !== 'connected') {
      throw new Error('Transport not connected');
    }

    this.ws.send(data);
  }

  onReceive(callback: (data: Uint8Array) => void): void {
    this.receiveCallback = callback;
  }

  onStateChange(callback: (state: TransportState) => void): void {
    this.stateChangeCallback = callback;
  }

  close(): void {
    if (this.ws) {
      this.state = 'disconnecting';
      this.notifyStateChange();
      this.ws.close();
      this.ws = null;
    }
  }

  getState(): TransportState {
    return this.state;
  }

  private notifyStateChange(): void {
    if (this.stateChangeCallback) {
      this.stateChangeCallback(this.state);
    }
  }
}
