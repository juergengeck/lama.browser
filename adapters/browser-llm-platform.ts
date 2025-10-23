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
   * Emit progress update via worker postMessage
   * Main thread will dispatch 'message:thinking' event for UI
   */
  emitProgress(topicId: string, progress: number): void {
    self.postMessage({
      type: 'ai:progress',
      conversationId: topicId,
      progress,
    });
  }

  /**
   * Emit error via worker postMessage
   * Main thread will dispatch 'ai:error' event for UI
   */
  emitError(topicId: string, error: Error): void {
    self.postMessage({
      type: 'ai:error',
      conversationId: topicId,
      error: error.message,
    });
  }

  /**
   * Emit message update via worker postMessage
   * Main thread will dispatch appropriate streaming or update events
   */
  emitMessageUpdate(
    topicId: string,
    messageId: string,
    text: string,
    status: string
  ): void {
    if (status === 'streaming') {
      self.postMessage({
        type: 'ai:messageStream',
        conversationId: topicId,
        messageId,
        chunk: text,
        partial: text,
      });
    } else if (status === 'complete' || status === 'error') {
      self.postMessage({
        type: 'ai:messageComplete',
        conversationId: topicId,
        message: {
          id: messageId,
          conversationId: topicId,
          text,
          status: status === 'error' ? 'error' : 'sent',
          timestamp: new Date().toISOString(),
        },
      });
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
