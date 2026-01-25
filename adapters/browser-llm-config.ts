/**
 * Browser LLM Config Adapters
 *
 * Provides browser-based implementations using fetch() API and ONE.core crypto.
 * Works with Ollama's HTTP API on localhost:11434 or remote servers.
 */

import type { TestConnectionResponse } from '@refinio/lama.core/plans/LLMConfigPlan';
import {
  createSymmetricKey,
  symmetricEncryptAndEmbedNonce,
  symmetricDecryptWithEmbeddedNonce,
  type SymmetricKey,
} from '@refinio/one.core/lib/crypto/encryption.js';

/**
 * Detect if running in Safari browser
 */
function isSafari(): boolean {
  const ua = navigator.userAgent;
  return ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium');
}

/**
 * Detect if this is a mixed content scenario (HTTPS page → HTTP request)
 */
function isMixedContent(url: string): boolean {
  const isSecurePage = window.location.protocol === 'https:';
  const isInsecureRequest = url.startsWith('http://');
  return isSecurePage && isInsecureRequest;
}

/**
 * Detect if error is CORS-related
 */
function isCorsError(error: any): boolean {
  // CORS errors typically appear as TypeError with specific messages
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    return (
      message.includes('cors') ||
      message.includes('network request failed') ||
      message.includes('failed to fetch') ||
      error.name === 'TypeError' // Generic fetch failure often indicates CORS
    );
  }
  return false;
}

/**
 * Detect Safari's mixed content blocking
 * Safari blocks HTTPS→HTTP requests with "Load failed" error
 */
function isSafariMixedContentBlock(error: any, url: string): boolean {
  if (!isSafari()) return false;
  if (!isMixedContent(url)) return false;

  // Safari's mixed content error shows as "Load failed"
  if (error instanceof TypeError && error.message === 'Load failed') {
    return true;
  }
  return false;
}

/**
 * Browser implementation for Ollama-compatible API connection testing using fetch()
 * Works with Ollama, LM Studio, and other Ollama-compatible servers
 */
export const browserOllamaValidator = {
  async testOllamaConnection(
    server: string,
    authToken?: string,
    serviceName: string = 'Ollama'
  ): Promise<TestConnectionResponse> {
    // Validate server URL
    if (!server) {
      return {
        success: false,
        error: 'No server URL provided',
        errorCode: 'INVALID_URL'
      };
    }

    // Ensure server has protocol - declare outside try so it's accessible in catch
    let serverUrl = server;
    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
      serverUrl = `http://${serverUrl}`;
    }

    // Remove trailing slash
    serverUrl = serverUrl.replace(/\/$/, '');

    try {

      console.log(`[Browser] Testing ${serviceName} connection to:`, serverUrl);

      // Early warning for Safari mixed content scenario
      if (isSafari() && isMixedContent(serverUrl)) {
        console.warn('[Browser] Safari detected with mixed content scenario - connection will likely fail');
      }

      const headers: Record<string, string> = {};

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      // Test connection by fetching version info
      const response = await fetch(`${serverUrl}/api/version`, {
        method: 'GET',
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          errorCode: 'HTTP_ERROR'
        };
      }

      const data = await response.json();

      // Also fetch available models
      const models = await this.fetchOllamaModels(server, authToken);

      return {
        success: true,
        version: data.version || 'unknown',
        models
      };
    } catch (error: any) {
      console.warn(`[Browser] ${serviceName} connection test failed:`, error);

      if (error.name === 'TimeoutError') {
        return {
          success: false,
          error: 'Connection timeout - is Ollama running?',
          errorCode: 'TIMEOUT'
        };
      }

      // Detect Safari mixed content blocking (HTTPS page → HTTP localhost)
      if (isSafariMixedContentBlock(error, serverUrl)) {
        return {
          success: false,
          error: 'Safari blocks HTTP requests from HTTPS pages. Options: (1) Use Chrome/Firefox, (2) Set up a local HTTPS proxy, or (3) Use an HTTPS tunnel like ngrok.',
          errorCode: 'MIXED_CONTENT',
          needsSetup: true,
          isSafariMixedContent: true
        };
      }

      // Detect CORS errors - common when OLLAMA_ORIGINS is not set
      if (isCorsError(error)) {
        return {
          success: false,
          error: 'CORS policy blocked this request. Please configure OLLAMA_ORIGINS environment variable.',
          errorCode: 'CORS_ERROR',
          needsSetup: true // Flag for UI to show setup instructions
        };
      }

      return {
        success: false,
        error: error.message || 'Connection failed',
        errorCode: 'CONNECTION_ERROR'
      };
    }
  },

  async fetchOllamaModels(server: string, authToken?: string): Promise<any[]> {
    try {
      // Validate server URL
      if (!server) {
        console.warn('[Browser] No server URL provided for Ollama models fetch');
        return [];
      }

      // Ensure server has protocol
      let serverUrl = server;
      if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
        serverUrl = `http://${serverUrl}`;
      }

      // Remove trailing slash
      serverUrl = serverUrl.replace(/\/$/, '');

      console.log('[Browser] Fetching Ollama models from:', serverUrl);

      const headers: Record<string, string> = {};

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${serverUrl}/api/tags`, {
        method: 'GET',
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        console.error('[Browser] Failed to fetch models:', response.status, response.statusText);
        return [];
      }

      // Check content type before parsing
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.error('[Browser] Unexpected content type from Ollama:', contentType);
        return [];
      }

      const data = await response.json();
      return data.models || [];
    } catch (error: any) {
      console.error('[Browser] Failed to fetch Ollama models:', error);
      return [];
    }
  }
};

/**
 * Browser config manager using ONE.core's platform-agnostic crypto
 *
 * Uses symmetric encryption with a key derived from browser context.
 * In production, this key should be derived from user authentication.
 */
class BrowserConfigManager {
  private encryptionKey: SymmetricKey | null = null;

  /**
   * Initialize encryption key (should be called after user login)
   * For now, creates a random key and stores it in sessionStorage
   */
  private getOrCreateEncryptionKey(): SymmetricKey {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    // Try to load existing key from sessionStorage
    const storedKey = sessionStorage.getItem('lama:encryption_key');
    if (storedKey) {
      // Convert base64 back to Uint8Array
      const keyBytes = Uint8Array.from(atob(storedKey), c => c.charCodeAt(0));
      this.encryptionKey = keyBytes as SymmetricKey;
      return this.encryptionKey;
    }

    // Create new key
    this.encryptionKey = createSymmetricKey();

    // Store in sessionStorage (persists for session only)
    const keyBase64 = btoa(String.fromCharCode(...this.encryptionKey));
    sessionStorage.setItem('lama:encryption_key', keyBase64);

    console.log('[BrowserConfigManager] Created new encryption key');
    return this.encryptionKey;
  }

  /**
   * Encrypt token using ONE.core's symmetric encryption
   */
  encryptToken(token: string): string {
    try {
      const key = this.getOrCreateEncryptionKey();

      // Convert string to Uint8Array
      const encoder = new TextEncoder();
      const data = encoder.encode(token);

      // Encrypt with embedded nonce
      const encrypted = symmetricEncryptAndEmbedNonce(data, key);

      // Convert to base64 for storage
      return btoa(String.fromCharCode(...encrypted));
    } catch (error: any) {
      console.error('[BrowserConfigManager] Encryption failed:', error);
      throw new Error(`Token encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt token using ONE.core's symmetric encryption
   */
  decryptToken(encrypted: string): string {
    try {
      const key = this.getOrCreateEncryptionKey();

      // Convert from base64
      const encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

      // Decrypt with embedded nonce
      const decrypted = symmetricDecryptWithEmbeddedNonce(encryptedBytes, key);

      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error: any) {
      console.error('[BrowserConfigManager] Decryption failed:', error);
      throw new Error(`Token decryption failed: ${error.message}`);
    }
  }

  /**
   * Compute base URL for Ollama
   */
  computeBaseUrl(modelType: string, baseUrl?: string): string {
    // Default Ollama URL for remote access
    if (modelType === 'local') {
      return 'http://localhost:11434';
    }
    return baseUrl || 'http://localhost:11434';
  }

  /**
   * Check if encryption is available (always true now)
   */
  isEncryptionAvailable(): boolean {
    return true;
  }
}

/**
 * Export singleton instance
 */
export const browserConfigManager = new BrowserConfigManager();
