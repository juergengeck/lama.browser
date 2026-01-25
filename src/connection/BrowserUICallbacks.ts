/**
 * BrowserUICallbacks - Browser UI interaction callbacks
 *
 * Example implementation of UICallbacks interface for browser platform.
 * Demonstrates how platforms should handle user interactions.
 */

import type {
  UICallbacks,
  PairingRequestUI,
  ErrorUI,
  ConnectionStateValue,
  PairingMethod,
} from '@refinio/connection.core';

export class BrowserUICallbacks implements UICallbacks {
  /**
   * Show pairing request to user for approval
   * Uses browser confirm dialog (platform should replace with custom UI)
   */
  async onPairingRequest(request: PairingRequestUI): Promise<boolean> {
    const message = this.formatPairingRequest(request);
    return window.confirm(message);
  }

  /**
   * Show error message to user
   * Uses console.error and alert (platform should replace with custom UI)
   */
  onError(error: ErrorUI): void {
    console.error(`[Connection Error ${error.code}]`, error.message, error.context);

    // Show user-friendly error message
    if (this.shouldShowToUser(error.code)) {
      alert(`Connection Error: ${error.message}`);
    }
  }

  /**
   * Notify of connection state change
   * Logs to console (platform should update UI accordingly)
   */
  onConnectionStateChange(peerId: string, state: ConnectionStateValue): void {
    console.log(`[Connection] Peer ${peerId} state changed to: ${state}`);

    // Platform should update UI to show connection status
    // For example: update connection indicator, show notification, etc.
  }

  /**
   * Request user to select from multiple pairing methods
   * Uses browser prompt (platform should replace with custom UI)
   */
  async selectPairingMethod(methods: PairingMethod[]): Promise<PairingMethod | null> {
    const message = 'Select pairing method:\n' +
      methods.map((m, i) => `${i + 1}. ${m}`).join('\n');

    const choice = window.prompt(message);
    if (!choice) {
      return null;
    }

    const index = parseInt(choice, 10) - 1;
    if (index >= 0 && index < methods.length) {
      return methods[index]!;
    }

    return null;
  }

  /**
   * Format pairing request for display
   */
  private formatPairingRequest(request: PairingRequestUI): string {
    let message = `Pairing request from: ${request.peerName} (${request.peerId})\n`;
    message += `Method: ${request.method}\n`;

    if (request.verificationCode) {
      message += `Verification code: ${request.verificationCode}\n`;
    }

    message += '\nAccept pairing?';
    return message;
  }

  /**
   * Determine if error should be shown to user
   * Some errors are for debugging only
   */
  private shouldShowToUser(errorCode: string): boolean {
    // Don't show technical errors to users
    const internalCodes = [
      'INVALID_STATE_TRANSITION',
      'NOT_INITIALIZED',
      'ALREADY_INITIALIZED',
    ];

    return !internalCodes.includes(errorCode);
  }
}
