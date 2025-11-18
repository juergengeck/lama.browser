/**
 * Node.js UI Callbacks for connection.core
 *
 * Minimal implementation for test environment (no UI)
 */

export class NodeUICallbacks {
  async requestPairingApproval(request) {
    // Auto-approve all pairing requests in test environment
    console.log(`[NodeUI] Auto-approving pairing request from ${request.peerId.substring(0, 8)}`);
    return true;
  }

  async showError(error) {
    console.error('[NodeUI] Error:', error.message);
  }

  async notify(message) {
    console.log('[NodeUI] Notification:', message);
  }
}
