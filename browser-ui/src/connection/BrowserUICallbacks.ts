/**
 * Browser UI Callbacks for connection.core
 *
 * Handles user interactions via browser UI (alerts, prompts, notifications).
 */

import type { UICallbacks, PairingRequestUI, ErrorUI, ConnectionStateValue, PairingMethod } from '@lama/connection.core';

export class BrowserUICallbacks implements UICallbacks {
  async onPairingRequest(request: PairingRequestUI): Promise<boolean> {
    // Browser implementation: show a browser confirmation dialog
    const message = `Pairing request from ${request.peerName} (${request.peerId.substring(0, 8)})\n\n` +
      `Method: ${request.method}\n` +
      (request.verificationCode ? `Verification code: ${request.verificationCode}` : '');

    return confirm(message);
  }

  onError(error: ErrorUI): void {
    // Browser implementation: console error + optional alert for critical errors
    console.error(`[ConnectionManager Error] ${error.code}: ${error.message}`, error.context);

    // For critical errors, show alert
    if (error.code.includes('PAIRING') || error.code.includes('GROUP')) {
      alert(`Error: ${error.message}`);
    }
  }

  onConnectionStateChange(peerId: string, state: ConnectionStateValue): void {
    // Browser implementation: log to console
    // Could also update UI state, show notifications, etc.
    console.log(`[ConnectionManager] Peer ${peerId.substring(0, 8)} state changed: ${state}`);
  }

  async selectPairingMethod(methods: PairingMethod[]): Promise<PairingMethod | null> {
    // Browser implementation: show prompt to select method
    const message = 'Select pairing method:\n' +
      methods.map((m, i) => `${i + 1}. ${m}`).join('\n');

    const selection = prompt(message);
    if (!selection) {
      return null; // User cancelled
    }

    const index = parseInt(selection, 10) - 1;
    if (index >= 0 && index < methods.length) {
      return methods[index];
    }

    return null; // Invalid selection
  }
}
