/**
 * BrowserTransportFactory - Transport factory for browser platform
 *
 * Creates WebSocket transports for browser environment.
 */

import type { TransportFactory, Transport } from '@refinio/connection.core';
import { BrowserWebSocketTransport } from './BrowserTransport';

export class BrowserTransportFactory implements TransportFactory {
  create(type: 'quicvc' | 'websocket'): Transport {
    if (type === 'websocket') {
      return new BrowserWebSocketTransport();
    }

    // QUIC not supported in browser yet
    throw new Error(`Transport type '${type}' not supported on browser platform. Only 'websocket' is available.`);
  }

  getSupportedTransports(): ('quicvc' | 'websocket')[] {
    return ['websocket'];
  }
}
