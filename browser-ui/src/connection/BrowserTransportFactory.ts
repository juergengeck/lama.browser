/**
 * Browser Transport Factory for connection.core
 *
 * Creates WebSocket transports for browser platform.
 * QUIC is not available in browsers (requires native implementation).
 */

import type { TransportFactory, Transport } from '@lama/connection.core';
import { BrowserWebSocketTransport } from './BrowserWebSocketTransport.js';

export class BrowserTransportFactory implements TransportFactory {
  create(type: 'quicvc' | 'websocket'): Transport {
    if (type === 'websocket') {
      return new BrowserWebSocketTransport();
    }

    throw new Error(`Transport type '${type}' not supported in browser. Only 'websocket' is available.`);
  }

  getSupportedTransports(): ('quicvc' | 'websocket')[] {
    // Browser only supports WebSocket
    return ['websocket'];
  }
}
