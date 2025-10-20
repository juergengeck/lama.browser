/**
 * Browser LLM Platform Implementation
 *
 * Implements LLMPlatform interface for browser environments using custom events.
 * This adapter bridges lama.core's platform-agnostic LLM operations with browser
 * event system.
 */

import type { LLMPlatform } from '@lama/core/services/llm-platform.js';

export class BrowserLLMPlatform implements LLMPlatform {
  /**
   * Emit progress update via custom event
   * Maps to 'message:thinking' event for UI
   */
  emitProgress(topicId: string, progress: number): void {
    window.dispatchEvent(
      new CustomEvent('message:thinking', {
        detail: {
          conversationId: topicId,
          progress,
        },
      })
    );
  }

  /**
   * Emit error via custom event
   * Maps to 'ai:error' event for UI
   */
  emitError(topicId: string, error: Error): void {
    window.dispatchEvent(
      new CustomEvent('ai:error', {
        detail: {
          conversationId: topicId,
          error: error.message,
        },
      })
    );
  }

  /**
   * Emit message update via custom event
   * Maps to 'message:stream' (streaming) or 'message:updated' (complete) events
   */
  emitMessageUpdate(
    topicId: string,
    messageId: string,
    text: string,
    status: string
  ): void {
    if (status === 'streaming') {
      window.dispatchEvent(
        new CustomEvent('message:stream', {
          detail: {
            conversationId: topicId,
            messageId,
            chunk: text,
            partial: text,
          },
        })
      );
    } else if (status === 'complete' || status === 'error') {
      window.dispatchEvent(
        new CustomEvent('message:updated', {
          detail: {
            conversationId: topicId,
            message: {
              id: messageId,
              conversationId: topicId,
              text,
              status: status === 'error' ? 'error' : 'sent',
              timestamp: new Date().toISOString(),
            },
          },
        })
      );
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
