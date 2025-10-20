/**
 * AI Assistant Handler Adapter (Browser/Worker)
 *
 * Creates and initializes the refactored AIAssistantHandler from lama.core
 * with browser/worker-specific dependencies. This replaces the TODO for
 * porting AIAssistantModel to browser.
 *
 * Usage:
 *   import { aiAssistantHandler } from './ai-assistant-handler-adapter.js';
 *   await aiAssistantHandler.init();
 */

import { AIAssistantHandler } from '@lama/core/handlers/AIAssistantHandler.js';
import { BrowserLLMPlatform } from '../../adapters/browser-llm-platform.js';
import type { WorkerOneCore } from './worker-one-core.js';

let handlerInstance: AIAssistantHandler | null = null;

/**
 * Create AIAssistantHandler instance with browser/worker dependencies
 * Call this after workerOneCore is initialized
 */
export function createAIAssistantHandler(
  workerOneCore: WorkerOneCore,
  llmManager: any
): AIAssistantHandler {
  if (handlerInstance) {
    console.log('[AIAssistantAdapter] Using existing handler instance');
    return handlerInstance;
  }

  console.log('[AIAssistantAdapter] Creating new AIAssistantHandler for browser/worker...');

  // Create Browser platform adapter (uses custom events)
  const platform = new BrowserLLMPlatform();

  // Create handler with all dependencies
  handlerInstance = new AIAssistantHandler({
    oneCore: workerOneCore,
    channelManager: workerOneCore.channelManager,
    topicModel: workerOneCore.topicModel,
    leuteModel: workerOneCore.leuteModel,
    llmManager: llmManager,
    platform: platform,
    stateManager: undefined, // Optional - not used in browser
    llmObjectManager: (workerOneCore as any).llmObjectManager,
    contextEnrichmentService: (workerOneCore as any).contextEnrichmentService,
    topicAnalysisModel: (workerOneCore as any).topicAnalysisModel,
  });

  console.log('[AIAssistantAdapter] AIAssistantHandler created for browser/worker');
  return handlerInstance;
}

/**
 * Initialize the AI assistant handler
 * Call this after workerOneCore is provisioned
 */
export async function initializeAIAssistantHandler(
  workerOneCore: WorkerOneCore,
  llmManager: any
): Promise<AIAssistantHandler> {
  const handler = createAIAssistantHandler(workerOneCore, llmManager);

  console.log('[AIAssistantAdapter] Initializing AIAssistantHandler for browser/worker...');
  await handler.init();

  console.log('[AIAssistantAdapter] ✅ AIAssistantHandler initialized for browser/worker');
  return handler;
}

/**
 * Get the current handler instance
 * Throws if handler hasn't been created yet
 */
export function getAIAssistantHandler(): AIAssistantHandler {
  if (!handlerInstance) {
    throw new Error(
      '[AIAssistantAdapter] AIAssistantHandler not initialized - call initializeAIAssistantHandler() first'
    );
  }
  return handlerInstance;
}

/**
 * Reset handler instance (for testing)
 */
export function resetAIAssistantHandler(): void {
  handlerInstance = null;
}
