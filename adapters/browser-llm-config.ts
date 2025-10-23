/**
 * Browser LLM Config Adapters
 *
 * Provides browser-based implementations using fetch() API.
 * Works with Ollama's HTTP API on localhost:11434 or remote servers.
 */

import type { TestConnectionResponse } from '@lama/core/handlers/LLMConfigHandler';

/**
 * Browser implementation for Ollama connection testing using fetch()
 */
export const browserOllamaValidator = {
  async testOllamaConnection(
    baseUrl: string,
    authToken?: string
  ): Promise<TestConnectionResponse> {
    try {
      console.log('[Browser] Testing Ollama connection to:', baseUrl);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      // Test connection by fetching version info
      const response = await fetch(`${baseUrl}/api/version`, {
        method: 'GET',
        headers,
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

      return {
        success: true,
        version: data.version || 'unknown'
      };
    } catch (error: any) {
      console.error('[Browser] Ollama connection test failed:', error);

      if (error.name === 'TimeoutError') {
        return {
          success: false,
          error: 'Connection timeout - is Ollama running?',
          errorCode: 'TIMEOUT'
        };
      }

      return {
        success: false,
        error: error.message || 'Connection failed',
        errorCode: 'CONNECTION_ERROR'
      };
    }
  },

  async fetchOllamaModels(baseUrl: string, authToken?: string): Promise<any[]> {
    try {
      console.log('[Browser] Fetching Ollama models from:', baseUrl);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        console.error('[Browser] Failed to fetch models:', response.status, response.statusText);
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
 * Browser stub for config manager (encryption/decryption)
 * In browser, sensitive token handling should use Web Crypto API or backend
 */
export const browserConfigManager = {
  encryptToken(token: string): string {
    // Browser stub - no encryption (tokens should be handled by backend)
    console.warn('[Browser] Token encryption not implemented - use backend for sensitive operations');
    return token;
  },

  decryptToken(encrypted: string): string {
    // Browser stub - no decryption
    console.warn('[Browser] Token decryption not implemented - use backend for sensitive operations');
    return encrypted;
  },

  computeBaseUrl(modelType: string, baseUrl?: string): string {
    // Default Ollama URL for remote access
    if (modelType === 'local') {
      return 'http://localhost:11434';
    }
    return baseUrl || 'http://localhost:11434';
  },

  isEncryptionAvailable(): boolean {
    // Encryption not available in browser (should use backend)
    return false;
  }
};
