/**
 * Node.js Transport Factory for connection.core
 *
 * Minimal implementation for test environment
 */

export class NodeTransportFactory {
  constructor(connectionsModel) {
    this.connectionsModel = connectionsModel;
  }

  getSupportedTransports() {
    return ['websocket']; // For now, just websocket via commserver
  }

  create(transportType) {
    if (transportType !== 'websocket') {
      throw new Error(`Unsupported transport type: ${transportType}`);
    }

    // Return a minimal transport wrapper around ConnectionsModel
    return new NodeTransport(this.connectionsModel);
  }
}

class NodeTransport {
  constructor(connectionsModel) {
    this.connectionsModel = connectionsModel;
    this.state = 'disconnected';
    this.callbacks = {
      onStateChange: null,
      onData: null,
      onError: null
    };
  }

  async connect(address) {
    // For test environment, we don't need actual connection
    // The ConnectionsModel handles the real connection logic
    this.state = 'connected';
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange('connected');
    }
  }

  async send(data) {
    // In real implementation, this would send via the transport
    // For now, this is handled by ConnectionsModel's pairing logic
  }

  close() {
    this.state = 'disconnected';
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange('disconnected');
    }
  }

  getState() {
    return this.state;
  }

  onStateChange(callback) {
    this.callbacks.onStateChange = callback;
  }

  onData(callback) {
    this.callbacks.onData = callback;
  }

  onError(callback) {
    this.callbacks.onError = callback;
  }
}
