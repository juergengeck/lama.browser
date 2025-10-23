/**
 * Browser LLM Platform Implementation
 *
 * Implements LLMPlatform interface for Web Worker environments.
 * This adapter bridges lama.core's platform-agnostic LLM operations with
 * worker postMessage API to communicate with the main thread.
 */

import type { LLMPlatform } from '@lama/core/services/llm-platform.js';

export class BrowserLLMPlatform implements LLMPlatform {
  /**
   * Emit progress update via window custom event (Browser Direct - no workers)
   */
  emitProgress(topicId: string, progress: number): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai:progress', {
        detail: {
          conversationId: topicId,
          progress,
        }
      }));
    }
  }

  /**
   * Emit error via window custom event (Browser Direct - no workers)
   */
  emitError(topicId: string, error: Error): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai:error', {
        detail: {
          conversationId: topicId,
          error: error.message,
        }
      }));
    }
  }

  /**
   * Emit message update via window custom event (Browser Direct - no workers)
   */
  emitMessageUpdate(
    topicId: string,
    messageId: string,
    content: string | { thinking?: string; response: string; raw?: string },
    status: string
  ): void {
    if (typeof window === 'undefined') return;

    // Normalize content to object format
    const normalized = typeof content === 'string'
      ? { response: content }
      : content;

    if (status === 'streaming') {
      console.log('[BrowserLLMPlatform] 📢 Dispatching ai:messageStream event, response length:', normalized.response.length);
      window.dispatchEvent(new CustomEvent('ai:messageStream', {
        detail: {
          conversationId: topicId,
          messageId,
          chunk: normalized.response,
          partial: normalized.response,
          thinking: normalized.thinking,
          raw: normalized.raw,
        }
      }));
    } else if (status === 'complete' || status === 'error') {
      window.dispatchEvent(new CustomEvent('ai:messageComplete', {
        detail: {
          conversationId: topicId,
          message: {
            id: messageId,
            conversationId: topicId,
            text: normalized.response,
            thinking: normalized.thinking,
            raw: normalized.raw,
            status: status === 'error' ? 'error' : 'sent',
            timestamp: new Date().toISOString(),
          },
        }
      }));
    }
  }

  /**
   * MCP server operations not supported in browser
   * Browser environments cannot spawn child processes
   */
  // startMCPServer and stopMCPServer are intentionally not implemented
  // The interface marks them as optional

  /**
   * Read model file from IndexedDB or remote fetch
   * Browser-specific implementation for model loading
   */
  async readModelFile(path: string): Promise<Buffer> {
    // In browser, we would fetch from a URL or read from IndexedDB
    // This is a placeholder - actual implementation would depend on storage strategy
    throw new Error(
      'Browser model file reading not yet implemented - use fetch() or IndexedDB'
    );
  }
}
