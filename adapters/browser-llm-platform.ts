/**
 * Browser LLM Platform Implementation
 *
 * Implements LLMPlatform interface for Web Worker environments.
 * This adapter bridges lama.core's platform-agnostic LLM operations with
 * worker postMessage API to communicate with the main thread.
 *
 * Uses type-safe event system for all AI events.
 * Manages local-llm.worker.ts for on-device text generation.
 */

import type { LLMPlatform, ChatMessage, LocalChatOptions } from '@lama/core/services/llm-platform.js';
import { emitAIEvent, AIEventNames } from '../browser-ui/src/events/AIEventTypes.js';
import type { GraniteToolDefinition, ToolCall } from '@mcp/core';

// Re-export types for convenience
export type { GraniteToolDefinition, ToolCall };

/**
 * Tool executor function signature
 * Returns the result as a string to be fed back to the model
 */
export type ToolExecutor = (toolName: string, args: Record<string, any>) => Promise<string>;

// Worker message types (must match local-llm.worker.ts)
interface WorkerMessage {
  type: 'load' | 'chat' | 'unload' | 'status';
  id: string;
  modelId?: string;
  messages?: ChatMessage[];
  tools?: GraniteToolDefinition[];
  options?: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  };
}

interface WorkerResponse {
  type: 'loaded' | 'response' | 'stream' | 'unloaded' | 'status' | 'error' | 'progress' | 'tool_call';
  id: string;
  data?: any;
  error?: string;
}

// Pending request tracking
interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  onStream?: (chunk: string) => void;
  onProgress?: (progress: number) => void;
  onToolCall?: (toolCalls: ToolCall[]) => void;
}

// Static model list (must match worker's TEXT_GEN_MODELS)
// Note: 'installed' is always false for browser - models are downloaded on-demand
// and cached in IndexedDB by transformers.js
const LOCAL_MODELS = [
  { id: 'granite-4.0-350m', name: 'Granite 4.0 Nano', size: 0, installed: false },
  { id: 'granite-3.3-2b-instruct', name: 'Granite 3.3 2B', size: 0, installed: false },
  { id: 'phi-3.5-mini-instruct', name: 'Phi 3.5 Mini', size: 0, installed: false }
];

export class BrowserLLMPlatform implements LLMPlatform {
  // Worker management
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private loadedModelId: string | null = null;

  /**
   * Lazy-initialize the Web Worker
   */
  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../browser-ui/src/workers/local-llm.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('[BrowserLLMPlatform] Worker error:', error);
      };
    }
    return this.worker;
  }

  /**
   * Handle worker responses and route to pending requests
   */
  private handleWorkerMessage(response: WorkerResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    switch (response.type) {
      case 'progress':
        pending.onProgress?.(response.data?.percent ?? 0);
        break;

      case 'loaded':
        this.loadedModelId = response.data?.modelId ?? null;
        this.pendingRequests.delete(response.id);
        pending.resolve(undefined);
        break;

      case 'stream':
        // Streaming chat response
        pending.onStream?.(response.data?.chunk ?? '');
        break;

      case 'response':
        // Final chat response
        this.pendingRequests.delete(response.id);
        pending.resolve({ type: 'response', response: response.data?.response ?? '' });
        break;

      case 'tool_call':
        // Model wants to call tools
        this.pendingRequests.delete(response.id);
        pending.resolve({ type: 'tool_call', toolCalls: response.data?.toolCalls ?? [] });
        break;

      case 'unloaded':
        this.loadedModelId = null;
        this.pendingRequests.delete(response.id);
        pending.resolve(undefined);
        break;

      case 'status':
        this.pendingRequests.delete(response.id);
        pending.resolve(response.data);
        break;

      case 'error':
        this.pendingRequests.delete(response.id);
        pending.reject(new Error(response.error ?? 'Unknown worker error'));
        break;
    }
  }

  /**
   * Send request to worker and return promise
   */
  private sendRequest<T>(
    message: Omit<WorkerMessage, 'id'>,
    options?: { onStream?: (chunk: string) => void; onProgress?: (progress: number) => void }
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `req-${++this.requestCounter}`;

      this.pendingRequests.set(id, {
        resolve,
        reject,
        onStream: options?.onStream,
        onProgress: options?.onProgress
      });

      const fullMessage = { ...message, id } as WorkerMessage;
      this.getWorker().postMessage(fullMessage);
    });
  }

  // =====================================================
  // LLMPlatform optional methods for local model support
  // =====================================================

  /**
   * Get list of available local models
   */
  async getAvailableLocalModels(): Promise<Array<{ id: string; name: string; size: number; installed: boolean }>> {
    return LOCAL_MODELS;
  }

  /**
   * Check if a local model is currently loaded
   */
  isLocalModelLoaded(modelId: string): boolean {
    return this.loadedModelId === modelId;
  }

  /**
   * Load a local model into memory
   */
  async loadLocalModel(modelId: string, onProgress?: (progress: number) => void): Promise<void> {
    if (this.loadedModelId === modelId) {
      return; // Already loaded
    }

    await this.sendRequest<void>(
      { type: 'load', modelId },
      { onProgress }
    );
  }

  /**
   * Unload current local model from memory
   */
  async unloadLocalModel(_modelId: string): Promise<void> {
    if (!this.loadedModelId) {
      return; // Nothing loaded
    }

    await this.sendRequest<void>({ type: 'unload' });
  }

  /**
   * Chat with a local model (with optional tool calling support)
   */
  async chatWithLocal(
    modelId: string,
    messages: ChatMessage[],
    options: LocalChatOptions & {
      tools?: GraniteToolDefinition[];
      toolExecutor?: ToolExecutor;
      maxToolCalls?: number;
    }
  ): Promise<string> {
    // Ensure model is loaded
    if (this.loadedModelId !== modelId) {
      await this.loadLocalModel(modelId);
    }

    const { tools, toolExecutor, maxToolCalls = 10, ...chatOptions } = options;
    let currentMessages = [...messages];
    let toolCallCount = 0;

    // Tool calling loop
    while (true) {
      const result = await this.sendRequest<{ type: string; response?: string; toolCalls?: ToolCall[] }>(
        {
          type: 'chat',
          messages: currentMessages,
          tools,
          options: {
            temperature: chatOptions.temperature ?? 0.7,
            maxTokens: chatOptions.maxTokens ?? 2048,
            stream: !!chatOptions.onStream
          }
        },
        { onStream: chatOptions.onStream }
      );

      // If final response, return it
      if (result.type === 'response') {
        return result.response ?? '';
      }

      // If tool call, execute and continue
      if (result.type === 'tool_call' && result.toolCalls && toolExecutor) {
        // Safety check
        toolCallCount++;
        if (toolCallCount > maxToolCalls) {
          console.warn('[BrowserLLMPlatform] Max tool calls reached, returning partial response');
          return '[Tool call limit reached]';
        }

        // Execute each tool call and collect results
        for (const toolCall of result.toolCalls) {
          console.log(`[BrowserLLMPlatform] Executing tool: ${toolCall.name}`, toolCall.arguments);
          try {
            const toolResult = await toolExecutor(toolCall.name, toolCall.arguments);
            // Add tool response to messages for next iteration
            currentMessages.push({
              role: 'tool_response' as any,
              content: toolResult
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[BrowserLLMPlatform] Tool execution error:`, errorMsg);
            currentMessages.push({
              role: 'tool_response' as any,
              content: `Error: ${errorMsg}`
            });
          }
        }
        // Continue the loop to get model's response after tool execution
        continue;
      }

      // No tool executor provided but tool call received
      if (result.type === 'tool_call') {
        console.warn('[BrowserLLMPlatform] Tool call received but no toolExecutor provided');
        return '[Tool call requested but no executor available]';
      }

      // Unknown result type
      console.error('[BrowserLLMPlatform] Unknown result type:', result);
      return '';
    }
  }

  // =====================================================
  // Existing LLMPlatform methods (event emission)
  // =====================================================

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
    status: string,
    modelId?: string,
    modelName?: string
  ): void {
    if (typeof window === 'undefined') return;

    // Normalize content to string format (extract response)
    const normalized = typeof content === 'string'
      ? content
      : content.response;

    if (status === 'responding') {
      // AI is about to respond - emit progress event for thinking indicator
      emitAIEvent(AIEventNames.PROGRESS, {
        topicId,
        progress: 0,
      });
    } else if (status === 'streaming') {
      emitAIEvent(AIEventNames.MESSAGE_STREAM, {
        topicId,
        messageId,
        partial: normalized,
        modelId,
        modelName,
      });
    } else if (status === 'complete' || status === 'error') {
      emitAIEvent(AIEventNames.MESSAGE_COMPLETE, {
        topicId,
        messageId,
        response: normalized,
        modelId,
        modelName,
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
   * Emit thinking stream update (for models with extended thinking like DeepSeek R1)
   * Browser implementation logs to console for debugging
   */
  emitThinkingUpdate(topicId: string, messageId: string, thinkingContent: string): void {
    if (typeof window !== 'undefined') {
      // Reduced logging - only log completion, not every chunk
      // console.log(`[BrowserLLMPlatform] 🧠 Thinking update for ${topicId}/${messageId}: ${thinkingContent.length} chars`);
      // Future: Could emit a custom event for UI visualization of thinking process
      // emitAIEvent(AIEventNames.THINKING_UPDATE, { topicId, messageId, thinkingContent });
    }
  }

  /**
   * Emit thinking status update during AI response generation
   * Browser implementation logs to console for debugging
   */
  emitThinkingStatus(topicId: string, status: string): void {
    if (typeof window !== 'undefined') {
      // Reduced logging - only log significant status changes
      // console.log(`[BrowserLLMPlatform] 🤔 Thinking status for ${topicId}: ${status}`);
      // Future: Could emit a custom event for UI status indicators
      // emitAIEvent(AIEventNames.THINKING_STATUS, { topicId, status });
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

  /**
   * Lookup local model info by ID for UI display
   * Uses LOCAL_MODELS static list to find model info
   */
  async lookupLocalModel(modelId: string): Promise<{ displayName: string; provider: string } | null> {
    const model = LOCAL_MODELS.find(m => m.id === modelId);
    if (model) {
      return {
        displayName: model.name,
        provider: 'local-onnx'
      };
    }
    return null;
  }
}
