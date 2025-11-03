/**
 * Browser LLM Platform Implementation
 *
 * Implements LLMPlatform interface for Web Worker environments.
 * This adapter bridges lama.core's platform-agnostic LLM operations with
 * worker postMessage API to communicate with the main thread.
 *
 * Uses type-safe event system for all AI events.
 */

import type { LLMPlatform } from '@lama/core/services/llm-platform.js';
import { emitAIEvent, AIEventNames } from '../browser-ui/src/events/AIEventTypes.js';

export class BrowserLLMPlatform implements LLMPlatform {
  /**
   * Emit progress update via type-safe event system
   */
  emitProgress(topicId: string, progress: number): void {
    if (typeof window !== 'undefined') {
      emitAIEvent(AIEventNames.PROGRESS, {
        topicId,
        progress,
      });
    }
  }

  /**
   * Emit error via type-safe event system
   */
  emitError(topicId: string, error: Error): void {
    if (typeof window !== 'undefined') {
      emitAIEvent(AIEventNames.ERROR, {
        topicId,
        error,
      });
    }
  }

  /**
   * Emit message update via type-safe event system
   */
  emitMessageUpdate(
    topicId: string,
    messageId: string,
    content: string | { thinking?: string; response: string; raw?: string },
    status: string
  ): void {
    if (typeof window === 'undefined') return;

    // Normalize content to string format (extract response)
    const normalized = typeof content === 'string'
      ? content
      : content.response;

    if (status === 'streaming') {
      emitAIEvent(AIEventNames.MESSAGE_STREAM, {
        topicId,
        messageId,
        partial: normalized,
      });
    } else if (status === 'complete' || status === 'error') {
      emitAIEvent(AIEventNames.MESSAGE_COMPLETE, {
        topicId,
        messageId,
        response: normalized,
      });
    }
  }

  /**
   * Emit analysis update via type-safe event system
   * Notifies UI when subjects/keywords are extracted from AI responses
   */
  emitAnalysisUpdate(topicId: string, updateType: 'subjects' | 'keywords' | 'both'): void {
    if (typeof window !== 'undefined') {
      emitAIEvent(AIEventNames.ANALYSIS_UPDATE, {
        topicId,
        type: updateType,
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
