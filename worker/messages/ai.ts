/**
 * AI Worker Message Handlers
 *
 * Thin adapter layer that delegates to llmManager and AIAssistantHandler.
 * Uses the refactored AIAssistantHandler from workerOneCore.
 */

import { messageRegistry } from '../message-registry.js';
import workerOneCore from '../core/worker-one-core.js';
import type {
  AIChatRequest,
  AIChatResponse,
  AIGetModelsRequest,
  AIGetModelsResponse,
  AISetDefaultModelRequest,
  AISetDefaultModelResponse,
  AIGetDefaultModelRequest,
  AIGetDefaultModelResponse
} from '../../shared/types/worker-messages.js';

/**
 * Get the AIAssistantHandler from workerOneCore
 */
function getAIHandler() {
  if (!workerOneCore.aiAssistantModel) {
    throw new Error('AI Assistant Handler not initialized - call onecore:initialize first');
  }
  return workerOneCore.aiAssistantModel;
}

/**
 * Get the LLM manager from workerOneCore
 */
function getLLMManager() {
  if (!workerOneCore.llmManager) {
    throw new Error('LLM Manager not initialized - call onecore:initialize first');
  }
  return workerOneCore.llmManager;
}

/**
 * Chat with AI
 */
messageRegistry.register(
  'ai:chat',
  async (payload: AIChatRequest): Promise<AIChatResponse> => {
    try {
      const llmManager = getLLMManager();
      const model = payload.model || llmManager.defaultModelId;

      if (!model) {
        return {
          success: false,
          content: '',
          model: '',
          tokens: { prompt: 0, completion: 0, total: 0 },
          error: 'No model specified or default model set'
        };
      }

      // Convert single message to messages array if needed
      const messages = payload.message
        ? [{ role: 'user', content: payload.message }]
        : [];

      const response = await llmManager.chat?.(messages, model, {
        temperature: payload.temperature,
        maxTokens: payload.maxTokens
      });

      return {
        success: true,
        content: response || '',
        model: model,
        tokens: { prompt: 0, completion: 0, total: 0 },
      };
    } catch (error: any) {
      return {
        success: false,
        content: '',
        model: '',
        tokens: { prompt: 0, completion: 0, total: 0 },
        error: error.message
      };
    }
  }
);

/**
 * Get available AI models
 */
messageRegistry.register(
  'ai:getModels',
  async (payload: AIGetModelsRequest): Promise<AIGetModelsResponse> => {
    try {
      const llmManager = getLLMManager();
      const models = llmManager.getAvailableModels?.() || llmManager.models
        ? Array.from(llmManager.models.values())
        : [];

      return {
        success: true,
        models: models.map((m: any) => ({
          id: m.id,
          name: m.name,
          provider: m.provider || 'unknown',
          isLoaded: m.isLoaded || false,
          isDefault: m.id === llmManager.defaultModelId
        }))
      };
    } catch (error: any) {
      return {
        success: false,
        models: [],
        error: error.message
      };
    }
  }
);

/**
 * Set default AI model
 */
messageRegistry.register(
  'ai:setDefaultModel',
  async (payload: any): Promise<any> => {
    try {
      const llmManager = getLLMManager();
      const modelId = payload.modelId || payload.modelName;

      const success = llmManager.setDefaultModel?.(modelId) || false;

      if (success && workerOneCore.aiAssistantModel) {
        await workerOneCore.aiAssistantModel.setDefaultModel(modelId);
      }

      return success;
    } catch (error: any) {
      console.error('[Worker AI] setDefaultModel error:', error);
      return false;
    }
  }
);

/**
 * Get default AI model
 */
messageRegistry.register(
  'ai:getDefaultModel',
  async (payload: AIGetDefaultModelRequest): Promise<AIGetDefaultModelResponse> => {
    try {
      const llmManager = getLLMManager();
      const modelName = llmManager.getDefaultModel?.()?.id || llmManager.defaultModelId || null;

      return {
        success: true,
        modelName: modelName
      };
    } catch (error: any) {
      return {
        success: false,
        modelName: null,
        error: error.message
      };
    }
  }
);

console.log('[Worker] AI message handlers registered');
